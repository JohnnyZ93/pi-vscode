export function getSessionsHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><style>
* { box-sizing: border-box; }
body { height:100%; margin:0; padding:0; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); display:flex; flex-direction:column; overflow-x:hidden; }
.header { padding:8px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); gap:6px; }
.header strong { font-size:12px; white-space:nowrap; }
.header select { flex:1; min-width:0; background:var(--vscode-dropdown-background); color:var(--vscode-dropdown-foreground); border:1px solid var(--vscode-dropdown-border); border-radius:3px; font-size:12px; padding:2px 4px; font-family:inherit; outline:none; }
.header button { padding:2px 4px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:12px; opacity:0.7; white-space:nowrap; }
.header button:hover { opacity:1; }
.header .header-actions { display:flex; gap:4px; flex-shrink:0; }
.list { flex:1; overflow-y:auto; padding:4px 0; }
.session-item { padding:8px 10px; cursor:pointer; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); position:relative; }
.session-item:hover { background:var(--vscode-list-hoverBackground); }
.session-item.editing { background:var(--vscode-list-activeSelectionBackground); }
.session-name { font-weight:500; margin-bottom:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; padding-right:60px; }
.session-meta { font-size:11px; opacity:0.6; display:flex; gap:8px; }
.session-preview { font-size:11px; opacity:0.5; margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.session-actions { position:absolute; right:8px; top:50%; transform:translateY(-50%); display:flex; gap:2px; opacity:0; transition:opacity 0.1s; }
.session-item:hover .session-actions { opacity:1; }
.session-actions button { padding:2px 6px; cursor:pointer; background:transparent; border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; color:var(--vscode-foreground); }
.session-actions button:hover { background:var(--vscode-toolbar-hoverBackground); }
.session-actions button.danger:hover { background:var(--vscode-inputValidation-errorBackground,#d32f2f); color:#fff; border-color:transparent; }
.rename-input { width:100%; padding:2px 4px; background:var(--vscode-input-background); color:var(--vscode-input-foreground); border:1px solid var(--vscode-focusBorder); border-radius:3px; font-size:13px; font-family:inherit; outline:none; }
.delete-confirm { padding:6px 10px; background:var(--vscode-inputValidation-errorBackground,#d32f2f); color:#fff; font-size:12px; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.delete-confirm button { padding:2px 8px; cursor:pointer; border:none; border-radius:3px; font-size:11px; }
.delete-confirm .btn-confirm { background:rgba(255,255,255,0.2); color:#fff; }
.delete-confirm .btn-cancel { background:transparent; color:#fff; text-decoration:underline; }
.empty { padding:20px; text-align:center; opacity:0.5; font-size:12px; }
</style></head>
<body>
<div class="header" id="header">
  <strong>Sessions</strong>
  <span class="header-actions">
    <button data-action="new" title="New Session">+</button>
    <button data-action="refresh" title="Refresh">↻</button>
  </span>
</div>
<div id="list" class="list"><div class="empty">Loading...</div></div>
<script>
const vscode = acquireVsCodeApi();
let deleteTarget = null;
let sessionsData = [];
let workspaces = [];
let selectedWorkspace = null;

function refresh() { vscode.postMessage({ type: 'refresh' }); }
function newSession() { vscode.postMessage({ type: 'new' }); }
function openSession(file) { vscode.postMessage({ type: 'open', sessionFile: file }); }

function onWorkspaceChange() {
  selectedWorkspace = this.value;
  vscode.postMessage({ type: 'selectWorkspace', fsPath: selectedWorkspace });
}

function updateHeader() {
  const header = document.getElementById('header');
  var actions = '<span class="header-actions"><button data-action="new" title="New Session">+</button> <button data-action="refresh" title="Refresh">↻</button></span>';
  if (workspaces.length <= 1) {
    const name = workspaces.length === 1 ? workspaces[0].name : 'Sessions';
    header.innerHTML = '<strong>' + escHtml(name) + '</strong> ' + actions;
  } else {
    let opts = workspaces.map(function(w) {
      return '<option value="' + escAttr(w.fsPath) + '"' + (w.fsPath === selectedWorkspace ? ' selected' : '') + '>' + escHtml(w.name) + '</option>';
    }).join('');
    header.innerHTML = '<select id="workspace-select">' + opts + '</select> ' + actions;
    var sel = document.getElementById('workspace-select');
    if (sel) sel.addEventListener('change', onWorkspaceChange);
  }
}

function startRename(file) {
  var el = document.getElementById('item-' + safeId(file));
  if (!el) return;
  el.classList.add('editing');
  var nameEl = el.querySelector('.session-name');
  var currentName = nameEl.textContent;
  nameEl.innerHTML = '<input class="rename-input" value="' + escAttr(currentName) + '" />';
  var input = nameEl.querySelector('input');
  input.focus();
  input.select();
  var done = false;
  var finish = function() {
    if (done) return;
    done = true;
    var newName = input.value.trim();
    el.classList.remove('editing');
    if (newName && newName !== currentName) {
      vscode.postMessage({ type: 'rename', sessionFile: file, name: newName });
    } else {
      nameEl.textContent = currentName;
    }
  };
  var cancel = function() {
    if (done) return;
    done = true;
    nameEl.textContent = currentName;
    el.classList.remove('editing');
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); finish(); }
    if (e.key === 'Escape') { e.preventDefault(); cancel(); }
  });
}

function confirmDelete(file) { deleteTarget = file; renderAll(); }
function cancelDelete() { deleteTarget = null; renderAll(); }
function doDelete() {
  if (deleteTarget) {
    vscode.postMessage({ type: 'delete', sessionFile: deleteTarget });
    deleteTarget = null;
  }
}

function escAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escHtml(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
function safeId(s) { return btoa(unescape(encodeURIComponent(s))).replace(/=/g, ''); }

function formatTime(iso) {
  try {
    var d = new Date(iso);
    var now = new Date();
    var diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return d.toLocaleDateString();
  } catch (e) { return ''; }
}

function renderAll() {
  var list = document.getElementById('list');
  if (!sessionsData.length) {
    list.innerHTML = '<div class="empty">No sessions found</div>';
    return;
  }
  var html = '';
  for (var i = 0; i < sessionsData.length; i++) {
    var s = sessionsData[i];
    var id = safeId(s.path);
    var pathAttr = escAttr(s.path);
    if (deleteTarget === s.path) {
      html += '<div class="delete-confirm">Delete "' + escHtml(s.name || s.firstMessage || 'Untitled') + '"? <span><button class="btn-confirm" data-action="delete-confirm">Delete</button> <button class="btn-cancel" data-action="delete-cancel">Cancel</button></span></div>';
      continue;
    }
    html += '<div class="session-item" id="item-' + id + '" data-action="open" data-path="' + pathAttr + '">';
    html += '<div class="session-name">' + escHtml(s.name || s.firstMessage || 'Untitled') + '</div>';
    html += '<div class="session-meta"><span>' + formatTime(s.modified) + '</span><span>' + s.messageCount + ' msgs</span></div>';
    html += '<div class="session-preview">' + escHtml(s.firstMessage || '') + '</div>';
    html += '<div class="session-actions">';
    html += '<button title="Rename" data-action="rename" data-path="' + pathAttr + '">✏️</button>';
    html += '<button class="danger" title="Delete" data-action="delete" data-path="' + pathAttr + '">🗑️</button>';
    html += '</div></div>';
  }
  list.innerHTML = html;
}

// Event delegation: avoids embedding file paths (with backslashes/quotes) into inline onclick handlers.
document.addEventListener('click', function(ev) {
  var target = ev.target;
  if (!target || !target.closest) return;
  var btn = target.closest('[data-action]');
  if (!btn) return;
  var action = btn.getAttribute('data-action');
  var path = btn.getAttribute('data-path') || '';
  switch (action) {
    case 'refresh':
      ev.stopPropagation();
      refresh();
      break;
    case 'new':
      ev.stopPropagation();
      newSession();
      break;
    case 'open':
      if (target.closest('button')) return;
      openSession(path);
      break;
    case 'rename':
      ev.stopPropagation();
      startRename(path);
      break;
    case 'delete':
      ev.stopPropagation();
      confirmDelete(path);
      break;
    case 'delete-confirm':
      ev.stopPropagation();
      doDelete();
      break;
    case 'delete-cancel':
      ev.stopPropagation();
      cancelDelete();
      break;
  }
});

window.addEventListener('message', function(e) {
  if (e.data.type === 'workspaces') {
    workspaces = e.data.workspaces || [];
    selectedWorkspace = e.data.selected;
    updateHeader();
  }
  if (e.data.type === 'sessions') {
    sessionsData = e.data.sessions || [];
    renderAll();
  }
});
</script>
</body></html>`;
}
