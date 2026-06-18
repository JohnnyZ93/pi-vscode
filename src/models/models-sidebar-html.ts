export function getModelsHtml(): string {
  return `<!DOCTYPE html>
<html style="height:100%;margin:0;padding:0">
<head><meta charset="utf-8"><style>
*{box-sizing:border-box}
body{height:100%;margin:0;padding:0;font-family:var(--vscode-font-family);font-size:13px;color:var(--vscode-foreground);display:flex;flex-direction:column;overflow:hidden}
.header{padding:8px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.header strong{font-size:12px}
.header button{padding:2px 8px;cursor:pointer;background:transparent;color:var(--vscode-foreground);border:1px solid var(--vscode-widget-border,transparent);border-radius:3px;font-size:11px;opacity:.7}
.header button:hover{opacity:1}
.main{flex:1;overflow-y:auto}
.section-title{padding:8px 10px 4px;font-size:11px;font-weight:600;opacity:.5;text-transform:uppercase;letter-spacing:.5px;display:flex;align-items:center;justify-content:space-between}
.section-title button{padding:1px 6px;cursor:pointer;background:var(--vscode-button-background);color:var(--vscode-button-foreground);border:none;border-radius:3px;font-size:10px}
.provider-item{padding:8px 10px;cursor:pointer;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));display:flex;align-items:center;gap:6px}
.provider-item:hover{background:var(--vscode-list-hoverBackground)}
.provider-item.selected{background:var(--vscode-list-activeSelectionBackground);color:var(--vscode-list-activeSelectionForeground)}
.provider-name{flex:1;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.provider-badge{font-size:10px;opacity:.6}
.status-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0}
.status-dot.on{background:#4caf50}
.status-dot.off{background:#9e9e9e}
.detail{padding:10px}
.detail h3{margin:0 0 8px;font-size:13px}
.form-group{margin-bottom:8px}
.form-group label{display:block;font-size:11px;opacity:.7;margin-bottom:2px}
.form-group input,.form-group select,.form-group textarea{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;outline:none}
.form-group textarea{resize:vertical;min-height:60px;font-family:monospace;font-size:11px}
.form-row{display:flex;gap:6px}
.form-row .form-group{flex:1}
.btn{padding:4px 12px;cursor:pointer;border:none;border-radius:3px;font-size:12px}
.btn-primary{background:var(--vscode-button-background);color:var(--vscode-button-foreground)}
.btn-primary:hover{background:var(--vscode-button-hoverBackground)}
.btn-danger{background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:#fff}
.btn-danger:hover{opacity:.9}
.btn-secondary{background:var(--vscode-button-secondaryBackground);color:var(--vscode-button-secondaryForeground)}
.btn-secondary:hover{background:var(--vscode-button-secondaryHoverBackground)}
.btn-sm{padding:2px 8px;font-size:11px}
.btn-row{display:flex;gap:4px;margin-top:8px;flex-wrap:wrap}
.model-list{margin-top:8px}
.model-item{padding:6px 8px;margin-bottom:4px;background:var(--vscode-editor-background);border:1px solid var(--vscode-widget-border,transparent);border-radius:4px;cursor:pointer}
.model-item:hover{border-color:var(--vscode-focusBorder)}
.model-item.selected{border-color:var(--vscode-focusBorder);background:var(--vscode-list-activeSelectionBackground)}
.model-item-header{display:flex;align-items:center;justify-content:space-between}
.model-item-id{font-weight:500;font-size:12px}
.model-item-meta{font-size:10px;opacity:.6;margin-top:2px}
.oauth-item{padding:8px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.oauth-item .provider-name{flex:1}
.oauth-progress{padding:10px;margin:8px;background:var(--vscode-editor-background);border:1px solid var(--vscode-widget-border,transparent);border-radius:4px}
.oauth-progress .url{word-break:break-all;font-size:11px;margin:4px 0}
.oauth-progress a{color:var(--vscode-textLink-foreground)}
.oauth-prompt{margin-top:6px}
.oauth-prompt input{width:100%;padding:4px 6px;background:var(--vscode-input-background);color:var(--vscode-input-foreground);border:1px solid var(--vscode-input-border,transparent);border-radius:3px;font-size:12px;font-family:inherit;margin-top:4px}
.apikey-item{padding:8px 10px;display:flex;align-items:center;gap:8px;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent))}
.apikey-item .provider-name{flex:1}
.empty{padding:20px;text-align:center;opacity:.5;font-size:12px}
.error-toast{padding:8px 10px;margin:8px;background:var(--vscode-inputValidation-errorBackground,#d32f2f);color:#fff;border-radius:4px;font-size:12px;display:none}
.error-toast.show{display:block}
.tabs{display:flex;border-bottom:1px solid var(--vscode-widget-border,var(--vscode-panel-border,transparent));flex-shrink:0}
.tab{flex:1;padding:6px 8px;text-align:center;cursor:pointer;font-size:11px;opacity:.6;border-bottom:2px solid transparent}
.tab:hover{opacity:.8}
.tab.active{opacity:1;border-bottom-color:var(--vscode-focusBorder)}
</style></head>
<body>
<div class="header"><strong>Models</strong><button onclick="refresh()">↻</button></div>
<div id="error-toast" class="error-toast"></div>
<div class="tabs">
  <div class="tab active" data-tab="providers" onclick="switchTab('providers')">Providers</div>
  <div class="tab" data-tab="oauth" onclick="switchTab('oauth')">OAuth</div>
  <div class="tab" data-tab="apikeys" onclick="switchTab('apikeys')">API Keys</div>
</div>
<div id="tab-providers" class="main"></div>
<div id="tab-oauth" class="main" style="display:none"></div>
<div id="tab-apikeys" class="main" style="display:none"></div>
<script>
var vsc=acquireVsCodeApi(),VD=null,selProv=null,selModel=null,editProv=null,editModel=null,activeTab='providers',oauthState=null;
function refresh(){vsc.postMessage({type:'refresh'})}
function escA(s){return(s||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}
function escH(s){var d=document.createElement('div');d.textContent=s||'';return d.innerHTML}
function showErr(m){var e=document.getElementById('error-toast');e.textContent=m;e.classList.add('show');setTimeout(function(){e.classList.remove('show')},5000)}
function switchTab(t){activeTab=t;document.querySelectorAll('.tab').forEach(function(x){x.classList.toggle('active',x.dataset.tab===t)});document.getElementById('tab-providers').style.display=t==='providers'?'':'none';document.getElementById('tab-oauth').style.display=t==='oauth'?'':'none';document.getElementById('tab-apikeys').style.display=t==='apikeys'?'':'none';renderAll()}
function renderAll(){if(!VD){console.log('[pi-vscode models] renderAll: VD is null');return;}console.log('[pi-vscode models] renderAll: VD providers=',VD.providers?VD.providers.length:'none');if(activeTab==='providers')renderProv();else if(activeTab==='oauth')renderOAuth();else renderApiKeys()}

function renderProv(){
  var el=document.getElementById('tab-providers'),provs=VD.providers||[],h='';
  h+='<div class="section-title">Custom Providers <button onclick="startAddProv()">+ Add</button></div>';
  if(!provs.length)h+='<div class="empty">No custom providers</div>';
  for(var i=0;i<provs.length;i++){
    var p=provs[i];
    h+='<div class="provider-item'+(selProv===p.id?' selected':'')+'" onclick="selectProv('+escA(p.id)+')">';
    h+='<span class="provider-name">'+escH(p.name)+'</span>';
    h+='<span class="provider-badge">'+p.modelCount+' models</span></div>';
  }
  if(editProv==='new')h+=renderProvForm(null);
  else if(editProv&&provs.some(function(p){return p.id===editProv}))h+=renderProvForm(VD.modelsJson.providers[editProv]);
  else if(selProv&&provs.some(function(p){return p.id===selProv}))h+=renderProvDetail(selProv);
  el.innerHTML=h;
}
function selectProv(id){selProv=id;editProv=null;selModel=null;editModel=null;renderProv()}
function startAddProv(){editProv='new';selProv=null;selModel=null;editModel=null;renderProv()}
function cancelEdit(){editProv=null;editModel=null;renderProv()}

function renderProvForm(existing){
  var isNew=!existing;
  var provName=existing?(Object.keys(VD.modelsJson.providers||{}).find(function(k){return VD.modelsJson.providers[k]===existing})||''):'';
  var h='<div class="detail"><h3>'+(isNew?'Add Provider':'Edit Provider')+'</h3>';
  h+='<div class="form-group"><label>Name</label><input id="pf-name" value="'+escA(provName)+'" placeholder="my-provider" '+(isNew?'':'readonly')+' /></div>';
  h+='<div class="form-group"><label>Base URL</label><input id="pf-baseUrl" value="'+escA(existing?existing.baseUrl||'':'')+'" placeholder="https://api.example.com/v1" /></div>';
  h+='<div class="form-group"><label>API Key</label><input id="pf-apiKey" type="password" value="'+escA(existing?existing.apiKey||'':'')+'" placeholder="sk-... or $ENV_VAR" /></div>';
  h+='<div class="form-group"><label>API Protocol</label><select id="pf-api">';
  var apis=['','openai-completions','openai-responses','anthropic-messages','google-generative-ai'];
  var apiLabels=['(default)','OpenAI Completions','OpenAI Responses','Anthropic Messages','Google Generative AI'];
  for(var i=0;i<apis.length;i++)h+='<option value="'+escA(apis[i])+'"'+(existing&&existing.api===apis[i]?' selected':'')+'>'+escH(apiLabels[i])+'</option>';
  h+='</select></div>';
  h+='<div class="btn-row"><button class="btn btn-primary" onclick="saveProvForm('+(isNew?'true':'false')+')">Save</button><button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button></div>';
  h+='</div>';
  return h;
}

function saveProvForm(isNew){
  var name=document.getElementById('pf-name').value.trim();
  if(!name){showErr('Provider name is required');return}
  var entry={};
  var baseUrl=document.getElementById('pf-baseUrl').value.trim();
  if(baseUrl)entry.baseUrl=baseUrl;
  var apiKey=document.getElementById('pf-apiKey').value.trim();
  if(apiKey)entry.apiKey=apiKey;
  var api=document.getElementById('pf-api').value;
  if(api)entry.api=api;
  if(isNew)vsc.postMessage({type:'addProvider',name:name,entry:entry});
  else vsc.postMessage({type:'updateProvider',name:name,updates:entry});
}

function renderProvDetail(provId){
  var prov=VD.modelsJson.providers[provId];
  if(!prov)return;
  var h='<div class="detail"><h3>'+escH(prov.name||provId)+'</h3>';
  h+='<div class="form-group"><label>Base URL</label><input id="pd-baseUrl" value="'+escA(prov.baseUrl||'')+'" /></div>';
  h+='<div class="form-group"><label>API Key</label><input id="pd-apiKey" type="password" value="'+escA(prov.apiKey||'')+'" /></div>';
  h+='<div class="form-group"><label>API Protocol</label><select id="pd-api">';
  var apis=['','openai-completions','openai-responses','anthropic-messages','google-generative-ai'];
  var apiLabels=['(default)','OpenAI Completions','OpenAI Responses','Anthropic Messages','Google Generative AI'];
  for(var i=0;i<apis.length;i++)h+='<option value="'+escA(apis[i])+'"'+(prov.api===apis[i]?' selected':'')+'>'+escH(apiLabels[i])+'</option>';
  h+='</select></div>';
  h+='<div class="btn-row"><button class="btn btn-primary" onclick="saveProvDetail('+escA(provId)+')">Save</button><button class="btn btn-sm btn-secondary" onclick="editProv='+escA(provId)+';renderProv()">Rename</button><button class="btn btn-sm btn-danger" onclick="delProv('+escA(provId)+')">Delete</button></div>';
  h+='</div>';

  var models=prov.models||[];
  h+='<div class="detail"><div class="section-title" style="padding:0 0 4px">Models <button onclick="startAddModel('+escA(provId)+')">+ Add</button></div>';
  if(!models.length)h+='<div class="empty">No models</div>';
  h+='<div class="model-list">';
  for(var i=0;i<models.length;i++){
    var m=models[i];
    if(editModel===m.id){
      h+=renderModelForm(provId,m);
    }else{
      h+='<div class="model-item'+(selModel===m.id?' selected':'')+'" onclick="selectModel('+escA(provId)+','+escA(m.id)+')">';
      h+='<div class="model-item-header"><span class="model-item-id">'+escH(m.name||m.id)+'</span>';
      h+='<span style="font-size:10px;opacity:.6">'+escH(m.id)+'</span></div>';
      h+='<div class="model-item-meta">';
      if(m.reasoning)h+='reasoning · ';
      h+='ctx:'+(m.contextWindow||'?')+' · cost:$'+(m.cost?m.cost.input||0:0)+'/$'+(m.cost?m.cost.output||0:0);
      h+='</div></div>';
    }
  }
  h+='</div></div>';
  return h;
}

function saveProvDetail(provId){
  var u={};
  var baseUrl=document.getElementById('pd-baseUrl').value.trim();
  if(baseUrl)u.baseUrl=baseUrl;
  var apiKey=document.getElementById('pd-apiKey').value.trim();
  if(apiKey)u.apiKey=apiKey;
  var api=document.getElementById('pd-api').value;
  if(api)u.api=api;
  vsc.postMessage({type:'updateProvider',name:provId,updates:u});
}

function delProv(id){if(confirm('Delete provider "'+id+'" and all its models?'))vsc.postMessage({type:'deleteProvider',name:id})}

function startAddModel(provId){editModel='new';selProv=provId;renderProv()}
function selectModel(provId,modelId){selModel=modelId;selProv=provId;editModel=null;renderProv()}
function editModel_(provId,modelId){editModel=modelId;selProv=provId;renderProv()}
function delModel(provId,modelId){if(confirm('Delete model "'+modelId+'"?'))vsc.postMessage({type:'deleteModel',providerName:provId,modelId:modelId})}

function renderModelForm(provId,existing){
  var isNew=!existing;
  var h='<div class="detail" style="border:1px solid var(--vscode-focusBorder);border-radius:4px;margin:4px 0"><h3>'+(isNew?'Add Model':'Edit Model')+'</h3>';
  h+='<div class="form-row"><div class="form-group"><label>Model ID</label><input id="mf-id" value="'+escA(existing?existing.id||'':'')+'" placeholder="model-id" '+(isNew?'':'readonly')+' /></div>';
  h+='<div class="form-group"><label>Display Name</label><input id="mf-name" value="'+escA(existing?existing.name||'':'')+'" placeholder="Optional" /></div></div>';
  h+='<div class="form-row"><div class="form-group"><label>Context Window</label><input id="mf-ctx" type="number" value="'+(existing?existing.contextWindow||'':'')+'" placeholder="200000" /></div>';
  h+='<div class="form-group"><label>Max Tokens</label><input id="mf-maxTok" type="number" value="'+(existing?existing.maxTokens||'':'')+'" placeholder="16384" /></div></div>';
  h+='<div class="form-row"><div class="form-group"><label>Input Cost ($/1M)</label><input id="mf-costIn" type="number" step="any" value="'+(existing&&existing.cost?existing.cost.input||'':'')+'" placeholder="0" /></div>';
  h+='<div class="form-group"><label>Output Cost ($/1M)</label><input id="mf-costOut" type="number" step="any" value="'+(existing&&existing.cost?existing.cost.output||'':'')+'" placeholder="0" /></div></div>';
  h+='<div class="form-group"><label><input type="checkbox" id="mf-reasoning" '+(existing&&existing.reasoning?'checked':'')+' /> Reasoning</label></div>';
  h+='<div class="btn-row"><button class="btn btn-primary" onclick="saveModelForm('+escA(provId)+','+(isNew?'true':'false')+')">Save</button><button class="btn btn-secondary" onclick="cancelEdit()">Cancel</button></div></div>';
  return h;
}

function saveModelForm(provId,isNew){
  var id=document.getElementById('mf-id').value.trim();
  if(!id){showErr('Model ID is required');return}
  var m={id:id};
  var name=document.getElementById('mf-name').value.trim();
  if(name)m.name=name;
  var ctx=parseInt(document.getElementById('mf-ctx').value);
  if(ctx>0)m.contextWindow=ctx;
  var maxTok=parseInt(document.getElementById('mf-maxTok').value);
  if(maxTok>0)m.maxTokens=maxTok;
  var costIn=parseFloat(document.getElementById('mf-costIn').value);
  var costOut=parseFloat(document.getElementById('mf-costOut').value);
  if(!isNaN(costIn)||!isNaN(costOut))m.cost={input:isNaN(costIn)?0:costIn,output:isNaN(costOut)?0:costOut,cacheRead:0,cacheWrite:0};
  m.reasoning=document.getElementById('mf-reasoning').checked;
  if(isNew)vsc.postMessage({type:'addModel',providerName:provId,model:m});
  else vsc.postMessage({type:'updateModel',providerName:provId,modelId:id,updates:m});
}

// ====== OAuth ======
function renderOAuth(){
  var el=document.getElementById('tab-oauth'),items=VD.oauthStatuses||[],h='';
  if(!items.length){el.innerHTML='<div class="empty">No OAuth providers available</div>';return}
  if(oauthState){h+=renderOAuthProgress();el.innerHTML=h;return}
  for(var i=0;i<items.length;i++){
    var p=items[i];
    h+='<div class="oauth-item">';
    h+='<span class="status-dot '+(p.connected?'on':'off')+'"></span>';
    h+='<span class="provider-name">'+escH(p.name)+'</span>';
    if(p.connected)h+='<button class="btn btn-sm btn-secondary" onclick="oauthLogout('+escA(p.id)+')">Logout</button>';
    else h+='<button class="btn btn-sm btn-primary" onclick="oauthLogin('+escA(p.id)+')">Login</button>';
    h+='</div>';
  }
  el.innerHTML=h;
}

function oauthLogin(id){vsc.postMessage({type:'oauthLogin',providerId:id})}
function oauthLogout(id){vsc.postMessage({type:'oauthLogout',providerId:id})}

function renderOAuthProgress(){
  var s=oauthState,h='<div class="oauth-progress">';
  if(s.type==='auth_url'){
    h+='<strong>Authorize</strong>';
    h+='<div class="url"><a href="'+escA(s.url)+'" target="_blank">'+escH(s.url)+'</a></div>';
    if(s.instructions)h+='<p style="font-size:11px;opacity:.7">'+escH(s.instructions)+'</p>';
    h+='<div class="oauth-prompt"><label>Or paste authorization code:</label><input id="oauth-code" placeholder="Authorization code" /></div>';
    h+='<div class="btn-row"><button class="btn btn-primary" onclick="submitOAuthCode()">Submit</button><button class="btn btn-secondary" onclick="cancelOAuth()">Cancel</button></div>';
  }else if(s.type==='device_code'){
    h+='<strong>Device Code</strong>';
    h+='<p style="font-size:16px;font-weight:bold;letter-spacing:2px">'+escH(s.userCode||'')+'</p>';
    if(s.verificationUri)h+='<p><a href="'+escA(s.verificationUri)+'" target="_blank">'+escH(s.verificationUri)+'</a></p>';
    h+='<div class="btn-row"><button class="btn btn-secondary" onclick="cancelOAuth()">Cancel</button></div>';
  }else if(s.type==='prompt'){
    h+='<strong>'+escH(s.message||'Input required')+'</strong>';
    h+='<div class="oauth-prompt"><input id="oauth-input" placeholder="'+escA(s.placeholder||'')+'" /></div>';
    h+='<div class="btn-row"><button class="btn btn-primary" onclick="submitOAuthInput('+escA(s.token||'')+')">Submit</button><button class="btn btn-secondary" onclick="cancelOAuth()">Cancel</button></div>';
  }else if(s.type==='select'){
    h+='<strong>'+escH(s.message||'Select')+'</strong>';
    var opts=s.options||[];
    for(var i=0;i<opts.length;i++)h+='<div class="btn-row"><button class="btn btn-primary" onclick="submitOAuthSelect('+escA(s.token||'')+','+escA(opts[i].id)+')">'+escH(opts[i].label)+'</button></div>';
    h+='<div class="btn-row"><button class="btn btn-secondary" onclick="cancelOAuth()">Cancel</button></div>';
  }else if(s.type==='progress'){
    h+='<p>'+escH(s.message||'Working...')+'</p>';
  }else if(s.type==='success'){
    h+='<p style="color:#4caf50">✓ Connected successfully!</p>';
  }else if(s.type==='error'){
    h+='<p style="color:#d32f2f">Error: '+escH(s.message||'')+'</p>';
    h+='<button class="btn btn-sm btn-secondary" onclick="oauthState=null;renderOAuth()">Dismiss</button>';
  }else if(s.type==='cancelled'){
    h+='<p>Login cancelled.</p>';
    h+='<button class="btn btn-sm btn-secondary" onclick="oauthState=null;renderOAuth()">Dismiss</button>';
  }
  h+='</div>';
  return h;
}

function submitOAuthCode(){var code=document.getElementById('oauth-code').value.trim();if(code&&oauthState&&oauthState.token)vsc.postMessage({type:'oauthRespond',token:oauthState.token,value:code})}
function submitOAuthInput(token){var val=document.getElementById('oauth-input').value.trim();if(val)vsc.postMessage({type:'oauthRespond',token:token,value:val})}
function submitOAuthSelect(token,id){vsc.postMessage({type:'oauthRespond',token:token,value:id})}
function cancelOAuth(){vsc.postMessage({type:'oauthCancel'});oauthState=null;renderOAuth()}

// ====== API Keys ======
function renderApiKeys(){
  var el=document.getElementById('tab-apikeys'),items=VD.apikeyStatuses||[],h='';
  if(!items.length){el.innerHTML='<div class="empty">No API key providers found</div>';return}
  for(var i=0;i<items.length;i++){
    var p=items[i];
    h+='<div class="apikey-item">';
    h+='<span class="status-dot '+(p.configured?'on':'off')+'"></span>';
    h+='<span class="provider-name">'+escH(p.name)+' <span style="font-size:10px;opacity:.6">('+p.modelCount+' models)</span></span>';
    if(p.configured)h+='<button class="btn btn-sm btn-danger" onclick="removeApiKey('+escA(p.id)+')">Remove</button>';
    else h+='<button class="btn btn-sm btn-primary" onclick="showApiKeyInput('+escA(p.id)+')">Set Key</button>';
    h+='</div>';
    if(VD._apiKeyEditing===p.id){
      h+='<div class="detail"><div class="form-group"><label>API Key for '+escH(p.name)+'</label><input id="apikey-input" type="password" placeholder="sk-..." /></div>';
      h+='<div class="btn-row"><button class="btn btn-primary" onclick="saveApiKey('+escA(p.id)+')">Save</button><button class="btn btn-secondary" onclick="VD._apiKeyEditing=null;renderApiKeys()">Cancel</button></div></div>';
    }
  }
  el.innerHTML=h;
}

function showApiKeyInput(id){VD._apiKeyEditing=id;renderApiKeys()}
function saveApiKey(id){var key=document.getElementById('apikey-input').value.trim();if(!key){showErr('API key is required');return}vsc.postMessage({type:'saveApiKey',providerId:id,apiKey:key})}
function removeApiKey(id){if(confirm('Remove API key for "'+id+'"?'))vsc.postMessage({type:'removeApiKey',providerId:id})}

// ====== Message handler ======
window.addEventListener('message',function(e){
  var msg=e.data;
  console.log('[pi-vscode models] received msg type:', msg.type, 'full msg:', JSON.stringify(msg).slice(0,200));
  if(msg.type==='data'){VD=msg.data;console.log('[pi-vscode models] data providers:', VD?VD.providers.length:'no VD', 'VD:', JSON.stringify(VD).slice(0,500));renderAll()}
  else if(msg.type==='oauthProgress'){oauthState=msg.event;if(activeTab==='oauth')renderOAuth()}
  else if(msg.type==='error'){showErr(msg.message)}
});
</script>
</body></html>`;
}
