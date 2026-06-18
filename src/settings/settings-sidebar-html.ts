export function getSettingsHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><style>
* { box-sizing: border-box; }
body { height:100%; margin:0; padding:0; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); display:flex; flex-direction:column; overflow:hidden; }
.header { padding:8px; display:flex; align-items:center; gap:6px; flex-shrink:0; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.header strong { font-size:12px; white-space:nowrap; flex:1; min-width:0; }
.header-actions { display:flex; gap:2px; flex-shrink:0; }
.header button { padding:2px 2px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.7; white-space:nowrap; }
.header button:hover { opacity:1; }
.scroll { flex:1; overflow-y:auto; }
.section { padding:10px 12px; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.section h3 { font-size:11px; text-transform:uppercase; letter-spacing:0.5px; opacity:0.7; margin:0 0 8px 0; font-weight:600; display:flex; align-items:center; gap:6px; }
.section h3 .dirty { color:var(--vscode-charts-orange,#e0af68); font-size:14px; line-height:1; }
.kv { display:grid; grid-template-columns:auto 1fr auto; gap:4px 10px; align-items:center; }
.kv .k { opacity:0.7; font-size:12px; white-space:nowrap; }
.kv .v { font-family:var(--vscode-editor-font-family,monospace); font-size:12px; word-break:break-all; min-width:0; }
.kv .v.placeholder { opacity:0.5; font-style:italic; }
.kv .v.with-action { display:flex; align-items:center; gap:6px; }
.kv .v.with-action .v-text { flex:1; min-width:0; word-break:break-all; }
.kv .inline-btn { padding:1px 6px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.7; white-space:nowrap; flex-shrink:0; }
.kv .inline-btn:hover { opacity:1; background:var(--vscode-toolbar-hoverBackground); }
.kv .inline-btn.primary { background:var(--vscode-button-background); color:var(--vscode-button-foreground); border-color:transparent; opacity:1; }
.kv .inline-btn.primary:hover { background:var(--vscode-button-hoverBackground); }
.kv .copy-btn { padding:1px 6px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.6; }
.kv .copy-btn:hover { opacity:1; background:var(--vscode-toolbar-hoverBackground); }
.row { display:flex; align-items:center; gap:8px; padding:4px 0; }
.row a { color:var(--vscode-textLink-foreground); text-decoration:none; word-break:break-all; }
.row a:hover { text-decoration:underline; }
.row .icon { width:18px; text-align:center; flex-shrink:0; display:inline-flex; align-items:center; justify-content:center; }
.row .icon svg { width:14px; height:14px; fill:currentColor; }
.btn { padding:4px 10px; cursor:pointer; background:var(--vscode-button-background); color:var(--vscode-button-foreground); border:none; border-radius:3px; font-size:12px; font-family:inherit; }
.btn:hover { background:var(--vscode-button-hoverBackground); }
.btn.secondary { background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.btn.secondary:hover { background:var(--vscode-toolbar-hoverBackground); }
.btn.primary.modified { box-shadow:0 0 0 1px var(--vscode-charts-orange,#e0af68); }
.btn-block { display:block; width:100%; text-align:left; }
.action-row { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
.hint { font-size:11px; opacity:0.65; margin:2px 0 6px 0; word-break:break-all; }
.hint code { font-family:var(--vscode-editor-font-family,monospace); background:var(--vscode-textBlockQuote-background,rgba(127,127,127,0.1)); padding:1px 4px; border-radius:2px; font-size:11px; }
.warn { padding:6px 8px; margin:0 0 6px 0; background:rgba(224,175,104,0.12); border-left:3px solid var(--vscode-charts-orange,#e0af68); color:var(--vscode-charts-orange,#e0af68); font-size:11px; line-height:1.4; border-radius:2px; }
.warn strong { color:var(--vscode-charts-orange,#e0af68); }
textarea { width:100%; min-height:140px; resize:vertical; box-sizing:border-box; font-family:var(--vscode-editor-font-family,monospace); font-size:12px; line-height:1.4; padding:6px 8px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-input-border,var(--vscode-widget-border,transparent)); border-radius:3px; outline:none; }
textarea:focus { border-color:var(--vscode-focusBorder); }
.error { padding:6px 10px; background:var(--vscode-inputValidation-errorBackground,#5a1d1d); color:var(--vscode-inputValidation-errorForeground,#fff); border:1px solid var(--vscode-inputValidation-errorBorder,transparent); border-radius:3px; font-size:12px; margin:8px 12px; }
.action-link { background:none; border:none; padding:0; color:var(--vscode-textLink-foreground); cursor:pointer; font-family:inherit; font-size:12px; text-decoration:none; }
.action-link:hover { text-decoration:underline; }
.toast { position:fixed; bottom:10px; left:50%; transform:translateX(-50%); background:var(--vscode-notifications-background,#252526); color:var(--vscode-notifications-foreground,#cccccc); border:1px solid var(--vscode-widget-border,transparent); padding:4px 10px; border-radius:3px; font-size:11px; opacity:0; transition:opacity 0.15s; pointer-events:none; z-index:10; }
.toast.show { opacity:1; }
</style></head>
<body>
<div class="header">
  <strong>Settings</strong>
  <div class="header-actions">
    <button id="btn-open-settings-json" data-action="open-settings-json" title="Open ~/.pi/agent/settings.json">📝</button>
    <button data-action="refresh" title="Refresh">↻</button>
  </div>
</div>
<div class="scroll" id="scroll">
  <div id="error-host"></div>

  <div class="section">
    <h3>Environment</h3>
    <div class="kv" id="env-kv">
      <div class="k">Pi version</div><div class="v with-action"><span class="v-text placeholder" id="env-pi-version">Loading…</span></div><div><button class="inline-btn primary" data-action="upgrade" title="Reinstall the pi CLI globally to the latest version">⬆ Upgrade</button></div>
      <div class="k">Pi path</div><div class="v" id="env-pi-path">…</div><div><button class="copy-btn" data-action="copy-pi-path" title="Copy">⧉</button></div>
      <div class="k">pi-vscode</div><div class="v" id="env-ext-version">…</div><div></div>
      <div class="k">Node</div><div class="v" id="env-node-version">…</div><div></div>
    </div>
  </div>

  <div class="section">
    <h3>Links</h3>
    <div class="row"><span class="icon">🌐</span><a id="link-home" href="https://pi.dev" target="_blank" rel="noopener" title="https://pi.dev">Pi Website</a></div>
    <div class="row"><span class="icon">📦</span><a id="link-packages" href="https://pi.dev/packages" target="_blank" rel="noopener" title="https://pi.dev/packages">Pi Packages</a></div>
    <div class="row"><span class="icon"><svg viewBox="0 0 16 16" aria-hidden="true"><path fill-rule="evenodd" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg></span><a id="link-github" href="https://github.com/JohnnyZ93/pi-vscode" target="_blank" rel="noopener" title="https://github.com/JohnnyZ93/pi-vscode">pi-vscode on GitHub</a></div>
  </div>

  <div class="section">
    <h3>System Prompt — Append <span class="dirty" id="dirty-append" style="display:none" title="Unsaved changes">●</span></h3>
    <div class="hint">Appends to the default system prompt without replacing. File: <code id="path-append">…</code></div>
    <textarea id="ta-append" placeholder="(empty — nothing appended)"></textarea>
    <div class="action-row" style="margin-top:6px">
      <button class="btn primary" id="btn-save-append" data-action="save-append">Save</button>
      <button class="btn secondary" data-action="reset-append">Reset</button>
      <button class="action-link" data-action="open-append-file">Open file</button>
    </div>
  </div>

  <div class="section">
    <h3>System Prompt — Override <span class="dirty" id="dirty-system" style="display:none" title="Unsaved changes">●</span></h3>
    <div class="warn"><strong>⚠ Warning:</strong> This <strong>replaces</strong> Pi's built-in system prompt entirely and may significantly change Pi's behavior, tool usage, and safety guardrails. Prefer the Append section above unless you know what you're doing.</div>
    <div class="hint">File: <code id="path-system">…</code></div>
    <textarea id="ta-system" placeholder="(empty — using default system prompt)"></textarea>
    <div class="action-row" style="margin-top:6px">
      <button class="btn primary" id="btn-save-system" data-action="save-system">Save</button>
      <button class="btn secondary" data-action="reset-system">Reset</button>
      <button class="action-link" data-action="open-system-file">Open file</button>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>
<script>
const vsc = acquireVsCodeApi();

// Latest known content from disk for each prompt — used for dirty comparison and Reset.
let originalSystem = "";
let originalAppend = "";
let piPath = "";

function escHtml(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }

function setText(id, text, placeholder) {
  var el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  if (placeholder) el.classList.add('placeholder'); else el.classList.remove('placeholder');
}

function showError(msg) {
  var host = document.getElementById('error-host');
  host.innerHTML = '<div class="error">' + escHtml(msg) + '</div>';
  setTimeout(function() { host.innerHTML = ''; }, 6000);
}

function showToast(msg) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function() { t.classList.remove('show'); }, 1500);
}

function updateDirty() {
  var sysTa = document.getElementById('ta-system');
  var appTa = document.getElementById('ta-append');
  var sysDirty = sysTa.value !== originalSystem;
  var appDirty = appTa.value !== originalAppend;
  document.getElementById('dirty-system').style.display = sysDirty ? '' : 'none';
  document.getElementById('dirty-append').style.display = appDirty ? '' : 'none';
  document.getElementById('btn-save-system').classList.toggle('modified', sysDirty);
  document.getElementById('btn-save-append').classList.toggle('modified', appDirty);
}

function copyToClipboard(text) {
  if (!text) return;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      function() { showToast('Copied'); },
      function() { showToast('Copy failed'); }
    );
    return;
  }
  // Fallback: hidden textarea + execCommand
  try {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    showToast('Copied');
  } catch (e) { showToast('Copy failed'); }
}

// Track input for dirty state.
document.addEventListener('input', function(ev) {
  var t = ev.target;
  if (t && (t.id === 'ta-system' || t.id === 'ta-append')) updateDirty();
});

// Event delegation for all data-action buttons.
document.addEventListener('click', function(ev) {
  var target = ev.target;
  if (!target || !target.closest) return;
  var btn = target.closest('[data-action]');
  if (!btn) return;
  var action = btn.getAttribute('data-action');
  switch (action) {
    case 'refresh':
      vsc.postMessage({ type: 'refresh' });
      break;
    case 'upgrade':
      vsc.postMessage({ type: 'upgrade' });
      break;
    case 'open-settings-json':
      vsc.postMessage({ type: 'openSettingsFile' });
      break;
    case 'open-system-file':
      vsc.postMessage({ type: 'openSystemPromptFile' });
      break;
    case 'open-append-file':
      vsc.postMessage({ type: 'openAppendSystemPromptFile' });
      break;
    case 'save-system':
      vsc.postMessage({ type: 'saveSystemPrompt', content: document.getElementById('ta-system').value });
      break;
    case 'save-append':
      vsc.postMessage({ type: 'saveAppendSystemPrompt', content: document.getElementById('ta-append').value });
      break;
    case 'reset-system':
      document.getElementById('ta-system').value = originalSystem;
      updateDirty();
      break;
    case 'reset-append':
      document.getElementById('ta-append').value = originalAppend;
      updateDirty();
      break;
    case 'copy-pi-path':
      copyToClipboard(piPath);
      break;
  }
});

function applyData(msg) {
  // Environment
  var env = msg.env || {};
  piPath = env.piPath || '';
  setText('env-pi-path', piPath || '(unknown)', !piPath);
  setText('env-ext-version', env.extensionVersion || '(unknown)', false);
  setText('env-node-version', env.nodeVersion || '(unknown)', false);
  if (env.piVersion !== undefined) {
    var loading = env.piVersion === '(loading…)';
    setText('env-pi-version', env.piVersion || '(unknown)', loading);
  }

  // Links
  var links = msg.links || {};
  var home = document.getElementById('link-home');
  var pkgs = document.getElementById('link-packages');
  var gh = document.getElementById('link-github');
  if (links.home) { home.href = links.home; home.title = links.home; }
  if (links.packages) { pkgs.href = links.packages; pkgs.title = links.packages; }
  if (links.github && gh) { gh.href = links.github; gh.title = links.github; }

  // Settings.json path → tooltip on the button (no inline text under it)
  if (msg.settingsJsonPath) {
    var sBtn = document.getElementById('btn-open-settings-json');
    if (sBtn) sBtn.title = msg.settingsJsonPath;
  }

  // System prompt
  if (msg.systemPrompt) {
    originalSystem = msg.systemPrompt.content || '';
    document.getElementById('ta-system').value = originalSystem;
    document.getElementById('path-system').textContent = msg.systemPrompt.path || '';
  }
  if (msg.appendSystemPrompt) {
    originalAppend = msg.appendSystemPrompt.content || '';
    document.getElementById('ta-append').value = originalAppend;
    document.getElementById('path-append').textContent = msg.appendSystemPrompt.path || '';
  }
  updateDirty();
}

window.addEventListener('message', function(e) {
  var msg = e.data || {};
  if (msg.type === 'data') {
    applyData(msg);
  } else if (msg.type === 'piVersion') {
    setText('env-pi-version', msg.piVersion || '(unknown)', false);
  } else if (msg.type === 'error') {
    showError(msg.message || 'Unknown error');
  } else if (msg.type === 'saved') {
    showToast(msg.what === 'append' ? 'Append saved' : 'System prompt saved');
  }
});

vsc.postMessage({ type: 'ready' });
</script>
</body></html>`;
}
