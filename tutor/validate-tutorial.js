#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const REQUIRED_ROOT_KEYS = ["id", "title", "description", "modules"];
const REQUIRED_MODULE_KEYS = [
  "id",
  "title",
  "description",
  "sections",
  "aditional-links",
];
const REQUIRED_LINK_KEYS = ["type", "title", "description", "url"];
const ALLOWED_TYPES = new Set(["video", "guide", "doc", "tutorial"]);
const SECTION_RULES = {
  video: { min: 1, max: 1 },
  guide: { min: 1, max: 1 },
  doc: { min: 0, max: 1 },
  tutorial: { min: 1, max: 1 },
};

function main() {
  const inputPath = process.argv[2] || "tutorial.json";
  const resolvedPath = path.resolve(process.cwd(), inputPath);

  let raw;
  try {
    raw = fs.readFileSync(resolvedPath, "utf8");
  } catch (error) {
    fail([
      formatErrorBlock({
        pathLabel: resolvedPath,
        problem: "Could not read the input file.",
        expected: "A readable JSON file path.",
        actual: error.message,
        suggestedFix: "Pass an existing tutorial JSON file path, for example: node validate-tutorial.js tutorial.json",
      }),
    ]);
  }

  let tutorial;
  try {
    tutorial = JSON.parse(raw);
  } catch (error) {
    fail([
      formatErrorBlock({
        pathLabel: resolvedPath,
        problem: "The file is not valid JSON.",
        expected: "Well-formed JSON syntax.",
        actual: error.message,
        suggestedFix: "Fix the JSON syntax near the reported position and run the validator again.",
      }),
    ]);
  }

  const errors = [];
  validateTutorial(tutorial, errors);

  if (errors.length > 0) {
    fail(errors);
  }

  const moduleCount = tutorial.modules.length;
  process.stdout.write(
    `Validation passed: ${path.basename(resolvedPath)} (${moduleCount} module${moduleCount === 1 ? "" : "s"})\n`
  );
}

function validateTutorial(tutorial, errors) {
  if (!isPlainObject(tutorial)) {
    addError(errors, {
      pathLabel: "root",
      problem: "The top-level value is not an object.",
      expected: "A JSON object with keys: id, title, description, modules.",
      actual: describeValue(tutorial),
      suggestedFix: "Wrap the tutorial data in a single JSON object.",
    });
    return;
  }

  validateExactKeys(tutorial, REQUIRED_ROOT_KEYS, "root", errors);
  validateRequiredStringProperty(tutorial, "id", "root.id", errors);
  validateRequiredStringProperty(tutorial, "title", "root.title", errors);
  validateRequiredStringProperty(tutorial, "description", "root.description", errors);

  if (!Array.isArray(tutorial.modules)) {
    addError(errors, {
      pathLabel: "root.modules",
      problem: "Invalid type.",
      expected: "An array of module objects.",
      actual: describeValue(tutorial.modules),
      suggestedFix: "Set modules to an array, even if it currently contains only one module.",
    });
    return;
  }

  if (tutorial.modules.length < 1) {
    addError(errors, {
      pathLabel: "root.modules",
      problem: "The modules array is empty.",
      expected: "At least 1 module.",
      actual: "0 modules",
      suggestedFix: "Add at least one module object to root.modules.",
    });
  }

  tutorial.modules.forEach((module, index) => {
    validateModule(module, `root.modules[${index}]`, errors);
  });
}

function validateModule(module, pathLabel, errors) {
  if (!isPlainObject(module)) {
    addError(errors, {
      pathLabel,
      problem: "Invalid type.",
      expected: "A module object.",
      actual: describeValue(module),
      suggestedFix: "Replace this array item with a module object containing id, title, description, sections, and aditional-links.",
    });
    return;
  }

  validateExactKeys(module, REQUIRED_MODULE_KEYS, pathLabel, errors);
  validateRequiredStringProperty(module, "id", `${pathLabel}.id`, errors);
  validateRequiredStringProperty(module, "title", `${pathLabel}.title`, errors);
  validateRequiredStringProperty(module, "description", `${pathLabel}.description`, errors);

  if (!Array.isArray(module.sections)) {
    addError(errors, {
      pathLabel: `${pathLabel}.sections`,
      problem: "Invalid type.",
      expected: "An array of section link objects.",
      actual: describeValue(module.sections),
      suggestedFix: "Set sections to an array of objects using type, title, description, and url.",
    });
  } else {
    validateSections(module.sections, `${pathLabel}.sections`, errors);
  }

  const additionalLinks = module["aditional-links"];
  if (!Array.isArray(additionalLinks)) {
    addError(errors, {
      pathLabel: `${pathLabel}.aditional-links`,
      problem: "Invalid type.",
      expected: "An array of additional link objects. Empty array is allowed.",
      actual: describeValue(additionalLinks),
      suggestedFix: "Set aditional-links to [] or to an array of objects using type, title, description, and url.",
    });
  } else {
    additionalLinks.forEach((link, index) => {
      validateLink(link, `${pathLabel}.aditional-links[${index}]`, errors);
    });
  }
}

function validateSections(sections, pathLabel, errors) {
  const typeCounts = {
    video: 0,
    guide: 0,
    doc: 0,
    tutorial: 0,
  };

  sections.forEach((section, index) => {
    const sectionPath = `${pathLabel}[${index}]`;
    validateLink(section, sectionPath, errors);

    if (isPlainObject(section) && typeof section.type === "string" && ALLOWED_TYPES.has(section.type)) {
      typeCounts[section.type] += 1;
    }
  });

  for (const [type, rule] of Object.entries(SECTION_RULES)) {
    const count = typeCounts[type];
    if (count < rule.min || count > rule.max) {
      const expected =
        rule.min === rule.max
          ? `exactly ${rule.min}`
          : `${rule.min} or ${rule.max}`;
      addError(errors, {
        pathLabel,
        problem: `Invalid number of \"${type}\" sections.`,
        expected: `${countRule(rule)} ${type} section(s) in each module.`,
        actual: `Found ${count} ${type} section(s). Full counts: ${JSON.stringify(typeCounts)}.`,
        suggestedFix: `Adjust ${pathLabel} so the module has ${expected} ${type} section(s).`,
      });
    }
  }
}

function validateLink(link, pathLabel, errors) {
  if (!isPlainObject(link)) {
    addError(errors, {
      pathLabel,
      problem: "Invalid type.",
      expected: "A link object with keys: type, title, description, url.",
      actual: describeValue(link),
      suggestedFix: "Replace this value with an object containing type, title, description, and url.",
    });
    return;
  }

  validateExactKeys(link, REQUIRED_LINK_KEYS, pathLabel, errors);
  validateRequiredStringProperty(link, "type", `${pathLabel}.type`, errors);
  validateRequiredStringProperty(link, "title", `${pathLabel}.title`, errors);
  validateRequiredStringProperty(link, "description", `${pathLabel}.description`, errors);
  validateRequiredStringProperty(link, "url", `${pathLabel}.url`, errors);

  if (typeof link.type === "string" && !ALLOWED_TYPES.has(link.type)) {
    addError(errors, {
      pathLabel: `${pathLabel}.type`,
      problem: "Unsupported type value.",
      expected: `One of: ${Array.from(ALLOWED_TYPES).join(", ")}.`,
      actual: JSON.stringify(link.type),
      suggestedFix: "Use one of the allowed type values and match the spelling exactly.",
    });
  }

  if (typeof link.url === "string" && link.url.trim() !== "") {
    validateUrl(link.url, `${pathLabel}.url`, errors);
  }
}

function validateExactKeys(value, requiredKeys, pathLabel, errors) {
  const presentKeys = Object.keys(value).sort();
  const expectedKeys = [...requiredKeys].sort();

  for (const key of expectedKeys) {
    if (!(key in value)) {
      addError(errors, {
        pathLabel: `${pathLabel}.${key}`,
        problem: "Missing required property.",
        expected: `Property \"${key}\" must exist. Allowed keys here: ${expectedKeys.join(", ")}.`,
        actual: `Available keys: ${presentKeys.length > 0 ? presentKeys.join(", ") : "none"}.`,
        suggestedFix: `Add the missing \"${key}\" property with a valid non-empty value.`,
      });
    }
  }

  for (const key of presentKeys) {
    if (!requiredKeys.includes(key)) {
      addError(errors, {
        pathLabel: `${pathLabel}.${key}`,
        problem: "Unexpected property.",
        expected: `Only these keys are allowed: ${expectedKeys.join(", ")}.`,
        actual: `Found extra property \"${key}\".`,
        suggestedFix: `Remove \"${key}\" or rename it to one of the allowed keys.`,
      });
    }
  }
}

function validateNonEmptyString(value, pathLabel, errors) {
  if (typeof value !== "string") {
    addError(errors, {
      pathLabel,
      problem: "Invalid type.",
      expected: "A non-empty string.",
      actual: describeValue(value),
      suggestedFix: "Replace this value with a non-empty string.",
    });
    return;
  }

  if (value.trim() === "") {
    addError(errors, {
      pathLabel,
      problem: "Empty string.",
      expected: "A non-empty string.",
      actual: JSON.stringify(value),
      suggestedFix: "Fill in this field with a meaningful non-empty string.",
    });
  }
}

function validateRequiredStringProperty(object, key, pathLabel, errors) {
  if (!Object.prototype.hasOwnProperty.call(object, key)) {
    return;
  }

  validateNonEmptyString(object[key], pathLabel, errors);
}

function validateUrl(value, pathLabel, errors) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      addError(errors, {
        pathLabel,
        problem: "Unsupported URL protocol.",
        expected: "A valid URL using http or https.",
        actual: JSON.stringify(value),
        suggestedFix: "Use a fully qualified http:// or https:// URL.",
      });
    }
  } catch {
    addError(errors, {
      pathLabel,
      problem: "Invalid URL.",
      expected: "A valid absolute URL using http or https.",
      actual: JSON.stringify(value),
      suggestedFix: "Use a full URL such as https://example.com/page.",
    });
  }
}

function addError(errors, details) {
  errors.push(formatErrorBlock(details));
}

function formatErrorBlock({ pathLabel, problem, expected, actual, suggestedFix }) {
  const lines = [
    `Path: ${pathLabel}`,
    `Problem: ${problem}`,
    `Expected: ${expected}`,
  ];

  if (actual !== undefined) {
    lines.push(`Actual: ${actual}`);
  }

  if (suggestedFix) {
    lines.push(`Suggested fix: ${suggestedFix}`);
  }

  return lines.join("\n  ");
}

function countRule(rule) {
  if (rule.min === rule.max) {
    return `Exactly ${rule.min}`;
  }

  return `Between ${rule.min} and ${rule.max}`;
}

function describeValue(value) {
  if (Array.isArray(value)) {
    return `array(length=${value.length})`;
  }

  if (value === null) {
    return "null";
  }

  return `${typeof value}: ${JSON.stringify(value)}`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(errors) {
  process.stderr.write(`Validation failed with ${errors.length} error(s):\n`);
  for (const [index, error] of errors.entries()) {
    process.stderr.write(`${index + 1}. ${error}\n`);
    if (index < errors.length - 1) {
      process.stderr.write("\n");
    }
  }
  process.exit(1);
}

main();
