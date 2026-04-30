const fs = require("node:fs/promises");
const path = require("node:path");

async function generateTutorialSite({ inputPath, outputPath }) {
  const tutorial = JSON.parse(await fs.readFile(path.resolve(inputPath), "utf8"));
  const html = renderTutorialSite(tutorial);
  const resolvedOutputPath = path.resolve(outputPath);

  await fs.mkdir(path.dirname(resolvedOutputPath), { recursive: true });
  await fs.writeFile(resolvedOutputPath, html, "utf8");

  return {
    tutorial,
    outputPath: resolvedOutputPath,
  };
}

function renderTutorialSite(tutorial) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(tutorial.title)}</title>
    <meta name="description" content="${escapeHtml(tutorial.description)}" />
    <style>
      :root {
        --bg: #f4efe6;
        --paper: #fffaf1;
        --paper-2: #f8f1e7;
        --ink: #2f241a;
        --muted: #746150;
        --line: rgba(79, 63, 46, 0.14);
        --accent: #b56a3c;
        --accent-soft: #f0dccd;
      }

      * {
        box-sizing: border-box;
      }

      html {
        scroll-behavior: smooth;
      }

      body {
        margin: 0;
        font-family: Inter, system-ui, sans-serif;
        color: var(--ink);
        background:
          radial-gradient(circle at top left, rgba(181, 106, 60, 0.08), transparent 28%),
          linear-gradient(180deg, #efe7dc, #f6f0e8 40%, #f4efe6 100%);
      }

      .page {
        max-width: 1220px;
        margin: 0 auto;
        padding: 18px;
        display: grid;
        grid-template-columns: 180px minmax(0, 1fr);
        gap: 18px;
      }

      .sidebar {
        position: sticky;
        top: 18px;
        align-self: start;
        max-height: calc(100vh - 36px);
        overflow: auto;
        padding: 16px 14px;
        border-radius: 20px;
        background: rgba(255, 250, 241, 0.95);
        border: 1px solid var(--line);
        box-shadow: 0 18px 60px rgba(70, 44, 24, 0.08);
      }

      .resource-type {
        display: inline-block;
        padding: 3px 8px;
        border-radius: 999px;
        background: var(--accent-soft);
        color: var(--accent);
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h1 {
        margin: 10px 0 8px;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 34px;
        line-height: 1.1;
      }

      h2 {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        font-size: 28px;
        line-height: 1.15;
      }

      h3 {
        line-height: 1.25;
      }

      p,
      .module-description,
      .resource-description,
      .meta-copy,
      .section-note,
      .stat-label {
        color: var(--muted);
      }

      .stats {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin: 16px 0 0;
      }

      .stat {
        display: inline-flex;
        align-items: baseline;
        gap: 6px;
        padding: 7px 10px;
        border-radius: 999px;
        background: var(--paper-2);
        border: 1px solid var(--line);
      }

      .stat-value {
        display: inline;
        font-size: 14px;
        font-weight: 700;
      }

      .toc-title {
        margin: 0 0 12px;
        font-size: 11px;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .nav-title {
        margin: 0 0 10px;
        font-size: 12px;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .module-links {
        display: grid;
        gap: 8px;
      }

      .module-link {
        display: block;
        padding: 9px 10px;
        border-radius: 14px;
        text-decoration: none;
        color: inherit;
        background: rgba(248, 241, 231, 0.82);
        border: 1px solid var(--line);
        transition: border-color 160ms ease, transform 160ms ease;
      }

      .module-link:hover {
        border-color: rgba(181, 106, 60, 0.45);
        transform: translateY(-1px);
      }

      .module-link-index {
        display: block;
        margin-bottom: 3px;
        font-size: 11px;
        color: var(--accent);
      }

      .module-link-label {
        display: block;
        font-weight: 600;
        font-size: 13px;
        line-height: 1.25;
      }

      .content {
        display: grid;
        gap: 16px;
      }

      .hero {
        padding: 24px;
        border: 1px solid var(--line);
        border-radius: 24px;
        background: rgba(255, 250, 241, 0.96);
        box-shadow: 0 18px 60px rgba(70, 44, 24, 0.08);
      }

      .modules {
        display: grid;
        gap: 16px;
      }

      .module-card {
        padding: 22px;
        border-radius: 22px;
        border: 1px solid var(--line);
        background: rgba(255, 250, 241, 0.95);
        box-shadow: 0 14px 42px rgba(70, 44, 24, 0.07);
        scroll-margin-top: 18px;
      }

      .module-heading {
        display: grid;
        gap: 8px;
      }

      .module-number {
        color: var(--accent);
        font-weight: 600;
      }

      .resource-group {
        margin-top: 18px;
      }

      .resource-group + .resource-group {
        margin-top: 18px;
      }

      .resource-group-title {
        margin: 0 0 10px;
        font-size: 16px;
      }

      .resource-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 12px;
      }

      .resource-card {
        padding: 14px 16px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: var(--paper-2);
      }

      .resource-card h3 {
        margin: 8px 0 8px;
        font-size: 18px;
        font-family: Georgia, "Times New Roman", serif;
      }

      .resource-link {
        color: var(--ink);
        text-decoration: none;
        transition: color 160ms ease;
      }

      .resource-link:hover {
        color: var(--accent);
      }

      .resource-description {
        margin: 0 0 12px;
        font-size: 14px;
      }

      .resource-meta {
        font-size: 13px;
        opacity: 0.8;
      }

      .resource-actions {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        margin-top: 12px;
      }

      .note-trigger {
        appearance: none;
        border: 1px solid rgba(181, 106, 60, 0.28);
        background: rgba(255, 250, 241, 0.92);
        color: var(--ink);
        border-radius: 999px;
        padding: 7px 12px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        transition: border-color 160ms ease, background-color 160ms ease;
      }

      .note-trigger:hover {
        border-color: rgba(181, 106, 60, 0.55);
        background: #fff7ee;
      }

      .note-editor {
        display: none;
        gap: 10px;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid var(--line);
      }

      .note-editor.is-open {
        display: grid;
      }

      .note-editor-label {
        font-size: 13px;
        font-weight: 600;
        color: var(--muted);
      }

      .note-editor-input {
        width: 100%;
        min-height: 200px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 14px;
        font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        color: var(--ink);
        background: rgba(255, 250, 241, 0.96);
      }

      .note-editor-input:focus {
        outline: 2px solid rgba(181, 106, 60, 0.2);
        border-color: rgba(181, 106, 60, 0.45);
      }

      .note-status {
        font-size: 12px;
        color: var(--muted);
        min-height: 1.2em;
      }

      .extra-links {
        display: grid;
        gap: 8px;
        margin: 0;
        padding: 0;
        list-style: none;
      }

      .extra-link-item {
        display: grid;
        gap: 4px;
        padding: 10px 0;
        border-top: 1px solid var(--line);
      }

      .extra-link-item:first-child {
        padding-top: 0;
        border-top: 0;
      }

      .extra-link-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        min-width: 0;
      }

      .extra-link-main {
        display: flex;
        align-items: center;
        gap: 8px;
        min-width: 0;
        flex: 1;
      }

      .extra-link-actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }

      .extra-link-title {
        min-width: 0;
        font-weight: 600;
        color: var(--ink);
        text-decoration: none;
      }

      .extra-link-title:hover {
        color: var(--accent);
      }

      .extra-link-description {
        margin: 0;
        font-size: 13px;
        color: var(--muted);
      }

      @media (max-width: 980px) {
        .page {
          grid-template-columns: 160px minmax(0, 1fr);
        }
      }

      @media (max-width: 760px) {
        .page {
          grid-template-columns: 1fr;
        }

        .sidebar {
          position: static;
          max-height: none;
        }

        .resource-actions,
        .extra-link-row {
          display: grid;
        }

        .extra-link-actions {
          justify-content: flex-start;
        }
      }
    </style>
  </head>
  <body>
    <div class="page">
      <aside class="sidebar">
        <div class="toc-title">Contents</div>
        ${renderModuleNav(tutorial)}
      </aside>
      <main class="content">
        <section class="hero">
          <h1>${escapeHtml(tutorial.title)}</h1>
          <p class="meta-copy">${escapeHtml(tutorial.description)}</p>
          ${renderStats(tutorial)}
        </section>
        <div class="modules">
          ${tutorial.modules.map((module, index) => renderModule(module, index)).join("")}
        </div>
      </main>
    </div>
    <script>
      const noteEditorState = new WeakMap();

      document.addEventListener("click", (event) => {
        const noteButton = event.target.closest("button[data-note-trigger]");
        if (noteButton) {
          toggleNoteEditor(noteButton);
          return;
        }

        const link = event.target.closest("a[data-track-resource]");
        if (!link) {
          return;
        }

        const payload = {
          moduleId: link.dataset.moduleId,
          moduleTitle: link.dataset.moduleTitle,
          resourceType: link.dataset.resourceType,
          resourceTitle: link.dataset.resourceTitle,
          resourceUrl: link.dataset.resourceUrl,
        };

        fetch("/api/link-context", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify(payload),
          keepalive: true,
        }).catch(() => {
          // The site should still open the resource even if the local relay is unavailable.
        });
      });

      document.addEventListener("input", (event) => {
        const input = event.target.closest("textarea[data-note-input]");
        if (!input) {
          return;
        }

        queueNoteSave(input);
      });

      document.addEventListener("keydown", (event) => {
        const input = event.target.closest("textarea[data-note-input]");
        if (!input || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }

        continueMarkdownList(input, event);
      });

      async function toggleNoteEditor(button) {
        const resourceContainer = button.closest(".resource-card, .extra-link-item");
        const editor = resourceContainer?.querySelector(".note-editor");
        if (!editor) {
          return;
        }

        const isOpen = editor.classList.toggle("is-open");
        button.textContent = isOpen ? "Hide notes" : "Take notes";

        if (!isOpen) {
          return;
        }

        const input = editor.querySelector("textarea[data-note-input]");
        const status = editor.querySelector("[data-note-status]");

        if (!input || input.dataset.loaded === "true") {
          input?.focus();
          return;
        }

        setNoteStatus(status, "Loading...");

        try {
          const params = new URLSearchParams({
            file: input.dataset.noteFile,
            resourceTitle: input.dataset.resourceTitle,
            resourceUrl: input.dataset.resourceUrl,
          });
          const response = await fetch("/api/notes?" + params.toString());
          if (!response.ok) {
            throw new Error("Could not load note.");
          }

          const payload = await response.json();
          input.value = payload.body;
          input.dataset.template = payload.template;
          input.dataset.loaded = "true";
          setNoteStatus(status, payload.exists ? "Loaded saved notes." : "Autosaves after you start writing.");
          input.focus();
        } catch {
          setNoteStatus(status, "Could not load notes.");
        }
      }

      function queueNoteSave(input) {
        let state = noteEditorState.get(input);
        if (!state) {
          state = { timer: null, saving: false };
          noteEditorState.set(input, state);
        }

        const editor = input.closest(".note-editor");
        const status = editor?.querySelector("[data-note-status]");
        setNoteStatus(status, "Saving...");

        if (state.timer) {
          clearTimeout(state.timer);
        }

        state.timer = setTimeout(() => {
          saveNote(input, status, state);
        }, 700);
      }

      async function saveNote(input, status, state) {
        if (state.saving) {
          return;
        }

        state.saving = true;

        try {
          const response = await fetch("/api/notes", {
            method: "PUT",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({
              fileName: input.dataset.noteFile,
              body: input.value,
              resourceTitle: input.dataset.resourceTitle,
              resourceUrl: input.dataset.resourceUrl,
            }),
          });

          if (!response.ok) {
            throw new Error("Save failed.");
          }

          const payload = await response.json();
          input.dataset.loaded = "true";
          setNoteStatus(status, payload.saved ? "Saved." : "No notes yet. File not created.");
        } catch {
          setNoteStatus(status, "Save failed.");
        } finally {
          state.saving = false;
        }
      }

      function setNoteStatus(element, text) {
        if (element) {
          element.textContent = text;
        }
      }

      function continueMarkdownList(input, event) {
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        const lineStart = input.value.lastIndexOf("\\n", selectionStart - 1) + 1;
        const lineEnd = input.value.indexOf("\\n", selectionEnd);
        const currentLine = input.value.slice(lineStart, lineEnd === -1 ? input.value.length : lineEnd);

        const unorderedMatch = currentLine.match(/^(\\s*)([-*])\\s+(.*)$/);
        if (unorderedMatch) {
          event.preventDefault();
          const [, indent, marker, text] = unorderedMatch;
          const insertion = text.trim() === "" ? "\\n" : "\\n" + indent + marker + " ";
          insertAtSelection(input, insertion);
          queueNoteSave(input);
          return;
        }

        const orderedMatch = currentLine.match(/^(\\s*)(\\d+)\\.\\s+(.*)$/);
        if (!orderedMatch) {
          return;
        }

        event.preventDefault();
        const [, indent, number, text] = orderedMatch;
        const insertion = text.trim() === "" ? "\\n" : "\\n" + indent + String(Number(number) + 1) + ". ";
        insertAtSelection(input, insertion);
        queueNoteSave(input);
      }

      function insertAtSelection(input, text) {
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        input.setRangeText(text, selectionStart, selectionEnd, "end");
      }
    </script>
  </body>
</html>
`;
}

function renderStats(tutorial) {
  const totalSections = tutorial.modules.reduce((sum, module) => sum + module.sections.length, 0);
  const totalAdditional = tutorial.modules.reduce(
    (sum, module) => sum + module["aditional-links"].length,
    0
  );

  return `
    <div class="stats">
      <div class="stat">
        <span class="stat-value">${tutorial.modules.length}</span>
        <span class="stat-label">Modules</span>
      </div>
      <div class="stat">
        <span class="stat-value">${totalSections}</span>
        <span class="stat-label">Core resources</span>
      </div>
      <div class="stat">
        <span class="stat-value">${totalAdditional}</span>
        <span class="stat-label">Extra links</span>
      </div>
    </div>
  `;
}

function renderModuleNav(tutorial) {
  return `
    <div class="nav-title">Modules</div>
    <nav class="module-links">
      ${tutorial.modules
        .map(
          (module, index) => `
            <a class="module-link" href="#${escapeHtml(module.id)}">
              <span class="module-link-index">Module ${String(index + 1).padStart(2, "0")}</span>
              <span class="module-link-label">${escapeHtml(module.title)}</span>
            </a>
          `
        )
        .join("")}
    </nav>
  `;
}

function renderModule(module, index) {
  return `
    <section class="module-card" id="${escapeHtml(module.id)}">
      <div class="module-heading">
        <div class="module-number">Module ${String(index + 1).padStart(2, "0")}</div>
        <h2>${escapeHtml(module.title)}</h2>
        <p class="module-description">${escapeHtml(module.description)}</p>
      </div>
      <div class="resource-group">
        <h3 class="resource-group-title">Core path</h3>
        <p class="section-note">Start here. These are the main resources intended to carry the lesson.</p>
        <div class="resource-grid">
          ${module.sections.map((section) => renderResourceCard(module, section, index)).join("")}
        </div>
      </div>
      ${
        module["aditional-links"].length > 0
          ? `
            <div class="resource-group">
              <h3 class="resource-group-title">Additional links</h3>
              <ul class="extra-links">
                ${module["aditional-links"].map((section, additionalIndex) => renderAdditionalLink(module, section, index, additionalIndex)).join("")}
              </ul>
            </div>
          `
          : ""
      }
    </section>
  `;
}

function renderResourceCard(module, resource, moduleIndex) {
  const noteFileName = getCoreNoteFileName(moduleIndex, resource.type);
  return `
    <article class="resource-card">
      <span class="resource-type">${escapeHtml(resource.type)}</span>
      <h3><a class="resource-link" href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer" data-track-resource="true" data-module-id="${escapeHtml(module.id)}" data-module-title="${escapeHtml(module.title)}" data-resource-type="${escapeHtml(resource.type)}" data-resource-title="${escapeHtml(resource.title)}" data-resource-url="${escapeHtml(resource.url)}">${escapeHtml(resource.title)}</a></h3>
      <p class="resource-description">${escapeHtml(resource.description)}</p>
      <div class="resource-actions">
        <div class="resource-meta">Primary learning path</div>
        <button class="note-trigger" type="button" data-note-trigger="true">Take notes</button>
      </div>
      ${renderNoteEditor(noteFileName, resource)}
    </article>
  `;
}

function renderAdditionalLink(module, resource, moduleIndex, additionalIndex) {
  const noteFileName = getAdditionalNoteFileName(moduleIndex, additionalIndex);
  return `
    <li class="extra-link-item">
      <div class="extra-link-row">
        <div class="extra-link-main">
          <a class="extra-link-title" href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer" data-track-resource="true" data-module-id="${escapeHtml(module.id)}" data-module-title="${escapeHtml(module.title)}" data-resource-type="${escapeHtml(resource.type)}" data-resource-title="${escapeHtml(resource.title)}" data-resource-url="${escapeHtml(resource.url)}">${escapeHtml(resource.title)}</a>
        </div>
        <div class="extra-link-actions">
          <span class="resource-type">${escapeHtml(resource.type)}</span>
          <button class="note-trigger" type="button" data-note-trigger="true">Take notes</button>
        </div>
      </div>
      <p class="extra-link-description">${escapeHtml(resource.description)}</p>
      ${renderNoteEditor(noteFileName, resource)}
    </li>
  `;
}

function renderNoteEditor(noteFileName, resource) {
  return `
    <div class="note-editor">
      <label class="note-editor-label" for="${escapeHtml(noteFileName)}">Markdown notes</label>
      <textarea class="note-editor-input" id="${escapeHtml(noteFileName)}" data-note-input="true" data-note-file="${escapeHtml(noteFileName)}" data-resource-title="${escapeHtml(resource.title)}" data-resource-url="${escapeHtml(resource.url)}" data-loaded="false"></textarea>
      <div class="note-status" data-note-status="true"></div>
    </div>
  `;
}

function getCoreNoteFileName(moduleIndex, resourceType) {
  return `mod${moduleIndex + 1}_${resourceType}.md`;
}

function getAdditionalNoteFileName(moduleIndex, additionalIndex) {
  return `mod${moduleIndex + 1}_res${additionalIndex + 1}.md`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

module.exports = {
  generateTutorialSite,
  renderTutorialSite,
};
