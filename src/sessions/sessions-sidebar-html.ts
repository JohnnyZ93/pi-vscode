export function getSessionsHtml(): string {
  return /* html */ `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><style>
* { box-sizing: border-box; }
body { height:100%; margin:0; padding:0; font-family: var(--vscode-font-family); font-size: 13px; color: var(--vscode-foreground); display:flex; flex-direction:column; overflow-x:hidden; }
.header { padding:8px; display:flex; align-items:center; justify-content:space-between; flex-shrink:0; border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent)); }
.header strong { font-size:12px; }
.header button { padding:2px 8px; cursor:pointer; background:transparent; color:var(--vscode-foreground); border:1px solid var(--vscode-widget-border,transparent); border-radius:3px; font-size:11px; opacity:0.7; }
.header button:hover { opacity:1; }
.list { flex:1; overflow-y:auto; padding:4px 0; }
.workspace-label { padding:6px 8px 2px; font-size:11px; font-weight:600; opacity:0.6; text-transform:uppercase; letter-spacing:0.5px; }
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
<div class="header">
  <strong>Sessions</strong>
  <button onclick="refresh()" title="Refresh">↻</button>
</div>
<div id="list" class="list"><div class="empty">Loading...</div></div>
<script>
const vscode = acquireVsCodeApi();
let deleteTarget = null;

function refresh() { vscode.postMessage({ type: 'refresh' }); }

function openSession(file) { vscode.postMessage({ type: 'open', sessionFile: file }); }

function startRename(file) {
  const el = document.getElementById('item-' + btoa(file));
  if (!el) return;
  el.classList.add('editing');
  const nameEl = el.querySelector('.session-name');
  const currentName = nameEl.textContent;
  nameEl.innerHTML = '<input class="rename-input" value="' + escAttr(currentName) + '" />';
  const input = nameEl.querySelector('input');
  input.focus();
  input.select();
  const finish = () => {
    const newName = input.value.trim();
    el.classList.remove('editing');
    if (newName && newName !== currentName) {
      vscode.postMessage({ type: 'rename', sessionFile: file, name: newName });
    } else {
      nameEl.textContent = currentName;
    }
  };
  input.addEventListener('blur', finish);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') finish(); if (e.key === 'Escape') { nameEl.textContent = currentName; el.classList.remove('editing'); } });
}

function confirmDelete(file) {
  deleteTarget = file;
  renderAll();
}

function cancelDelete() {
  deleteTarget = null;
  renderAll();
}

function doDelete() {
  if (deleteTarget) {
    vscode.postMessage({ type: 'delete', sessionFile: deleteTarget });
    deleteTarget = null;
  }
}

function escAttr(s) { return s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

function formatTime(iso) {
  try {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    if (diff < 604800000) return Math.floor(diff / 86400000) + 'd ago';
    return d.toLocaleDateString();
  } catch { return ''; }
}

let sessionsData = [];

function renderAll() {
  const list = document.getElementById('list');
  console.log('[pi-vscode sessions] renderAll called, sessionsData length:', sessionsData.length);
  if (!sessionsData.length) {
    list.innerHTML = '<div class="empty">No sessions found</div>';
    return;
  }
  let html = '';
  for (const ws of sessionsData) {
    html += '<div class="workspace-label">' + escHtml(ws.workspace) + '</div>';
    if (!ws.sessions.length) {
      html += '<div class="empty" style="padding:8px">No sessions in this workspace</div>';
      continue;
    }
    for (const s of ws.sessions) {
      const id = btoa(s.path);
      if (deleteTarget === s.path) {
        html += '<div class="delete-confirm">Delete "' + escHtml(s.name || s.firstMessage || 'Untitled') + '"? <span><button class="btn-confirm" onclick="doDelete()">Delete</button> <button class="btn-cancel" onclick="cancelDelete()">Cancel</button></span></div>';
        continue;
      }
      html += '<div class="session-item" id="item-' + id + '" ondblclick="openSession(' + escAttr(s.path) + ')">';
      html += '<div class="session-name">' + escHtml(s.name || s.firstMessage || 'Untitled') + '</div>';
      html += '<div class="session-meta"><span>' + formatTime(s.modified) + '</span><span>' + s.messageCount + ' msgs</span></div>';
      html += '<div class="session-preview">' + escHtml(s.firstMessage || '') + '</div>';
      html += '<div class="session-actions">';
      html += '<button title="Rename" onclick="startRename(' + escAttr(s.path) + ')">✏️</button>';
      html += '<button class="danger" title="Delete" onclick="confirmDelete(' + escAttr(s.path) + ')">🗑️</button>';
      html += '</div></div>';
    }
  }
  list.innerHTML = html;
}

window.addEventListener('message', (e) => {
  console.log('[pi-vscode sessions] received msg type:', e.data.type, 'data:', e.data.data ? e.data.data.length : 'none');
  if (e.data.type === 'sessions') {
    console.log('[pi-vscode sessions] raw data:', JSON.stringify(e.data.data).slice(0, 500));
    sessionsData = (e.data.data || []).map(ws => ({
      workspace: ws.workspace.name,
      sessions: (ws.sessions || []).map(s => ({
        path: s.path,
        name: s.name || '',
        firstMessage: s.firstMessage || '',
        messageCount: s.messageCount || 0,
        modified: s.modified instanceof Date ? s.modified.toISOString() : (s.modified || ''),
      })),
    }));
    console.log('[pi-vscode sessions] mapped data:', sessionsData.length, 'workspaces, total sessions:', sessionsData.reduce((sum, ws) => sum + ws.sessions.length, 0));
    renderAll();
  }
});
</script>
</body></html>`;
}
