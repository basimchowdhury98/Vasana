#!/usr/bin/env node

const path = require("node:path");
const { generateTutorialSite } = require("./tutorial-site-generator");

async function main() {
  const inputPath = process.argv[2] || "tutorial.json";
  const outputPath = process.argv[3] || "tutorial.html";

  const result = await generateTutorialSite({
    inputPath: path.resolve(process.cwd(), inputPath),
    outputPath: path.resolve(process.cwd(), outputPath),
  });

  process.stdout.write(`Generated tutorial HTML at ${result.outputPath}\n`);
}

main().catch((error) => {
  process.stderr.write(`Generator failed: ${error.message}\n`);
  process.exit(1);
});
