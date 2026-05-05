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
let browserProcess;
let browserProfileDir;
let shuttingDown = false;
let runtimeConfig;

async function runTutorialApp(options) {
  runtimeConfig = createRuntimeConfig(options);
  shuttingDown = false;
  siteServer = undefined;
  opencodeProcess = undefined;
  browserProcess = undefined;
  browserProfileDir = undefined;

  try {
    wireSignals();
    await Promise.all([
      fs.mkdir(runtimeConfig.notesDir, { recursive: true }),
      fs.mkdir(runtimeConfig.ocSessionsDir, { recursive: true }),
    ]);

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

    siteServer = await startSiteServer({
      tutorial,
      opencodePort,
      sitePort,
      siteFilePath: runtimeConfig.tutorialHtmlPath,
    });

    printStartupInfo({
      tutorial,
      opencodePort,
      sitePort,
      tutorialJsonPath: runtimeConfig.tutorialJsonPath,
      siteFilePath: runtimeConfig.tutorialHtmlPath,
    });

    if (runtimeConfig.shouldOpenBrowser) {
      await openBrowser(`http://${HOST}:${sitePort}`);
    }

    process.stdout.write("\nTutorial app is running. Press Ctrl+C to stop.\n");
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
    ocSessionsDir: path.resolve(options.ocSessionsDir || path.join(tutorialDir, "oc_sessions")),
    shouldOpenBrowser: options.shouldOpenBrowser !== false,
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

function buildTutorSessionIntro(tutorial) {
  return [
    `I am reading and learning about \"${tutorial.title}\".`,
    `Topic overview: ${tutorial.description}`,
    "You may receive no reply messages that give you more specific context about articles or videos I am currently on.",
    "If the user asks about a module, section, article, or video that has a tutorial URL, always fetch and read that URL's content before answering.",
    "Use the URL from the relevant tutorial section or the latest no-reply link-context message, and ground your answer in that fetched content instead of answering from memory.",
    "Following those messages may be specific question the user has. You must answer those questions.",
    "No response is needed to this setup message.",
  ].join("\n");
}

async function seedTutorSession({ opencodePort, sessionID, tutorial }) {
  const intro = buildTutorSessionIntro(tutorial);

  await sendNoReplyMessage({
    opencodePort,
    sessionID,
    text: intro,
  });
}

async function startSiteServer({ tutorial, opencodePort, sitePort, siteFilePath }) {
  const resourceIndex = buildResourceIndex(tutorial);

  const server = http.createServer(async (request, response) => {
    try {
      if (request.method === "GET" && (request.url === "/" || request.url === "/index.html" || request.url === "/tutorial.html")) {
        const html = await fs.readFile(siteFilePath, "utf8");
        response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
        response.end(html);
        return;
      }

      if (request.method === "POST" && request.url === "/api/chat/open") {
        const body = await readJsonBody(request);
        const resource = getIndexedResource(resourceIndex, body.key);
        const record = await ensureChatSession({ opencodePort, tutorial, resource });

        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          ok: true,
          sessionID: record.sessionID,
          transcript: record.transcript,
          resourceTitle: record.resourceTitle,
        }));
        return;
      }

      if (request.method === "POST" && request.url === "/api/chat/message") {
        const body = await readJsonBody(request);
        const resource = getIndexedResource(resourceIndex, body.key);
        const userText = asCleanString(body.text);

        if (!userText) {
          throw new Error("A message is required.");
        }

        const record = await ensureChatSession({ opencodePort, tutorial, resource });
        const assistantText = await sendChatMessage({
          opencodePort,
          sessionID: record.sessionID,
          text: userText,
        });

        const timestamp = new Date().toISOString();
        const userMessage = { role: "user", text: userText, createdAt: timestamp };
        const assistantMessage = {
          role: "assistant",
          text: assistantText,
          createdAt: new Date().toISOString(),
        };

        record.transcript.push(userMessage, assistantMessage);
        record.updatedAt = assistantMessage.createdAt;
        await saveChatSessionRecord(record);

        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({
          ok: true,
          sessionID: record.sessionID,
          messages: [userMessage, assistantMessage],
        }));
        return;
      }

      if (request.method === "POST" && request.url === "/api/resource/open") {
        const body = await readJsonBody(request);
        const resource = getIndexedResource(resourceIndex, body.key);

        await openExternalResource(resource.resourceUrl);

        response.writeHead(200, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: true }));
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
        response.end(JSON.stringify({ ok: true }));
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

function buildResourceIndex(tutorial) {
  const index = new Map();

  tutorial.modules.forEach((module, moduleIndex) => {
    module.sections.forEach((resource) => {
      const key = getCoreResourceKey(moduleIndex, resource.type);
      index.set(key, buildResourceDescriptor({ key, module, resource }));
    });

    module["aditional-links"].forEach((resource, additionalIndex) => {
      const key = getAdditionalResourceKey(moduleIndex, additionalIndex);
      index.set(key, buildResourceDescriptor({ key, module, resource }));
    });
  });

  return index;
}

function buildResourceDescriptor({ key, module, resource }) {
  return {
    key,
    moduleID: module.id,
    moduleTitle: module.title,
    moduleDescription: module.description,
    resourceType: resource.type,
    resourceTitle: resource.title,
    resourceDescription: resource.description,
    resourceUrl: resource.url,
  };
}

function getIndexedResource(resourceIndex, value) {
  const key = asChatKey(value);
  const resource = key ? resourceIndex.get(key) : undefined;
  if (!resource) {
    throw new Error("A valid resource key is required.");
  }

  return resource;
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

function asChatKey(value) {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return /^[a-z0-9_]+$/i.test(trimmed) ? trimmed : "";
}

function resolveNotePath(fileName) {
  const resolvedPath = path.resolve(runtimeConfig.notesDir, fileName);
  const relativePath = path.relative(runtimeConfig.notesDir, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid note path.");
  }

  return resolvedPath;
}

function resolveChatSessionPath(key) {
  const fileName = `${key}.json`;
  const resolvedPath = path.resolve(runtimeConfig.ocSessionsDir, fileName);
  const relativePath = path.relative(runtimeConfig.ocSessionsDir, resolvedPath);

  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Invalid session path.");
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

async function sendChatMessage({ opencodePort, sessionID, text }) {
  const response = await fetch(`http://${HOST}:${opencodePort}/session/${sessionID}/message`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({
      parts: [
        {
          type: "text",
          text,
        },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `OpenCode rejected the message (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  const payload = await response.json();
  return extractMessageText(payload);
}

function extractMessageText(message) {
  if (!message || !Array.isArray(message.parts)) {
    return "";
  }

  return message.parts
    .filter((part) => part && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();
}

async function ensureChatSession({ opencodePort, tutorial, resource }) {
  const existingRecord = await loadChatSessionRecord(resource.key);
  const record = existingRecord || createChatSessionRecord(resource);

  if (record.sessionID && (await doesSessionExist(opencodePort, record.sessionID))) {
    return record;
  }

  const session = await createSession(opencodePort, `${tutorial.title} - ${resource.resourceTitle}`);
  record.sessionID = session.id;
  record.updatedAt = new Date().toISOString();

  await seedTutorSession({ opencodePort, sessionID: record.sessionID, tutorial });
  await sendNoReplyMessage({
    opencodePort,
    sessionID: record.sessionID,
    text: buildResourceContextMessage(tutorial, resource),
  });

  if (record.transcript.length > 0) {
    await sendNoReplyMessage({
      opencodePort,
      sessionID: record.sessionID,
      text: buildTranscriptRestoreMessage(record.transcript),
    });
  }

  await saveChatSessionRecord(record);
  return record;
}

function createChatSessionRecord(resource) {
  const timestamp = new Date().toISOString();
  return {
    key: resource.key,
    sessionID: "",
    moduleID: resource.moduleID,
    moduleTitle: resource.moduleTitle,
    moduleDescription: resource.moduleDescription,
    resourceType: resource.resourceType,
    resourceTitle: resource.resourceTitle,
    resourceDescription: resource.resourceDescription,
    resourceUrl: resource.resourceUrl,
    transcript: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function loadChatSessionRecord(key) {
  const sessionPath = resolveChatSessionPath(key);

  try {
    const raw = await fs.readFile(sessionPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeChatSessionRecord(key, parsed);
  } catch (error) {
    if (error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function normalizeChatSessionRecord(key, parsed) {
  return {
    key,
    sessionID: asCleanString(parsed?.sessionID),
    moduleID: asCleanString(parsed?.moduleID),
    moduleTitle: asCleanString(parsed?.moduleTitle),
    moduleDescription: asCleanString(parsed?.moduleDescription),
    resourceType: asCleanString(parsed?.resourceType),
    resourceTitle: asCleanString(parsed?.resourceTitle),
    resourceDescription: asCleanString(parsed?.resourceDescription),
    resourceUrl: asCleanString(parsed?.resourceUrl),
    transcript: normalizeTranscript(parsed?.transcript),
    createdAt: asCleanString(parsed?.createdAt) || new Date().toISOString(),
    updatedAt: asCleanString(parsed?.updatedAt) || new Date().toISOString(),
  };
}

function normalizeTranscript(messages) {
  if (!Array.isArray(messages)) {
    return [];
  }

  return messages
    .map((message) => ({
      role: message?.role === "assistant" ? "assistant" : "user",
      text: typeof message?.text === "string" ? message.text : "",
      createdAt: asCleanString(message?.createdAt) || new Date().toISOString(),
    }))
    .filter((message) => message.text.trim() !== "");
}

async function saveChatSessionRecord(record) {
  const sessionPath = resolveChatSessionPath(record.key);
  await fs.mkdir(runtimeConfig.ocSessionsDir, { recursive: true });
  await fs.writeFile(sessionPath, JSON.stringify(record, null, 2) + "\n", "utf8");
}

async function doesSessionExist(opencodePort, sessionID) {
  const response = await fetch(`http://${HOST}:${opencodePort}/session/${sessionID}`, {
    signal: AbortSignal.timeout(5000),
  });

  if (response.status === 404) {
    return false;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Could not verify OpenCode session (${response.status} ${response.statusText}): ${errorText}`
    );
  }

  return true;
}

function buildResourceContextMessage(tutorial, resource) {
  return [
    "This chat is for a single tutorial resource.",
    `Tutorial: ${tutorial.title}`,
    `Tutorial description: ${tutorial.description}`,
    `Module id: ${resource.moduleID}`,
    `Module title: ${resource.moduleTitle}`,
    `Module description: ${resource.moduleDescription}`,
    `Resource type: ${resource.resourceType}`,
    `Resource title: ${resource.resourceTitle}`,
    `Resource description: ${resource.resourceDescription}`,
    `Resource URL: ${resource.resourceUrl}`,
    "Questions in this chat are about this specific resource unless the user says otherwise.",
    "When answering questions about this resource, fetch and read the resource URL before answering.",
    "No response is needed to this context message.",
  ].join("\n");
}

function buildTranscriptRestoreMessage(transcript) {
  const lines = [
    "Previous chat transcript for this resource follows.",
    "Use it as prior conversation context for future replies.",
    "No response is needed to this transcript restore message.",
    "",
  ];

  for (const message of transcript) {
    lines.push(`${message.role === "assistant" ? "Assistant" : "User"}: ${message.text}`);
    lines.push("");
  }

  return lines.join("\n").trim();
}

function printStartupInfo({ tutorial, opencodePort, sitePort, tutorialJsonPath, siteFilePath }) {
  process.stdout.write(`\n${tutorial.title} app is ready.\n`);
  process.stdout.write(`Tutorial JSON: ${tutorialJsonPath}\n`);
  process.stdout.write(`Generated HTML: ${siteFilePath}\n`);
  process.stdout.write(`Site URL: http://${HOST}:${sitePort}\n`);
  process.stdout.write(`OpenCode URL: http://${HOST}:${opencodePort}\n`);
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

async function openExternalResource(url) {
  const resourceUrl = asHttpUrl(url);
  if (!resourceUrl) {
    throw new Error("A valid resource URL is required.");
  }

  const openerCommand = findExternalOpenerCommand();
  if (!openerCommand) {
    throw new Error(`Could not find a system browser opener for ${resourceUrl}.`);
  }

  await new Promise((resolve, reject) => {
    const child = spawn(openerCommand.command, [...openerCommand.args, resourceUrl], {
      cwd: runtimeConfig.rootDir,
      stdio: "ignore",
      detached: true,
    });

    child.once("error", reject);
    child.once("spawn", () => {
      child.unref();
      resolve();
    });
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

function findExternalOpenerCommand() {
  const candidates = process.platform === "darwin"
    ? [{ command: "open", args: [] }]
    : process.platform === "win32"
      ? [{ command: "cmd.exe", args: ["/c", "start", ""] }]
      : [{ command: "xdg-open", args: [] }];

  for (const candidate of candidates) {
    const result = spawnSync("which", [candidate.command], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    if (result.status === 0) {
      return candidate;
    }
  }

  return null;
}

function asHttpUrl(value) {
  const text = asCleanString(value);
  if (!text) {
    return "";
  }

  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return "";
    }
    return parsed.toString();
  } catch {
    return "";
  }
}

async function cleanup() {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

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

function getCoreResourceKey(moduleIndex, resourceType) {
  return `mod${moduleIndex + 1}_${resourceType}`;
}

function getAdditionalResourceKey(moduleIndex, additionalIndex) {
  return `mod${moduleIndex + 1}_res${additionalIndex + 1}`;
}

module.exports = {
  runTutorialApp,
  createRuntimeConfig,
};
