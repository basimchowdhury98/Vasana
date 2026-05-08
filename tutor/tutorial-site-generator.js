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

      .resource-action-buttons {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
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

      .ai-trigger {
        appearance: none;
        border: 1px solid rgba(181, 106, 60, 0.28);
        background: var(--accent);
        color: #fffaf1;
        border-radius: 999px;
        padding: 7px 12px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        transition: filter 160ms ease, transform 160ms ease;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 36px;
        min-width: 36px;
        height: 36px;
        padding: 0;
      }

      .ai-trigger:hover {
        filter: brightness(1.06);
        transform: translateY(-1px);
      }

      .ai-trigger svg {
        width: 17px;
        height: 17px;
        display: block;
        pointer-events: none;
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

      .chat-modal {
        position: fixed;
        inset: 0;
        display: none;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(39, 27, 16, 0.42);
        backdrop-filter: blur(3px);
        z-index: 1000;
      }

      .chat-modal.is-open {
        display: flex;
      }

      .chat-dialog {
        width: min(760px, 100%);
        max-height: min(86vh, 900px);
        display: grid;
        grid-template-rows: auto minmax(0, 1fr) auto;
        background: rgba(255, 250, 241, 0.98);
        border: 1px solid var(--line);
        border-radius: 24px;
        box-shadow: 0 22px 80px rgba(39, 27, 16, 0.24);
        overflow: hidden;
      }

      .chat-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 20px 14px;
        border-bottom: 1px solid var(--line);
        background: linear-gradient(180deg, rgba(240, 220, 205, 0.62), rgba(255, 250, 241, 0));
      }

      .chat-kicker {
        margin: 0 0 6px;
        font-size: 11px;
        font-weight: 700;
        color: var(--accent);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .chat-title {
        margin: 0;
        font-size: 22px;
      }

      .chat-subtitle {
        margin: 6px 0 0;
        font-size: 13px;
        color: var(--muted);
      }

      .chat-close {
        appearance: none;
        border: 1px solid var(--line);
        background: rgba(255, 250, 241, 0.94);
        color: var(--ink);
        border-radius: 999px;
        padding: 7px 12px;
        font: inherit;
        cursor: pointer;
      }

      .chat-body {
        overflow: auto;
        padding: 18px 20px;
        display: grid;
        gap: 12px;
        background: linear-gradient(180deg, rgba(248, 241, 231, 0.3), rgba(255, 250, 241, 0));
      }

      .chat-empty,
      .chat-status {
        font-size: 13px;
        color: var(--muted);
      }

      .chat-message {
        display: grid;
        gap: 6px;
        justify-items: start;
      }

      .chat-message[data-role="user"] {
        justify-items: end;
      }

      .chat-message-role {
        font-size: 11px;
        font-weight: 700;
        color: var(--muted);
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .chat-bubble {
        max-width: min(560px, 100%);
        padding: 12px 14px;
        border-radius: 18px;
        border: 1px solid var(--line);
        background: rgba(248, 241, 231, 0.95);
        white-space: pre-wrap;
        line-height: 1.5;
      }

      .chat-message[data-role="user"] .chat-bubble {
        background: rgba(181, 106, 60, 0.12);
        border-color: rgba(181, 106, 60, 0.2);
      }

      .chat-footer {
        display: grid;
        gap: 10px;
        padding: 14px 20px 20px;
        border-top: 1px solid var(--line);
        background: rgba(255, 250, 241, 0.98);
      }

      .chat-form-row {
        display: grid;
        grid-template-columns: minmax(0, 1fr) auto;
        gap: 10px;
        align-items: end;
      }

      .chat-input {
        width: 100%;
        min-height: 92px;
        max-height: 220px;
        resize: vertical;
        border: 1px solid var(--line);
        border-radius: 16px;
        padding: 12px 14px;
        font: inherit;
        color: var(--ink);
        background: rgba(255, 250, 241, 0.96);
      }

      .chat-input:focus {
        outline: 2px solid rgba(181, 106, 60, 0.2);
        border-color: rgba(181, 106, 60, 0.45);
      }

      .chat-send {
        appearance: none;
        border: 0;
        background: var(--accent);
        color: #fffaf1;
        border-radius: 999px;
        padding: 10px 16px;
        font: inherit;
        cursor: pointer;
      }

      .chat-send:disabled,
      .chat-input:disabled,
      .chat-close:disabled {
        opacity: 0.6;
        cursor: not-allowed;
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

        .chat-modal {
          padding: 0;
        }

        .chat-dialog {
          width: 100%;
          max-height: 100vh;
          height: 100vh;
          border-radius: 0;
        }

        .chat-form-row {
          grid-template-columns: 1fr;
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
    ${renderChatModal()}
    <script>
      const noteEditorState = new WeakMap();
      const chatState = {
        activeKey: "",
        loading: false,
        sending: false,
      };
      const chatModal = document.querySelector("[data-chat-modal]");
      const chatTitle = document.querySelector("[data-chat-title]");
      const chatSubtitle = document.querySelector("[data-chat-subtitle]");
      const chatBody = document.querySelector("[data-chat-body]");
      const chatStatus = document.querySelector("[data-chat-status]");
      const chatForm = document.querySelector("[data-chat-form]");
      const chatInput = document.querySelector("[data-chat-input]");
      const chatSend = document.querySelector("[data-chat-send]");

      document.addEventListener("click", (event) => {
        const target = getEventElement(event);
        if (!target) {
          return;
        }

        const noteButton = target.closest("button[data-note-trigger]");
        if (noteButton) {
          toggleNoteEditor(noteButton);
          return;
        }

        const aiButton = target.closest("button[data-ai-trigger]");
        if (aiButton) {
          openChatModal(aiButton);
          return;
        }

        const closeButton = target.closest("button[data-chat-close]");
        if (closeButton || target === chatModal) {
          closeChatModal();
          return;
        }

        const link = target.closest("a[data-track-resource]");
        if (!link) {
          return;
        }

        event.preventDefault();
        void openResourceWindow(link);
      });

      document.addEventListener("input", (event) => {
        const target = getEventElement(event);
        const input = target?.closest("textarea[data-note-input]");
        if (!input) {
          return;
        }

        queueNoteSave(input);
      });

      document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && chatModal.classList.contains("is-open")) {
          closeChatModal();
          return;
        }

        const chatComposer = getEventElement(event)?.closest("textarea[data-chat-input]");
        if (chatComposer) {
          if (event.key === "Enter" && !event.shiftKey && !event.altKey && !event.ctrlKey && !event.metaKey) {
            event.preventDefault();
            void submitChatMessage();
            return;
          }

          if (event.key.toLowerCase() === "c" && event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey) {
            event.preventDefault();
            chatComposer.value = "";
            setChatStatus("Cleared draft.");
            return;
          }
        }

        const target = getEventElement(event);
        const input = target?.closest("textarea[data-note-input]");
        if (!input || event.key !== "Enter" || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) {
          return;
        }

        continueMarkdownList(input, event);
      });

      chatForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        await submitChatMessage();
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
          if (input.dataset.legacyNoteFile) {
            params.set("legacyFile", input.dataset.legacyNoteFile);
          }
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

      async function openChatModal(button) {
        const resource = {
          key: button.dataset.chatKey,
          moduleTitle: button.dataset.moduleTitle || "Module",
          resourceTitle: button.dataset.resourceTitle || "Resource",
          resourceType: button.dataset.resourceType || "resource",
        };

        chatState.activeKey = resource.key;
        chatTitle.textContent = resource.resourceTitle;
        chatSubtitle.textContent = resource.moduleTitle + " - " + resource.resourceType;
        chatModal.classList.add("is-open");
        document.body.style.overflow = "hidden";
        renderChatMessages([]);
        setChatStatus("Loading chat...");
        setChatUiBusy(true);

        try {
          const response = await fetch("/api/chat/open", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ key: resource.key }),
          });

          if (!response.ok) {
            throw new Error("Could not open chat.");
          }

          const payload = await response.json();
          if (chatState.activeKey !== resource.key) {
            return;
          }

          renderChatMessages(Array.isArray(payload.transcript) ? payload.transcript : []);
          setChatStatus("Session saved in oc_sessions and restored when reopened.");
          chatInput.focus();
        } catch {
          renderChatMessages([]);
          setChatStatus("Could not open chat.");
        } finally {
          if (chatState.activeKey === resource.key) {
            setChatUiBusy(false);
          }
        }
      }

      function closeChatModal() {
        chatModal.classList.remove("is-open");
        document.body.style.overflow = "";
        chatState.activeKey = "";
        chatState.loading = false;
        chatState.sending = false;
      }

      function renderChatMessages(messages) {
        if (!Array.isArray(messages) || messages.length === 0) {
          chatBody.innerHTML = '<div class="chat-empty">Ask about the current resource, request a summary, or dig into a confusing section.</div>';
          return;
        }

        chatBody.innerHTML = messages.map(renderChatMessage).join("");
        chatBody.scrollTop = chatBody.scrollHeight;
      }

      function renderChatMessage(message) {
        const role = message.role === "assistant" ? "assistant" : "user";
        const label = role === "assistant" ? "AI" : "You";
        return [
          '<div class="chat-message" data-role="' + role + '">',
          '  <div class="chat-message-role">' + label + '</div>',
          '  <div class="chat-bubble">' + escapeHtml(message.text || "") + '</div>',
          '</div>',
        ].join("\\n");
      }

      function appendChatMessages(messages) {
        const existing = chatBody.querySelector(".chat-empty");
        if (existing) {
          chatBody.innerHTML = "";
        }

        const markup = messages.map(renderChatMessage).join("");
        chatBody.insertAdjacentHTML("beforeend", markup);
        chatBody.scrollTop = chatBody.scrollHeight;
      }

      async function submitChatMessage() {
        const key = chatState.activeKey;
        const text = chatInput.value.trim();
        if (!key || !text || chatState.sending) {
          return;
        }

        chatState.sending = true;
        setChatUiBusy(true);
        setChatStatus("Waiting for AI...");

        try {
          const response = await fetch("/api/chat/message", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ key, text }),
          });

          if (!response.ok) {
            throw new Error("Could not send message.");
          }

          const payload = await response.json();
          if (chatState.activeKey !== key) {
            return;
          }

          appendChatMessages(Array.isArray(payload.messages) ? payload.messages : []);
          chatInput.value = "";
          setChatStatus("Saved.");
          chatInput.focus();
        } catch {
          setChatStatus("Message failed.");
        } finally {
          if (chatState.activeKey === key) {
            chatState.sending = false;
            setChatUiBusy(false);
          }
        }
      }

      function setChatUiBusy(isBusy) {
        chatState.loading = isBusy;
        chatInput.disabled = isBusy;
        chatSend.disabled = isBusy;
      }

      function setChatStatus(text) {
        chatStatus.textContent = text;
      }

      function getEventElement(event) {
        return event.target instanceof Element ? event.target : null;
      }

      async function openResourceWindow(link) {
        const key = link.dataset.resourceKey;
        if (!key) {
          return;
        }

        try {
          const response = await fetch("/api/resource/open", {
            method: "POST",
            headers: {
              "content-type": "application/json",
            },
            body: JSON.stringify({ key }),
          });

          if (!response.ok) {
            throw new Error("Could not open resource.");
          }
        } catch {
          window.alert("Could not open this resource in your default browser.");
        }
      }

      function escapeHtml(value) {
        return String(value)
          .replaceAll("&", "&amp;")
          .replaceAll("<", "&lt;")
          .replaceAll(">", "&gt;")
          .replaceAll('"', "&quot;")
          .replaceAll("'", "&#39;");
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
  const coreResources = enumerateResourcesByType(module.sections);
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
          ${coreResources
            .map(({ resource, typeIndex }) => renderResourceCard(module, resource, index, typeIndex))
            .join("")}
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

function renderResourceCard(module, resource, moduleIndex, typeIndex) {
  const noteFileName = getCoreNoteFileName(moduleIndex, resource.type, typeIndex);
  const legacyNoteFileName = getLegacyCoreNoteFileName(moduleIndex, resource.type, typeIndex);
  const resourceKey = getCoreResourceKey(moduleIndex, resource.type, typeIndex);
  return `
    <article class="resource-card">
      <span class="resource-type">${escapeHtml(resource.type)}</span>
      <h3><a class="resource-link" href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer" data-track-resource="true" data-resource-key="${escapeHtml(resourceKey)}" data-module-id="${escapeHtml(module.id)}" data-module-title="${escapeHtml(module.title)}" data-resource-type="${escapeHtml(resource.type)}" data-resource-title="${escapeHtml(resource.title)}" data-resource-url="${escapeHtml(resource.url)}">${escapeHtml(resource.title)}</a></h3>
      <p class="resource-description">${escapeHtml(resource.description)}</p>
      <div class="resource-actions">
        <div class="resource-meta">Primary learning path</div>
        <div class="resource-action-buttons">
          ${renderChatTrigger(module, resource, resourceKey)}
          <button class="note-trigger" type="button" data-note-trigger="true">Take notes</button>
        </div>
      </div>
      ${renderNoteEditor(noteFileName, resource, legacyNoteFileName)}
    </article>
  `;
}

function renderAdditionalLink(module, resource, moduleIndex, additionalIndex) {
  const noteFileName = getAdditionalNoteFileName(moduleIndex, additionalIndex);
  const resourceKey = getAdditionalResourceKey(moduleIndex, additionalIndex);
  return `
    <li class="extra-link-item">
      <div class="extra-link-row">
        <div class="extra-link-main">
          <a class="extra-link-title" href="${escapeHtml(resource.url)}" target="_blank" rel="noreferrer" data-track-resource="true" data-resource-key="${escapeHtml(resourceKey)}" data-module-id="${escapeHtml(module.id)}" data-module-title="${escapeHtml(module.title)}" data-resource-type="${escapeHtml(resource.type)}" data-resource-title="${escapeHtml(resource.title)}" data-resource-url="${escapeHtml(resource.url)}">${escapeHtml(resource.title)}</a>
        </div>
        <div class="extra-link-actions">
          <span class="resource-type">${escapeHtml(resource.type)}</span>
          ${renderChatTrigger(module, resource, resourceKey)}
          <button class="note-trigger" type="button" data-note-trigger="true">Take notes</button>
        </div>
      </div>
      <p class="extra-link-description">${escapeHtml(resource.description)}</p>
      ${renderNoteEditor(noteFileName, resource)}
    </li>
  `;
}

function renderNoteEditor(noteFileName, resource, legacyNoteFileName = "") {
  const legacyAttribute = legacyNoteFileName
    ? ` data-legacy-note-file="${escapeHtml(legacyNoteFileName)}"`
    : "";
  return `
    <div class="note-editor">
      <label class="note-editor-label" for="${escapeHtml(noteFileName)}">Markdown notes</label>
      <textarea class="note-editor-input" id="${escapeHtml(noteFileName)}" data-note-input="true" data-note-file="${escapeHtml(noteFileName)}"${legacyAttribute} data-resource-title="${escapeHtml(resource.title)}" data-resource-url="${escapeHtml(resource.url)}" data-loaded="false"></textarea>
      <div class="note-status" data-note-status="true"></div>
    </div>
  `;
}

function renderChatTrigger(module, resource, resourceKey) {
  return `<button class="ai-trigger" type="button" aria-label="Open AI chat for ${escapeHtml(resource.title)}" title="Open AI chat" data-ai-trigger="true" data-chat-key="${escapeHtml(resourceKey)}" data-module-title="${escapeHtml(module.title)}" data-resource-title="${escapeHtml(resource.title)}" data-resource-type="${escapeHtml(resource.type)}"><svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path fill="currentColor" d="M12 2l1.8 4.7L18.5 8l-4.7 1.3L12 14l-1.8-4.7L5.5 8l4.7-1.3L12 2zm6.5 9l.9 2.6L22 14.5l-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9.9-2.6zM6 13l1.2 3.3L10.5 17l-3.3 1.2L6 21.5l-1.2-3.3L1.5 17l3.3-1.2L6 13z"/></svg></button>`;
}

function getCoreNoteFileName(moduleIndex, resourceType, typeIndex) {
  return `mod${moduleIndex + 1}_${resourceType}${typeIndex}.md`;
}

function getLegacyCoreNoteFileName(moduleIndex, resourceType, typeIndex) {
  return typeIndex === 1 ? `mod${moduleIndex + 1}_${resourceType}.md` : "";
}

function getAdditionalNoteFileName(moduleIndex, additionalIndex) {
  return `mod${moduleIndex + 1}_res${additionalIndex + 1}.md`;
}

function getCoreResourceKey(moduleIndex, resourceType, typeIndex) {
  return `mod${moduleIndex + 1}_${resourceType}${typeIndex}`;
}

function getAdditionalResourceKey(moduleIndex, additionalIndex) {
  return `mod${moduleIndex + 1}_res${additionalIndex + 1}`;
}

function enumerateResourcesByType(resources) {
  const counts = new Map();
  return resources.map((resource) => {
    const type = typeof resource?.type === "string" && resource.type.trim() !== "" ? resource.type : "resource";
    const typeIndex = (counts.get(type) || 0) + 1;
    counts.set(type, typeIndex);
    return {
      resource,
      typeIndex,
    };
  });
}

function renderChatModal() {
  return `
    <div class="chat-modal" data-chat-modal="true" aria-hidden="true">
      <div class="chat-dialog" role="dialog" aria-modal="true" aria-labelledby="chat-title">
        <div class="chat-header">
          <div>
            <div class="chat-kicker">Resource chat</div>
            <h2 class="chat-title" id="chat-title" data-chat-title="true">AI chat</h2>
            <p class="chat-subtitle" data-chat-subtitle="true"></p>
          </div>
          <button class="chat-close" type="button" data-chat-close="true">Close</button>
        </div>
        <div class="chat-body" data-chat-body="true">
          <div class="chat-empty">Ask about the current resource, request a summary, or dig into a confusing section.</div>
        </div>
        <div class="chat-footer">
          <div class="chat-status" data-chat-status="true"></div>
          <form data-chat-form="true">
            <div class="chat-form-row">
              <textarea class="chat-input" data-chat-input="true" placeholder="Ask a question about this resource..." spellcheck="true"></textarea>
              <button class="chat-send" type="submit" data-chat-send="true">Send</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `;
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
