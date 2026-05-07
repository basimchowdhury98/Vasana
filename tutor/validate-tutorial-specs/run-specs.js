#!/usr/bin/env node

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const validatorPath = path.join(rootDir, "validate-tutorial.js");
const validSpecPath = path.join(__dirname, "valid-tutorial.json");
const researchInstructionPath = path.join(rootDir, "tutorial_research_instruction.md");

const validatorCases = [
  {
    name: "valid tutorial spec passes",
    file: validSpecPath,
    shouldPass: true,
  },
  {
    name: "missing root title fails",
    file: path.join(__dirname, "invalid-missing-root-title.json"),
    shouldPass: false,
  },
  {
    name: "wrong learn count fails",
    file: path.join(__dirname, "invalid-wrong-learn-count.json"),
    shouldPass: false,
  },
  {
    name: "wrong lab count fails",
    file: path.join(__dirname, "invalid-wrong-lab-count.json"),
    shouldPass: false,
  },
  {
    name: "missing learn format fails",
    file: path.join(__dirname, "invalid-missing-learn-format.json"),
    shouldPass: false,
  },
  {
    name: "invalid learn format fails",
    file: path.join(__dirname, "invalid-bad-learn-format.json"),
    shouldPass: false,
  },
  {
    name: "invalid url fails",
    file: path.join(__dirname, "invalid-url.json"),
    shouldPass: false,
  },
  {
    name: "empty modules fails",
    file: path.join(__dirname, "invalid-empty-modules.json"),
    shouldPass: false,
  },
  {
    name: "unexpected property fails",
    file: path.join(__dirname, "invalid-unexpected-property.json"),
    shouldPass: false,
  },
  {
    name: "missing tutorial fails",
    file: path.join(__dirname, "invalid-missing-tutorial.json"),
    shouldPass: false,
  },
  {
    name: "bad additional link shape fails",
    file: path.join(__dirname, "invalid-bad-additional-link-shape.json"),
    shouldPass: false,
  },
];

const instructionChecks = [
  {
    name: "research instructions preserve extras in aditional-links",
    needle:
      "Preserve all valid, non-redundant `extras` in `aditional-links`. Do not silently drop",
  },
  {
    name: "research instructions cross-check retained extras before writing tutorial.json",
    needle:
      "Before writing `tutorial.json`, cross-check every module: compare the retained extras you got from the learn and lab subagents against the final `aditional-links` array",
  },
  {
    name: "research instructions forbid empty aditional-links when kept extras remain",
    needle:
      "It should not become `[]` if you still have kept extras.",
  },
];

if (!fs.existsSync(validSpecPath)) {
  process.stderr.write(
    "Missing required valid fixture: validate-tutorial-specs/valid-tutorial.json\n"
  );
  process.stderr.write(
    "Copy tutor/tutorials/read/tutorial.json to tutor/validate-tutorial-specs/valid-tutorial.json and run the specs again.\n"
  );
  process.exit(1);
}

let failedSpecs = 0;

const researchInstruction = fs.readFileSync(researchInstructionPath, "utf8");

for (const spec of validatorCases) {
  const result = spawnSync(process.execPath, [validatorPath, spec.file], {
    cwd: rootDir,
    encoding: "utf8",
  });

  const passed = result.status === 0;
  const matchedExpectation = passed === spec.shouldPass;

  process.stdout.write(`${matchedExpectation ? "PASS" : "FAIL"} ${spec.name}\n`);

  if (!matchedExpectation) {
    failedSpecs += 1;
    process.stdout.write(`  File: ${path.relative(rootDir, spec.file)}\n`);
    process.stdout.write(`  Expected: ${spec.shouldPass ? "pass" : "fail"}\n`);
    process.stdout.write(`  Actual: ${passed ? "pass" : "fail"}\n`);
    if (result.stdout) {
      process.stdout.write("  Stdout:\n");
      process.stdout.write(indent(result.stdout));
    }
    if (result.stderr) {
      process.stdout.write("  Stderr:\n");
      process.stdout.write(indent(result.stderr));
    }
  }
}

for (const check of instructionChecks) {
  const passed = researchInstruction.includes(check.needle);
  process.stdout.write(`${passed ? "PASS" : "FAIL"} ${check.name}\n`);

  if (!passed) {
    failedSpecs += 1;
    process.stdout.write(`  File: ${path.relative(rootDir, researchInstructionPath)}\n`);
    process.stdout.write(`  Missing text: ${JSON.stringify(check.needle)}\n`);
  }
}

if (failedSpecs > 0) {
  process.stderr.write(`\n${failedSpecs} spec(s) failed.\n`);
  process.exit(1);
}

process.stdout.write(
  `\nAll ${validatorCases.length + instructionChecks.length} validator/instruction specs passed.\n`
);

function indent(text) {
  return text
    .trimEnd()
    .split("\n")
    .map((line) => `    ${line}\n`)
    .join("");
}
