#!/usr/bin/env node

const path = require("node:path");
const { runTutorialApp } = require("./tutor-runtime");

const ROOT_DIR = __dirname;
const READ_TUTORIAL_DIR = path.join(ROOT_DIR, "tutorials", "read");
const args = new Set(process.argv.slice(2));

runTutorialApp({
  rootDir: ROOT_DIR,
  tutorialDir: READ_TUTORIAL_DIR,
  tutorialJsonPath: path.join(READ_TUTORIAL_DIR, "tutorial.json"),
  tutorialHtmlPath: path.join(READ_TUTORIAL_DIR, "tutorial.html"),
  notesDir: path.join(READ_TUTORIAL_DIR, "notes"),
  shouldOpenBrowser: !args.has("--no-browser"),
  shouldAttachTui: !args.has("--no-attach"),
}).catch(async (error) => {
  process.stderr.write(`\nStartup failed: ${error.message}\n`);
  process.exitCode = 1;
});
