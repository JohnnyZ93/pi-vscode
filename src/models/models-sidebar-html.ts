export function getModelsHtml(modelsPath: string): string {
  const escHtml = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  return `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{height:100%;margin:0;padding:0;font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);display:flex;flex-direction:column;overflow:hidden}
.header{padding:8px;display:flex;align-items:center;gap:6px;flex-shrink:0;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.header strong{font-size:12px;white-space:nowrap;flex:1;min-width:0}
.header-actions{display:flex;gap:2px;flex-shrink:0}
.header button{padding:2px 4px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:12px;opacity:0.7;white-space:nowrap}
.header button:hover{opacity:1}
.main{flex:1;overflow-y:auto}
.section-title{padding:8px 10px 4px;font-size:11px;font-weight:600;opacity:.7;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between}
.section-title button{padding:1px 8px;cursor:pointer;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;font-size:11px}
.section-title button:hover{background:var(--vscode-button-hoverBackground)}
.provider-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));position:relative}
.provider-item:hover{background:var(--vscode-list-hoverBackground)}
.provider-item.selected{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
.provider-item-row{display:flex;align-items:center;gap:6px}
.provider-name{flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding-right:60px}
.provider-badge{font-size:10px;opacity:.6;flex-shrink:0;padding-right:60px}
.provider-actions{position:absolute;right:8px;top:8px;display:flex;gap:2px;opacity:0;transition:opacity .1s}
.provider-item:hover .provider-actions{opacity:1}
.provider-actions button{padding:2px 6px;cursor:pointer;background:transparent;border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;color:var(--vscode-foreground)}
.provider-actions button:hover{background:var(--vscode-toolbar-hoverBackground)}
.provider-actions button.danger:hover{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-color:transparent}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.status-dot.on{background:#4caf50}
.status-dot.off{background:#9e9e9e}
.detail{padding:10px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));background:var(--vscode-editor-background)}
.detail h3{margin:0 0 8px;font-size:13px}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:11px;opacity:.7;margin-bottom:2px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;outline:none}
.form-row{display:flex;gap:6px}
.form-row .form-group{flex:1}
.btn{padding:4px 12px;cursor:pointer;border:none;border-radius:3px;font-size:12px}
.btn-primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-primary:hover{background:var(--vscode-button-hoverBackground)}
.btn-danger{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text)}
.btn-danger:hover{opacity:.9}
.btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn-sm{padding:2px 8px;font-size:11px}
.btn-row{display:flex;gap:4px;margin-top:8px;flex-wrap:wrap}
.model-list{margin-top:6px}
.model-item{padding:6px 8px;margin-bottom:4px;background:var(--vscode-input-background);border:1px solid var(--vscode-widget-border,transparent);border-radius:4px;cursor:pointer;position:relative}
.model-item:hover{border-color:var(--vscode-focusBorder)}
.model-item-header{display:flex;align-items:center;justify-content:space-between;gap:6px;padding-right:60px}
.model-item-id{font-weight:500;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.model-item-meta{font-size:10px;opacity:.6;margin-top:2px;padding-right:60px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.model-actions{position:absolute;right:6px;top:6px;display:flex;gap:2px;opacity:0;transition:opacity .1s}
.model-item:hover .model-actions{opacity:1}
.model-actions button{padding:2px 6px;cursor:pointer;background:transparent;border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;color:var(--vscode-foreground)}
.model-actions button:hover{background:var(--vscode-toolbar-hoverBackground)}
.model-actions button.danger:hover{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-color:transparent}
.oauth-item{padding:8px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.oauth-item .provider-name{flex:1;padding-right:0}
.oauth-progress{padding:10px;margin:8px;background:var(--vscode-editor-background);border:1px solid var(--vscode-widget-border,transparent);border-radius:4px}
.oauth-progress .url{word-break:break-all;font-size:11px;margin:4px 0}
.oauth-progress a{color:var(--vscode-textLink-foreground)}
.oauth-prompt{margin-top:6px}
.oauth-prompt input{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;margin-top:4px}
.apikey-item{padding:8px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.apikey-item .provider-name{flex:1;padding-right:0}
.empty{padding:20px;text-align:center;opacity:.5;font-size:12px}
.error-toast{padding:8px 10px;margin:8px;background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);border-radius:4px;font-size:12px;display:none}
.error-toast.show{display:block}
.tabs{display:flex;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));flex-shrink:0}
.tab{flex:1;padding:6px 8px;text-align:center;cursor:pointer;font-size:11px;opacity:.6;border-bottom:2px solid transparent}
.tab:hover{opacity:.8}
.tab.active{opacity:1;border-bottom-color:var(--vscode-focusBorder)}
.delete-confirm{padding:6px 10px;background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:var(--pi-error-text);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.delete-confirm button{padding:2px 8px;cursor:pointer;border:none;border-radius:3px;font-size:11px}
.delete-confirm .btn-confirm{background:rgba(0,0,0,0.15);color:var(--pi-error-text)}
.delete-confirm .btn-cancel{background:transparent;color:var(--pi-error-text);text-decoration:underline}
</style></head>
<body>
<div class="header"><strong>Models</strong><div class="header-actions"><button id="btn-open-models-json" data-action="open-file" title="Open ${escHtml(modelsPath)}">📝</button><button data-action="refresh" title="Refresh">↻</button></div></div>
<div id="error-toast" class="error-toast"></div>
<div class="tabs">
  <div class="tab active" data-tab="providers">Providers</div>
  <div class="tab" data-tab="oauth">OAuth</div>
  <div class="tab" data-tab="apikeys">API Keys</div>
</div>
<div id="tab-providers" class="main"></div>
<div id="tab-oauth" class="main" style="display:none"></div>
<div id="tab-apikeys" class="main" style="display:none"></div>
<script>
(function(){
var vsc = acquireVsCodeApi();
var VD = null;
var activeTab = 'providers';
var expandedProv = null;
var editProv = null;
var editModel = null;
var deleteProvTarget = null;
var deleteModelTarget = null;
var apiKeyEditing = null;
var apiKeyDeleteTarget = null;
var oauthState = null;

// ====== helpers ======
function escAttr(s) { return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function escHtml(s) { var d = document.createElement('div'); d.textContent = String(s); return d.innerHTML; }
function showErr(m) { var e = document.getElementById('error-toast'); e.textContent = m; e.classList.add('show'); setTimeout(function(){ e.classList.remove('show'); }, 5000); }
window.refresh = function() { vsc.postMessage({ type: 'refresh' }); };

// ====== tab switching ======
document.querySelectorAll('.tab').forEach(function(el) {
  el.addEventListener('click', function() {
    activeTab = this.dataset.tab;
    document.querySelectorAll('.tab').forEach(function(t) { t.classList.toggle('active', t.dataset.tab === activeTab); });
    document.getElementById('tab-providers').style.display = activeTab === 'providers' ? '' : 'none';
    document.getElementById('tab-oauth').style.display = activeTab === 'oauth' ? '' : 'none';
    document.getElementById('tab-apikeys').style.display = activeTab === 'apikeys' ? '' : 'none';
    renderAll();
  });
});

// ====== render dispatch ======
function renderAll() {
  if (!VD) { console.log('[pi-agent-studio models] renderAll: VD is null'); return; }
  if (activeTab === 'providers') renderProv();
  else if (activeTab === 'oauth') renderOAuth();
  else renderApiKeys();
}

// ====== Providers tab ======
function renderProv() {
  var el = document.getElementById('tab-providers');
  var provs = VD.providers || [];
  var h = '';
  h += '<div class="section-title">Custom Providers <button data-action="start-add-prov">+ Add</button></div>';
  if (!provs.length) h += '<div class="empty">No custom providers</div>';
  for (var i = 0; i < provs.length; i++) {
    var p = provs[i];
    if (deleteProvTarget === p.id) {
      h += '<div class="delete-confirm">Delete "' + escHtml(p.name) + '"? <span><button class="btn-confirm" data-action="prov-delete-confirm" data-id="' + escAttr(p.id) + '">Delete</button> <button class="btn-cancel" data-action="prov-delete-cancel">Cancel</button></span></div>';
      continue;
    }
    var isExpanded = expandedProv === p.id;
    h += '<div class="provider-item' + (isExpanded ? ' selected' : '') + '">';
    h += '<div class="provider-item-row" data-action="prov-expand" data-id="' + escAttr(p.id) + '">';
    h += '<span class="provider-name">' + escHtml(p.name) + '</span>';
    h += '<span class="provider-badge">' + p.modelCount + ' models</span></div>';
    h += '<div class="provider-actions">';
    h += '<button data-action="prov-edit" data-id="' + escAttr(p.id) + '" title="Edit">✏️</button>';
    h += '<button class="danger" data-action="prov-delete" data-id="' + escAttr(p.id) + '" title="Delete">🗑️</button>';
    h += '</div></div>';
    if (isExpanded) h += renderProvDetail(p.id);
  }
  if (editProv === 'new') h += renderProvAddForm();
  el.innerHTML = h;
}

function renderProvDetail(provId) {
  var prov = VD.modelsJson.providers[provId];
  if (!prov) return '';
  var h = '<div class="detail"><h3>Provider</h3>';
  h += '<div class="form-group"><label>Name</label><input id="pd-name" value="' + escAttr(provId) + '" placeholder="provider-name" /></div>';
  h += '<div class="form-group"><label>Base URL</label><input id="pd-baseUrl" value="' + escAttr(prov.baseUrl || '') + '" placeholder="https://api.example.com/v1" /></div>';
  h += '<div class="form-group"><label>API Key</label><input id="pd-apiKey" type="password" value="' + escAttr(prov.apiKey || '') + '" placeholder="sk-... or $ENV_VAR" /></div>';
  h += '<div class="form-group"><label>API Protocol</label><select id="pd-api">';
  var apis = [['','(default)'],['openai-completions','OpenAI Completions'],['openai-responses','OpenAI Responses'],['anthropic-messages','Anthropic Messages'],['google-generative-ai','Google Generative AI']];
  for (var j = 0; j < apis.length; j++) h += '<option value="' + escAttr(apis[j][0]) + '"' + (prov.api === apis[j][0] ? ' selected' : '') + '>' + escHtml(apis[j][1]) + '</option>';
  h += '</select></div>';
  h += '<div class="btn-row"><button class="btn btn-primary" data-action="prov-save-detail" data-id="' + escAttr(provId) + '">Save</button><button class="btn btn-sm btn-danger" data-action="prov-delete" data-id="' + escAttr(provId) + '">Delete</button></div>';
  h += '</div>';

  var models = prov.models || [];
  h += '<div class="detail"><div class="section-title" style="padding:0 0 4px">Models <button data-action="model-add" data-pid="' + escAttr(provId) + '">+ Add</button></div>';
  if (!models.length) h += '<div class="empty">No models</div>';
  h += '<div class="model-list">';
  for (var i = 0; i < models.length; i++) {
    var m = models[i];
    if (deleteModelTarget && deleteModelTarget.provider === provId && deleteModelTarget.modelId === m.id) {
      h += '<div class="delete-confirm">Delete model "' + escHtml(m.name || m.id) + '"? <span><button class="btn-confirm" data-action="model-delete-confirm" data-pid="' + escAttr(provId) + '" data-mid="' + escAttr(m.id) + '">Delete</button> <button class="btn-cancel" data-action="model-delete-cancel">Cancel</button></span></div>';
      continue;
    }
    if (editModel && editModel.provider === provId && editModel.modelId === m.id) {
      h += renderModelEditForm(provId, m);
      continue;
    }
    h += '<div class="model-item">';
    h += '<div class="model-item-header"><span class="model-item-id">' + escHtml(m.name || m.id) + '</span>';
    h += '<span style="font-size:10px;opacity:.6">' + escHtml(m.id) + '</span></div>';
    h += '<div class="model-item-meta">';
    if (m.reasoning) h += 'reasoning · ';
    if (m.input && m.input.indexOf('image') >= 0) h += 'image · ';
    h += 'ctx:' + (m.contextWindow || '?') + ' · cost:$' + (m.cost ? m.cost.input || 0 : 0) + '/$' + (m.cost ? m.cost.output || 0 : 0);
    h += '</div>';
    h += '<div class="model-actions">';
    h += '<button data-action="model-edit" data-pid="' + escAttr(provId) + '" data-mid="' + escAttr(m.id) + '" title="Edit">✏️</button>';
    h += '<button class="danger" data-action="model-delete" data-pid="' + escAttr(provId) + '" data-mid="' + escAttr(m.id) + '" title="Delete">🗑️</button>';
    h += '</div></div>';
  }
  if (editModel && editModel.provider === provId && editModel.modelId === 'new') h += renderModelAddForm(provId);
  h += '</div></div>';
  return h;
}

function renderProvAddForm() {
  return '<div class="detail"><h3>Add Provider</h3>' +
    '<div class="form-group"><label>Name</label><input id="pf-name" placeholder="my-provider" /></div>' +
    '<div class="form-group"><label>Base URL</label><input id="pf-baseUrl" placeholder="https://api.example.com/v1" /></div>' +
    '<div class="form-group"><label>API Key</label><input id="pf-apiKey" type="password" placeholder="sk-... or $ENV_VAR" /></div>' +
    '<div class="form-group"><label>API Protocol</label><select id="pf-api">' +
    '<option value="">(default)</option><option value="openai-completions">OpenAI Completions</option><option value="openai-responses">OpenAI Responses</option><option value="anthropic-messages">Anthropic Messages</option><option value="google-generative-ai">Google Generative AI</option>' +
    '</select></div>' +
    '<div class="btn-row"><button class="btn btn-primary" data-action="prov-save-new">Save</button><button class="btn btn-secondary" data-action="prov-cancel-edit">Cancel</button></div></div>';
}

function renderModelAddForm(provId) {
  return '<div class="detail" style="border:1px solid var(--vscode-focusBorder);border-radius:4px;margin:4px 0"><h3>Add Model</h3>' +
    renderModelFields(provId, null) +
    '</div>';
}

function renderModelEditForm(provId, existing) {
  return '<div class="detail" style="border:1px solid var(--vscode-focusBorder);border-radius:4px;margin:4px 0"><h3>Edit Model</h3>' +
    renderModelFields(provId, existing) +
    '</div>';
}

function renderModelFields(provId, existing) {
  var isNew = !existing;
  var hasImage = !!(existing && existing.input && existing.input.indexOf('image') >= 0);
  var costIn = (existing && existing.cost && existing.cost.input != null) ? existing.cost.input : '';
  var costOut = (existing && existing.cost && existing.cost.output != null) ? existing.cost.output : '';
  var costCacheRead = (existing && existing.cost && existing.cost.cacheRead != null) ? existing.cost.cacheRead : '';
  var costCacheWrite = (existing && existing.cost && existing.cost.cacheWrite != null) ? existing.cost.cacheWrite : '';
  var h = '';
  h += '<div class="form-row"><div class="form-group"><label>Model ID</label><input id="mf-id" value="' + escAttr(existing ? existing.id || '' : '') + '" placeholder="model-id" ' + (isNew ? '' : 'readonly') + ' /></div>';
  h += '<div class="form-group"><label>Display Name</label><input id="mf-name" value="' + escAttr(existing ? existing.name || '' : '') + '" placeholder="Optional" /></div></div>';
  h += '<div class="form-row"><div class="form-group"><label>Context Window</label><input id="mf-ctx" type="number" value="' + (existing ? existing.contextWindow || '' : '') + '" placeholder="200000" /></div>';
  h += '<div class="form-group"><label>Max Tokens</label><input id="mf-maxTok" type="number" value="' + (existing ? existing.maxTokens || '' : '') + '" placeholder="16384" /></div></div>';
  h += '<div class="section-title" style="padding:6px 0 2px">Cost (per million tokens)</div>';
  h += '<div class="form-row"><div class="form-group"><label>Input</label><input id="mf-costIn" type="number" step="any" value="' + costIn + '" placeholder="0" /></div>';
  h += '<div class="form-group"><label>Output</label><input id="mf-costOut" type="number" step="any" value="' + costOut + '" placeholder="0" /></div></div>';
  h += '<div class="form-row"><div class="form-group"><label>Cache Read</label><input id="mf-costCacheRead" type="number" step="any" value="' + costCacheRead + '" placeholder="0" /></div>';
  h += '<div class="form-group"><label>Cache Write</label><input id="mf-costCacheWrite" type="number" step="any" value="' + costCacheWrite + '" placeholder="0" /></div></div>';
  h += '<div class="form-group" style="display:flex;gap:14px;flex-wrap:wrap">';
  h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="mf-reasoning" ' + (existing && existing.reasoning ? 'checked' : '') + ' /> Reasoning</label>';
  h += '<label style="display:flex;align-items:center;gap:4px;cursor:pointer"><input type="checkbox" id="mf-image" ' + (hasImage ? 'checked' : '') + ' /> Image input</label>';
  h += '</div>';
  h += '<div class="btn-row"><button class="btn btn-primary" data-action="model-save" data-pid="' + escAttr(provId) + '" data-new="' + (isNew ? '1' : '0') + '">Save</button><button class="btn btn-secondary" data-action="model-cancel">Cancel</button></div>';
  return h;
}

// ====== OAuth tab ======
function renderOAuth() {
  var el = document.getElementById('tab-oauth');
  var items = VD.oauthStatuses || [];
  if (!items.length) { el.innerHTML = '<div class="empty">No OAuth providers available</div>'; return; }
  if (oauthState) { el.innerHTML = renderOAuthProgress(); return; }
  var h = '';
  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    h += '<div class="oauth-item">';
    h += '<span class="status-dot ' + (p.connected ? 'on' : 'off') + '"></span>';
    h += '<span class="provider-name">' + escHtml(p.name) + '</span>';
    if (p.connected) h += '<button class="btn btn-sm btn-secondary" data-action="oauth-logout" data-id="' + escAttr(p.id) + '">Logout</button>';
    else h += '<button class="btn btn-sm btn-primary" data-action="oauth-login" data-id="' + escAttr(p.id) + '">Login</button>';
    h += '</div>';
  }
  el.innerHTML = h;
}

function renderOAuthProgress() {
  var s = oauthState;
  var h = '<div class="oauth-progress">';
  if (s.type === 'auth_url') {
    h += '<strong>Authorize</strong>';
    h += '<div class="url"><a href="' + escAttr(s.url) + '" target="_blank">' + escHtml(s.url) + '</a></div>';
    if (s.instructions) h += '<p style="font-size:11px;opacity:.7">' + escHtml(s.instructions) + '</p>';
    h += '<div class="oauth-prompt"><label>Or paste authorization code:</label><input id="oauth-code" placeholder="Authorization code" /></div>';
    h += '<div class="btn-row"><button class="btn btn-primary" data-action="oauth-submit-code">Submit</button><button class="btn btn-secondary" data-action="oauth-cancel">Cancel</button></div>';
  } else if (s.type === 'device_code') {
    h += '<strong>Device Code</strong>';
    h += '<p style="font-size:16px;font-weight:bold;letter-spacing:2px">' + escHtml(s.userCode || '') + '</p>';
    if (s.verificationUri) h += '<p><a href="' + escAttr(s.verificationUri) + '" target="_blank">' + escHtml(s.verificationUri) + '</a></p>';
    h += '<div class="btn-row"><button class="btn btn-secondary" data-action="oauth-cancel">Cancel</button></div>';
  } else if (s.type === 'prompt') {
    h += '<strong>' + escHtml(s.message || 'Input required') + '</strong>';
    h += '<div class="oauth-prompt"><input id="oauth-input" placeholder="' + escAttr(s.placeholder || '') + '" /></div>';
    h += '<div class="btn-row"><button class="btn btn-primary" data-action="oauth-submit-input" data-token="' + escAttr(s.token || '') + '">Submit</button><button class="btn btn-secondary" data-action="oauth-cancel">Cancel</button></div>';
  } else if (s.type === 'select') {
    h += '<strong>' + escHtml(s.message || 'Select') + '</strong>';
    var opts = s.options || [];
    for (var i = 0; i < opts.length; i++) h += '<div class="btn-row"><button class="btn btn-primary" data-action="oauth-submit-select" data-token="' + escAttr(s.token || '') + '" data-id="' + escAttr(opts[i].id) + '">' + escHtml(opts[i].label) + '</button></div>';
    h += '<div class="btn-row"><button class="btn btn-secondary" data-action="oauth-cancel">Cancel</button></div>';
  } else if (s.type === 'progress') {
    h += '<p>' + escHtml(s.message || 'Working...') + '</p>';
  } else if (s.type === 'success') {
    h += '<p style="color:#4caf50">✓ Connected successfully!</p>';
  } else if (s.type === 'error') {
    h += '<p style="color:#d32f2f">Error: ' + escHtml(s.message || '') + '</p>';
    h += '<button class="btn btn-sm btn-secondary" data-action="oauth-dismiss">Dismiss</button>';
  } else if (s.type === 'cancelled') {
    h += '<p>Login cancelled.</p>';
    h += '<button class="btn btn-sm btn-secondary" data-action="oauth-dismiss">Dismiss</button>';
  }
  h += '</div>';
  return h;
}

// ====== API Keys tab ======
function renderApiKeys() {
  var el = document.getElementById('tab-apikeys');
  var items = VD.apikeyStatuses || [];
  if (!items.length) { el.innerHTML = '<div class="empty">No API key providers found</div>'; return; }
  var h = '';
  for (var i = 0; i < items.length; i++) {
    var p = items[i];
    if (apiKeyDeleteTarget === p.id) {
      h += '<div class="delete-confirm">Remove API key for "' + escHtml(p.name) + '"? <span><button class="btn-confirm" data-action="apikey-remove-confirm" data-id="' + escAttr(p.id) + '">Remove</button> <button class="btn-cancel" data-action="apikey-remove-cancel">Cancel</button></span></div>';
      continue;
    }
    h += '<div class="apikey-item">';
    h += '<span class="status-dot ' + (p.configured ? 'on' : 'off') + '"></span>';
    h += '<span class="provider-name">' + escHtml(p.name) + ' <span style="font-size:10px;opacity:.6">(' + p.modelCount + ' models)</span></span>';
    if (p.configured) h += '<button class="btn btn-sm btn-danger" data-action="apikey-remove" data-id="' + escAttr(p.id) + '">Remove</button>';
    else h += '<button class="btn btn-sm btn-primary" data-action="apikey-set" data-id="' + escAttr(p.id) + '">Set Key</button>';
    h += '</div>';
    if (apiKeyEditing === p.id) {
      h += '<div class="detail"><div class="form-group"><label>API Key for ' + escHtml(p.name) + '</label><input id="apikey-input" type="password" placeholder="sk-..." /></div>';
      h += '<div class="btn-row"><button class="btn btn-primary" data-action="apikey-save" data-id="' + escAttr(p.id) + '">Save</button><button class="btn btn-secondary" data-action="apikey-cancel">Cancel</button></div></div>';
    }
  }
  el.innerHTML = h;
}

// ====== Event delegation ======
document.addEventListener('click', function(ev) {
  var target = ev.target;
  if (!target || !target.closest) return;
  var btn = target.closest('[data-action]');
  if (!btn) return;
  var action = btn.dataset.action;
  var id = btn.dataset.id || '';
  var pid = btn.dataset.pid || '';
  var mid = btn.dataset.mid || '';
  var token = btn.dataset.token || '';
  var isNew = btn.dataset.new === '1';

  switch (action) {
    case 'open-file':
      vsc.postMessage({ type: 'openModelsFile' });
      break;
    case 'refresh':
      refresh();
      break;
    // Providers
    case 'start-add-prov':
      editProv = 'new'; expandedProv = null; editModel = null; renderProv();
      break;
    case 'prov-expand':
    case 'prov-edit':
      // Both row click and edit button toggle the same expandable detail panel.
      expandedProv = (expandedProv === id) ? null : id; editProv = null; editModel = null; renderProv();
      break;
    case 'prov-delete':
      deleteProvTarget = id; renderProv();
      break;
    case 'prov-delete-confirm':
      vsc.postMessage({ type: 'deleteProvider', name: id });
      deleteProvTarget = null;
      break;
    case 'prov-delete-cancel':
      deleteProvTarget = null; renderProv();
      break;
    case 'prov-save-new':
      saveProvForm(true);
      break;
    case 'prov-save-detail':
      saveProvDetail(id);
      break;
    case 'prov-cancel-edit':
      editProv = null; renderProv();
      break;
    // Models
    case 'model-add':
      editModel = { provider: pid, modelId: 'new' }; expandedProv = pid; editProv = null; renderProv();
      break;
    case 'model-edit':
      editModel = { provider: pid, modelId: mid }; expandedProv = pid; renderProv();
      break;
    case 'model-delete':
      deleteModelTarget = { provider: pid, modelId: mid }; renderProv();
      break;
    case 'model-delete-confirm':
      vsc.postMessage({ type: 'deleteModel', providerName: pid, modelId: mid });
      deleteModelTarget = null;
      break;
    case 'model-delete-cancel':
      deleteModelTarget = null; renderProv();
      break;
    case 'model-save':
      saveModelForm(pid, isNew);
      break;
    case 'model-cancel':
      editModel = null; renderProv();
      break;
    // OAuth
    case 'oauth-login':
      vsc.postMessage({ type: 'oauthLogin', providerId: id });
      break;
    case 'oauth-logout':
      vsc.postMessage({ type: 'oauthLogout', providerId: id });
      break;
    case 'oauth-submit-code':
      submitOAuthCode();
      break;
    case 'oauth-submit-input':
      submitOAuthInput(token);
      break;
    case 'oauth-submit-select':
      vsc.postMessage({ type: 'oauthRespond', token: token, value: id });
      break;
    case 'oauth-cancel':
      vsc.postMessage({ type: 'oauthCancel' }); oauthState = null; renderOAuth();
      break;
    case 'oauth-dismiss':
      oauthState = null; renderOAuth();
      break;
    // API Keys
    case 'apikey-set':
      apiKeyEditing = id; renderApiKeys();
      break;
    case 'apikey-save':
      saveApiKey(id);
      break;
    case 'apikey-remove':
      apiKeyDeleteTarget = id; renderApiKeys();
      break;
    case 'apikey-remove-confirm':
      vsc.postMessage({ type: 'removeApiKey', providerId: id });
      apiKeyDeleteTarget = null;
      break;
    case 'apikey-remove-cancel':
      apiKeyDeleteTarget = null; renderApiKeys();
      break;
    case 'apikey-cancel':
      apiKeyEditing = null; renderApiKeys();
      break;
  }
});

// ====== form save helpers ======
function saveProvForm(isNew) {
  var name = document.getElementById('pf-name').value.trim();
  if (!name) { showErr('Provider name is required'); return; }
  var entry = {};
  var baseUrl = document.getElementById('pf-baseUrl').value.trim();
  if (baseUrl) entry.baseUrl = baseUrl;
  var apiKey = document.getElementById('pf-apiKey').value.trim();
  if (apiKey) entry.apiKey = apiKey;
  var api = document.getElementById('pf-api').value;
  if (api) entry.api = api;
  vsc.postMessage({ type: 'addProvider', name: name, entry: entry });
  editProv = null;
}

function saveProvDetail(provId) {
  var newName = document.getElementById('pd-name').value.trim();
  if (!newName) { showErr('Provider name is required'); return; }
  // Use null to signal "remove this field" (postMessage drops undefined values).
  var u = {};
  var baseUrl = document.getElementById('pd-baseUrl').value.trim();
  u.baseUrl = baseUrl || null;
  var apiKey = document.getElementById('pd-apiKey').value.trim();
  u.apiKey = apiKey || null;
  var api = document.getElementById('pd-api').value;
  u.api = api || null;
  if (newName !== provId) {
    expandedProv = newName;
    vsc.postMessage({ type: 'renameProviderAndUpdate', oldName: provId, newName: newName, updates: u });
  } else {
    vsc.postMessage({ type: 'updateProvider', name: provId, updates: u });
  }
}

function saveModelForm(provId, isNew) {
  var id = document.getElementById('mf-id').value.trim();
  if (!id) { showErr('Model ID is required'); return; }
  var m = { id: id };
  var name = document.getElementById('mf-name').value.trim();
  if (name) m.name = name;
  var ctx = parseInt(document.getElementById('mf-ctx').value);
  if (ctx > 0) m.contextWindow = ctx;
  var maxTok = parseInt(document.getElementById('mf-maxTok').value);
  if (maxTok > 0) m.maxTokens = maxTok;
  var costIn = parseFloat(document.getElementById('mf-costIn').value);
  var costOut = parseFloat(document.getElementById('mf-costOut').value);
  var costCacheRead = parseFloat(document.getElementById('mf-costCacheRead').value);
  var costCacheWrite = parseFloat(document.getElementById('mf-costCacheWrite').value);
  var anyCost = !isNaN(costIn) || !isNaN(costOut) || !isNaN(costCacheRead) || !isNaN(costCacheWrite);
  if (anyCost) {
    m.cost = {
      input: isNaN(costIn) ? 0 : costIn,
      output: isNaN(costOut) ? 0 : costOut,
      cacheRead: isNaN(costCacheRead) ? 0 : costCacheRead,
      cacheWrite: isNaN(costCacheWrite) ? 0 : costCacheWrite,
    };
  }
  m.reasoning = document.getElementById('mf-reasoning').checked;
  // Always set input so that unchecking the box clears the previous value during update.
  if (document.getElementById('mf-image').checked) m.input = ['text', 'image'];
  else m.input = null; // null → ext converts to undefined to drop the field on JSON.stringify
  if (isNew) {
    if (m.input === null) delete m.input;
    vsc.postMessage({ type: 'addModel', providerName: provId, model: m });
  } else {
    vsc.postMessage({ type: 'updateModel', providerName: provId, modelId: id, updates: m });
  }
  editModel = null;
}

function submitOAuthCode() {
  var code = document.getElementById('oauth-code').value.trim();
  if (code && oauthState && oauthState.token) vsc.postMessage({ type: 'oauthRespond', token: oauthState.token, value: code });
}

function submitOAuthInput(token) {
  var val = document.getElementById('oauth-input').value.trim();
  if (val) vsc.postMessage({ type: 'oauthRespond', token: token, value: val });
}

function saveApiKey(id) {
  var key = document.getElementById('apikey-input').value.trim();
  if (!key) { showErr('API key is required'); return; }
  vsc.postMessage({ type: 'saveApiKey', providerId: id, apiKey: key });
  apiKeyEditing = null;
}

// ====== Message handler ======
window.addEventListener('message', function(e) {
  var msg = e.data;
  if (msg.type === 'data') {
    VD = msg.data;
    if (msg.title) {
      var btn = document.getElementById('btn-open-models-json');
      if (btn) btn.title = 'Open ' + msg.title;
    }
    // Reset transient editing state on data refresh; keep expandedProv if it still exists
    var stillExists = expandedProv && VD.providers && VD.providers.some(function(p){ return p.id === expandedProv; });
    if (!stillExists) expandedProv = null;
    editProv = null;
    editModel = null;
    deleteProvTarget = null;
    deleteModelTarget = null;
    apiKeyEditing = null;
    apiKeyDeleteTarget = null;
    renderAll();
  } else if (msg.type === 'oauthProgress') {
    oauthState = msg.event;
    if (activeTab === 'oauth') renderOAuth();
  } else if (msg.type === 'error') {
    showErr(msg.message);
  }
});
})();
</script>
</body></html>`;
}
