#!/usr/bin/env node

const fs = require("node:fs/promises");
const http = require("node:http");
const net = require("node:net");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { generateTutorialSite } = require("./tutorial-site-generator");

const HOST = "127.0.0.1";
const ROOT_DIR = __dirname;

let siteServer;
let opencodeProcess;
let attachProcess;
let browserProcess;
let browserProfileDir;
let shuttingDown = false;
let runtimeConfig;

async function runTutorialApp(options) {
  runtimeConfig = createRuntimeConfig(options);
  shuttingDown = false;
  siteServer = undefined;
  opencodeProcess = undefined;
  attachProcess = undefined;
  browserProcess = undefined;
  browserProfileDir = undefined;

  try {
    wireSignals();
    await fs.mkdir(runtimeConfig.notesDir, { recursive: true });

    const [sitePort, opencodePort] = await Promise.all([
      getAvailablePort(),
      getAvailablePort(),
    ]);

    const { tutorial } = await generateTutorialSite({
      inputPath: runtimeConfig.tutorialJsonPath,
      outputPath: runtimeConfig.tutorialHtmlPath,
    });

    startOpencodeServer(opencodePort);
    await waitForOpencode(opencodePort);

    const session = await createSession(opencodePort, tutorial.title);
    await seedTutorSession({ opencodePort, sessionID: session.id, tutorial });

    siteServer = await startSiteServer({
      opencodePort,
      sitePort,
      sessionID: session.id,
      siteFilePath: runtimeConfig.tutorialHtmlPath,
    });

    printStartupInfo({
      tutorial,
      opencodePort,
      sitePort,
      sessionID: session.id,
      tutorialJsonPath: runtimeConfig.tutorialJsonPath,
      siteFilePath: runtimeConfig.tutorialHtmlPath,
    });

    if (runtimeConfig.shouldOpenBrowser) {
      await openBrowser(`http://${HOST}:${sitePort}`);
    }

    if (runtimeConfig.shouldAttachTui) {
      await attachTui({ opencodePort, sessionID: session.id });
      await cleanup();
      return;
    }

    process.stdout.write("\nRunning without TUI attach. Press Ctrl+C to stop.\n");
    await new Promise(() => {});
  } catch (error) {
    await cleanup();
    throw error;
  }
}

function createRuntimeConfig(options = {}) {
  const rootDir = path.resolve(options.rootDir || ROOT_DIR);
  const tutorialDir = path.resolve(options.tutorialDir || rootDir);

  return {
    rootDir,
    tutorialDir,
    tutorialJsonPath: path.resolve(options.tutorialJsonPath || path.join(tutorialDir, "tutorial.json")),
    tutorialHtmlPath: path.resolve(options.tutorialHtmlPath || path.join(tutorialDir, "tutorial.html")),
    notesDir: path.resolve(options.notesDir || path.join(tutorialDir, "notes")),
    shouldOpenBrowser: options.shouldOpenBrowser !== false,
    shouldAttachTui: options.shouldAttachTui !== false,
  };
}

function wireSignals() {
  if (wireSignals.didRegister) {
    return;
  }

  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      if (shuttingDown) {
        return;
      }

      const exitCode = signal === "SIGINT" ? 130 : 143;
      await shutdownAndExit(exitCode);
    });
  }

  wireSignals.didRegister = true;
}

function startOpencodeServer(port) {
  opencodeProcess = spawn(
    "opencode",
    ["serve", "--hostname", HOST, "--port", String(port)],
    {
      cwd: runtimeConfig.rootDir,
      stdio: ["ignore", "inherit", "inherit"],
    }
  );

  opencodeProcess.on("exit", (code, signal) => {
    if (!shuttingDown) {
      const detail = signal ? `signal ${signal}` : `code ${code}`;
      process.stderr.write(`\nOpenCode server exited unexpectedly (${detail}).\n`);
      shutdownAndExit(code === 0 ? 0 : 1);
    }
  });
}

async function waitForOpencode(port) {
  const baseUrl = `http://${HOST}:${port}`;
  const startedAt = Date.now();
  const timeoutMs = 15000;

  while (Date.now() - startedAt < timeoutMs) {
    if (opencodeProcess.exitCode !== null) {
      throw new Error("OpenCode server stopped before it became healthy.");
    }

    try {
      const response = await fetch(`${baseUrl}/global/health`, {
        signal: AbortSignal.timeout(1500),
      });
      if (response.ok) {
        return;
      }
    } catch {
      // Retry until timeout while the server boots.
    }

    await delay(250);
  }

  throw new Error(`Timed out waiting for OpenCode server at ${baseUrl}.`);
}

async function createSession(port, tutorialTitle) {
  const response = await fetch(`http://${HOST}:${port}/session`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      title: `${tutorialTitle} Tutor`,
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`Could not create OpenCode session (${response.status} ${response.statusText}).`);
  }

  return response.json();
}

async function seedTutorSession({ opencodePort, sessionID, tutorial }) {
  const intro = [
    `I am reading and learning about \"${tutorial.title}\".`,
    `Topic overview: ${tutorial.description}`,
    "You may receive no reply messages that give you more specific context about articles or videos I am currently on.",
    "If the user asks about a module, section, article, or video that has a tutorial URL, always fetch and read that URL's content before answering.",
    "Use the URL from the relevant tutorial section or the latest no-reply link-context message, and ground your answer in that fetched content instead of answering from memory.",
    "Following those messages may be specific question the user has. You must answer those questions.",
    "No response is needed to this setup message.",
  ].join("\n");

  await sendNoReplyMessage({
    opencodePort,
    sessionID,
    text: intro,
  });
}

async function startSiteServer({ opencodePort, sitePort, sessionID, siteFilePath }) {
  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && (request.url === "/" || request.url === "/index.html" || request.url === "/tutorial.html")) {
        const html = await fs.readFile(siteFilePath, "utf8");
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }

      if (request.method === "POST" && request.url === "/api/link-context") {
        const body = await readJsonBody(request);
        const moduleTitle = asCleanString(body.moduleTitle) || "unknown module";
        const resourceTitle = asCleanString(body.resourceTitle) || asCleanString(body.resourceUrl) || "unknown link";
        const resourceUrl = asCleanString(body.resourceUrl);
        const resourceType = asCleanString(body.resourceType);

        let text = `I am now on module ${moduleTitle} and reading/watching: ${resourceTitle}`;
        if (resourceUrl) {
          text += ` (${resourceUrl})`;
        }
        text += ". Questions about this link may follow.";
        if (resourceUrl) {
          text += " If asked about this link or section, fetch and read this URL before answering.";
        }
        if (resourceType) {
          text += ` Resource type: ${resourceType}.`;
        }

        const result = await sendNoReplyMessage({ opencodePort, sessionID, text });

        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          ok: true,
          sessionID,
          messageID: result.info.id,
          text,
        }));
        return;
      }

      if (request.method === "GET" && request.url && request.url.startsWith("/api/notes")) {
        const requestUrl = new URL(request.url, `http://${HOST}:${sitePort}`);
        const fileName = asNoteFileName(requestUrl.searchParams.get("file"));
        const resourceTitle = asCleanString(requestUrl.searchParams.get("resourceTitle"));
        const resourceUrl = asCleanString(requestUrl.searchParams.get("resourceUrl"));

        if (!fileName) {
          throw new Error("A valid note file name is required.");
        }

        const notePath = resolveNotePath(fileName);
        const template = buildNoteTemplate({ resourceTitle, resourceUrl });
        let content = template;
        let exists = false;

        try {
          content = await fs.readFile(notePath, "utf8");
          exists = true;
        } catch (error) {
          if (error.code !== "ENOENT") {
            throw error;
          }
        }

        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          ok: true,
          exists,
          body: stripNoteTemplate(content, template),
          template,
        }));
        return;
      }

      if (request.method === "PUT" && request.url === "/api/notes") {
        const body = await readJsonBody(request);
        const fileName = asNoteFileName(body.fileName);
        const resourceTitle = asCleanString(body.resourceTitle);
        const resourceUrl = asCleanString(body.resourceUrl);
        const noteBody = typeof body.body === "string" ? body.body : "";

        if (!fileName) {
          throw new Error("A valid note file name is required.");
        }

        const notePath = resolveNotePath(fileName);
        const template = buildNoteTemplate({ resourceTitle, resourceUrl });

        if (!hasUserNotes(noteBody)) {
          await fs.rm(notePath, { force: true });
          response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
          response.end(JSON.stringify({ ok: true, saved: false }));
          return;
        }

        const content = `${template}${normalizeNoteBody(noteBody)}`;

        await fs.mkdir(runtimeConfig.notesDir, { recursive: true });
        await fs.writeFile(notePath, content, "utf8");

        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, saved: true }));
        return;
      }

      if (request.method === "GET" && request.url === "/health") {
        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true, sessionID }));
        return;
      }

      if (request.method === "GET" && request.url === "/favicon.ico") {
        response.writeHead(204);
        response.end();
        return;
      }

      response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Not found" }));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: error.message }));
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(sitePort, HOST, () => {
      server.off("error", reject);
      resolve();
    });
  });

  return server;
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (raw.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Request body must be valid JSON.");
  }
}

function asCleanString(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : "";
}

function asNoteFileName(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return /^[a-z0-9_]+\.md$/i.test(trimmed) ? trimmed : "";
}

function resolveNotePath(fileName) {
  const resolvedPath = path.resolve(runtimeConfig.notesDir, fileName);
  const relativePath = path.relative(runtimeConfig.notesDir, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid note path.");
  }

  return resolvedPath;
}

function buildNoteTemplate({ resourceTitle, resourceUrl }) {
  const title = resourceTitle || resourceUrl || "Resource";
  const url = resourceUrl || "";

  if (!url) {
    return `# ${title}\n\n`;
  }

  return `[${title}](${url})\n\n`;
}

function hasUserNotes(content) {
  if (typeof content !== "string") {
    return false;
  }

  return content.trim() !== "";
}

function stripNoteTemplate(content, template) {
  if (typeof content !== "string") {
    return "";
  }

  if (content.startsWith(template)) {
    return content.slice(template.length);
  }

  return content;
}

function normalizeNoteBody(content) {
  return content.replace(/^\n+/, "");
}

async function sendNoReplyMessage({ opencodePort, sessionID, text }) {
  const response = await fetch(`http://${HOST}:${opencodePort}/session/${sessionID}/message`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      noReply: true,
      parts: [
        {
          type: "text",
          text,
        },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenCode rejected the message (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  return response.json();
}

function printStartupInfo({ tutorial, opencodePort, sitePort, sessionID, tutorialJsonPath, siteFilePath }) {
  process.stdout.write(`\n${tutorial.title} app is ready.\n`);
  process.stdout.write(`Tutorial JSON: ${tutorialJsonPath}\n`);
  process.stdout.write(`Generated HTML: ${siteFilePath}\n`);
  process.stdout.write(`Site URL: http://${HOST}:${sitePort}\n`);
  process.stdout.write(`OpenCode URL: http://${HOST}:${opencodePort}\n`);
  process.stdout.write(`Session ID: ${sessionID}\n`);
}

async function openBrowser(url) {
  const browserCommand = findBrowserCommand();
  if (!browserCommand) {
    process.stderr.write(`\nCould not find Chromium to open ${url}.\n`);
    return;
  }

  browserProfileDir = await fs.mkdtemp(path.join(os.tmpdir(), "tutor-chromium-"));
  browserProcess = spawn(
    browserCommand,
    [
      `--user-data-dir=${browserProfileDir}`,
      "--new-window",
      "--no-first-run",
      "--no-default-browser-check",
      url,
    ],
    {
      cwd: runtimeConfig.rootDir,
      stdio: "ignore",
    }
  );

  browserProcess.once("error", async (error) => {
    if (shuttingDown) {
      return;
    }

    process.stderr.write(`\nChromium failed to start: ${error.message}\n`);
    await shutdownAndExit(1);
  });

  browserProcess.once("exit", async (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const detail = signal ? `signal ${signal}` : `code ${code}`;
    process.stdout.write(`\nChromium window closed (${detail}). Shutting down app.\n`);
    await shutdownAndExit(code === 0 ? 0 : 1);
  });
}

function findBrowserCommand() {
  const commands = ["chromium", "chromium-browser", "google-chrome"];

  for (const command of commands) {
    const result = spawnSync("which", [command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status === 0) {
      return command;
    }
  }

  return null;
}

async function attachTui({ opencodePort, sessionID }) {
  process.stdout.write("Opening Chromium and attaching this terminal to the same OpenCode session...\n\n");

  const exitCode = await new Promise((resolve, reject) => {
    attachProcess = spawn(
      "opencode",
      [
        "attach",
        `http://${HOST}:${opencodePort}`,
        "--dir",
        runtimeConfig.rootDir,
        "--session",
        sessionID,
      ],
      {
        cwd: runtimeConfig.rootDir,
        stdio: "inherit",
      }
    );

    attachProcess.once("error", (error) => {
      if (shuttingDown) {
        resolve(0);
        return;
      }

      reject(error);
    });

    attachProcess.once("exit", (code, signal) => {
      if (shuttingDown) {
        resolve(0);
        return;
      }

      if (signal) {
        reject(new Error(`OpenCode TUI exited from signal ${signal}.`));
        return;
      }
      resolve(code ?? 0);
    });
  });

  if (exitCode !== 0) {
    throw new Error(`OpenCode TUI exited with code ${exitCode}.`);
  }
}

async function cleanup() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (attachProcess && attachProcess.exitCode === null) {
    attachProcess.kill("SIGTERM");
    await waitForChildExit(attachProcess, 2000);
  }

  if (browserProcess && browserProcess.exitCode === null) {
    browserProcess.kill("SIGTERM");
    await waitForChildExit(browserProcess, 3000);
  }

  if (siteServer) {
    await new Promise((resolve) => {
      siteServer.close(() => resolve());
    });
  }

  if (opencodeProcess && opencodeProcess.exitCode === null) {
    opencodeProcess.kill("SIGTERM");
    await waitForChildExit(opencodeProcess, 2000);
  }

  if (browserProfileDir) {
    await fs.rm(browserProfileDir, { recursive: true, force: true });
  }
}

async function shutdownAndExit(exitCode) {
  await cleanup();
  process.exit(exitCode);
}

async function waitForChildExit(child, timeoutMs) {
  await new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }

    const timeout = setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, timeoutMs);

    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);
    server.listen(0, HOST, () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not determine an available port.")));
        return;
      }

      const { port } = address;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  runTutorialApp,
  createRuntimeConfig,
};
