(function(){'use strict';
const PK='themeEditorPresets_v1',WK='nativeWidgetSettings_v1';
const METRICS=["tours","distance","ascent","peaks","steps","time","speed","gradient","ascentRate"],FLAGS={"tours":"showTours","distance":"showDistance","ascent":"showAscent","peaks":"showPeaks","steps":"showSteps","time":"showTime","speed":"showSpeed","gradient":"showGradient","ascentRate":"showAscentRate"};
const DEF={title:'BERGJAHR',showTours:true,showDistance:true,showAscent:true,showPeaks:true,showSteps:true,showTime:true,showSpeed:false,showGradient:false,showAscentRate:false,metricOrder:[...METRICS],background:'alpine'};
let active=false,dirty=false,saving=false,widget={...DEF},bound=false;
const isNativeAndroidShell=()=>document.documentElement.classList.contains('android-native-shell')||(/Android/i.test(navigator.userAgent||'')&&(navigator.userAgent||'').includes('; wv)'));const get=k=>{try{return typeof appStorage!=='undefined'&&appStorage?appStorage.get(k):null;}catch(_){return null;}};
const set=(k,v)=>{try{if(typeof appStorage!=='undefined'&&appStorage?.set)appStorage.set(k,v);}catch(_){}try{localStorage.setItem(k,JSON.stringify(v));}catch(_){}};
const list=()=>document.getElementById('te-widget-metrics'),choices=()=>Array.from(list()?.querySelectorAll('[data-widget-choice]')||[]),checked=()=>choices().filter(r=>r.querySelector('[data-widget-metric]')?.checked);
function updateWidgetMetricUi(){const on=checked(),counter=document.getElementById('te-widget-count');if(counter)counter.textContent=on.length+'/6';choices().forEach(r=>{const box=r.querySelector('[data-widget-metric]'),at=on.indexOf(r);r.querySelectorAll('[data-widget-move]').forEach(btn=>{const d=Number(btn.dataset.widgetMove);btn.disabled=at<0||(d<0?at===0:at===on.length-1);});if(box)box.disabled=!box.checked&&on.length>=6;});}
function sortChoices(){const rows=choices(),on=rows.filter(r=>r.querySelector('[data-widget-metric]')?.checked),off=rows.filter(r=>!r.querySelector('[data-widget-metric]')?.checked);list()?.replaceChildren(...on,...off);updateWidgetMetricUi();}
function moveMetric(btn){const row=btn.closest('[data-widget-choice]'),on=checked(),from=on.indexOf(row),to=from+Number(btn.dataset.widgetMove);if(from<0||to<0||to>=on.length)return;[on[from],on[to]]=[on[to],on[from]];const off=choices().filter(r=>!r.querySelector('[data-widget-metric]')?.checked);list()?.replaceChildren(...on,...off);widget=readWidget();updateWidgetMetricUi();mark();}
function readWidget(){const n={...widget},t=document.getElementById('te-widget-title'),bg=document.getElementById('te-widget-background');if(t)n.title=(t.value||'BERGJAHR').trim().slice(0,20)||'BERGJAHR';if(bg)n.background=bg.value==='dark'?'dark':'alpine';choices().forEach(r=>{const id=r.dataset.widgetChoice;if(FLAGS[id])n[FLAGS[id]]=!!r.querySelector('[data-widget-metric]')?.checked;});let on=checked().map(r=>r.dataset.widgetChoice);if(!on.length&&choices()[0]){const r=choices()[0];r.querySelector('[data-widget-metric]').checked=true;n[FLAGS[r.dataset.widgetChoice]]=true;on=[r.dataset.widgetChoice];}n.metricOrder=on.concat(choices().map(r=>r.dataset.widgetChoice).filter(id=>!on.includes(id)));return n;}
function fillWidget(v){widget={...DEF,...(v&&typeof v==='object'?v:{})};const t=document.getElementById('te-widget-title'),bg=document.getElementById('te-widget-background');if(t)t.value=widget.title||'BERGJAHR';if(bg)bg.value=widget.background==='dark'?'dark':'alpine';const order=Array.isArray(widget.metricOrder)?widget.metricOrder:DEF.metricOrder,rows=choices(),map=new Map(rows.map(r=>[r.dataset.widgetChoice,r]));list()?.replaceChildren(...[...new Set([...order,...METRICS])].map(id=>map.get(id)).filter(Boolean));rows.forEach(r=>{const id=r.dataset.widgetChoice,box=r.querySelector('[data-widget-metric]');if(box)box.checked=widget[FLAGS[id]]===true;});let on=checked();if(!on.length&&rows[0])rows[0].querySelector('[data-widget-metric]').checked=true;on=checked();if(on.length>6)on.slice(6).forEach(r=>r.querySelector('[data-widget-metric]').checked=false);sortChoices();}
let widgetRequestCounter=0;
function sendWidget(v){
 const nativeRequest=window.__androidNativeRequest;
 if(typeof nativeRequest!=='function'){
  if(isNativeAndroidShell())return Promise.reject(new Error('Die gemeinsame Android-Nachrichtenverbindung ist nicht verfügbar.'));
  return Promise.resolve({status:'not-native'});
 }
 const c={...DEF,...v};
 const payload={title:String(c.title||'BERGJAHR').slice(0,20),background:c.background==='dark'?'dark':'alpine',metricOrder:(c.metricOrder||DEF.metricOrder).filter(id=>METRICS.includes(id))};
 METRICS.forEach(id=>payload[FLAGS[id]]=!!c[FLAGS[id]]);
 return nativeRequest('widget.yearStats.settings',payload,12000).then(message=>{
  if(!message||message.type!=='widget.yearStats.settings.result')throw new Error('Android hat eine unerwartete Antwort auf die Widget-Konfiguration gesendet.');
  if(message.ok!==true)throw new Error(message.error||'Android hat die Widget-Einstellungen nicht übernommen.');
  const widgetCount=Number(message.widgetCount)||0;
  if(widgetCount<1)throw new Error('Android hat die Einstellungen gespeichert, findet aber kein platziertes Bergjahr-Widget dieser App.');
  return {status:'synced',widgetCount};
 });
}
function allPresets(){const p=get(PK);return p&&typeof p==='object'&&!Array.isArray(p)?p:{};}
function renderPresets(sel){const el=document.getElementById('te-preset-select');if(!el)return;el.innerHTML='<option value="">Kein Preset ausgewählt</option>';Object.keys(allPresets()).sort((a,b)=>a.localeCompare(b,'de')).forEach(n=>{const o=document.createElement('option');o.value=n;o.textContent=n;el.appendChild(o);});el.value=sel&&allPresets()[sel]?sel:'';}
function snapshot(){return{version:1,editor:window.getThemeEditorUnifiedSettings?.()||{},background:window.getAppBackgroundSettings?.()||{},dashboard:window.__getDashboardEditorDraft?.()||{},widget:readWidget(),appStart:window.getAppStartSettings?.()||{}};}
function preview(){const el=document.getElementById('theme-editor-gradient-preview');if(!el)return;const x=window.getThemeEditorUnifiedSettings?.()||{},a=x.accent||'#ad7d12',b=x.accent2||'#000000',t=Math.max(10,Math.min(90,Number(x.transition)||55)),d=x.gradientDirection||'180deg';el.style.background=d==='radial'?'radial-gradient(circle at 28% 18%,'+a+' 0%,'+a+' '+t+'%,'+b+' 100%)':'linear-gradient('+d+','+a+' 0%,'+a+' '+t+'%,'+b+' 100%)';}
async function loadPreset(n){const p=allPresets()[n];if(!p)return;window.setThemeEditorUnifiedSettings?.(p.editor||{});await window.setAppBackgroundSettingsSnapshot?.(p.background||{});await window.refreshAppBackgroundPicker?.();window.__setDashboardEditorDraft?.(p.dashboard||{});fillWidget(p.widget||DEF);await window.setAppStartSettingsSnapshot?.(p.appStart||{});preview();mark();const s=document.getElementById('te-preset-status');if(s)s.textContent='Preset „'+n+'“ geladen.';}
function paint(){const s=document.getElementById('theme-editor-savebar-status'),b=document.getElementById('theme-editor-save');if(s)s.textContent=dirty?'Ungespeicherte Änderungen':'Alle Änderungen gespeichert';if(b)b.disabled=!dirty||saving;}
function setSavebarVisible(v){const el=document.getElementById('theme-editor-savebar');if(el)el.hidden=!v;}
function mark(){if(active&&!saving){dirty=true;paint();}}
function handleMetricChange(box){if(!box)return;const on=checked();if(box.checked&&on.length>6){box.checked=false;window.showToast?.('Es können höchstens sechs Kennzahlen ausgewählt werden.');}if(!box.checked&&checked().length===0){box.checked=true;window.showToast?.('Mindestens eine Kennzahl muss ausgewählt bleiben.');}sortChoices();widget=readWidget();}
async function begin(syncWidget=true){if(active)return;active=true;setSavebarVisible(true);dirty=false;try{await window.beginAppBackgroundEditorDraft?.();}catch(e){console.warn('[Editor] Bildentwurf:',e);}window.__beginDashboardEditorDraft?.();fillWidget(get(WK));window.__beginAppStartEditorDraft?.();renderPresets();preview();paint();if(syncWidget&&isNativeAndroidShell())sendWidget(widget).catch(error=>console.warn('[Editor] Gespeicherte Widget-Einstellungen konnten beim Öffnen nicht synchronisiert werden:',error));if(bound)return;bound=true;const root=document.getElementById('theme-view');root?.addEventListener('input',e=>{if(e.target.closest('.theme-editor-card,#theme-editor-widget-section,#dashboard-editor-body')){if(e.target.matches('[data-widget-metric]'))handleMetricChange(e.target);mark();preview();if(e.target.matches('[data-widget-metric],#te-widget-title,#te-widget-background'))widget=readWidget();}});root?.addEventListener('change',e=>{if(e.target.closest('.theme-editor-card,#theme-editor-widget-section,#dashboard-editor-body')){if(e.target.matches('[data-widget-metric]'))handleMetricChange(e.target);mark();preview();if(e.target.matches('[data-widget-metric],#te-widget-title,#te-widget-background'))widget=readWidget();}});root?.addEventListener('click',e=>{const move=e.target.closest('[data-widget-move]');if(move){moveMetric(move);return;}if(e.target.closest('#background-image-presets,#background-image-choose-file,#background-image-remove-custom,#background-image-activate-custom,#background-image-center-position,[data-background-profile],[data-editor-move],#te-app-start-image-choose,#te-app-start-image-remove')){mark();preview();}});document.getElementById('te-preset-save')?.addEventListener('click',async()=>{const n=(document.getElementById('te-preset-name')?.value||'').trim().slice(0,32),s=document.getElementById('te-preset-status');if(!n){if(s)s.textContent='Bitte zuerst einen Preset-Namen eingeben.';return;}try{await window.persistAppBackgroundDraftAsset?.();const p=allPresets();p[n]=snapshot();set(PK,p);renderPresets(n);if(s)s.textContent='Preset „'+n+'“ gespeichert.';}catch(e){console.error('[Editor] Preset-Bild konnte nicht gespeichert werden:',e);if(s)s.textContent='Preset konnte nicht gespeichert werden. Bitte erneut versuchen.';}});document.getElementById('te-preset-load')?.addEventListener('click',async()=>{const n=document.getElementById('te-preset-select')?.value;if(n)await loadPreset(n);});document.getElementById('te-preset-delete')?.addEventListener('click',()=>{const n=document.getElementById('te-preset-select')?.value;if(!n)return;const p=allPresets();delete p[n];set(PK,p);renderPresets();const s=document.getElementById('te-preset-status');if(s)s.textContent='Preset „'+n+'“ gelöscht.';});}
async function commit(){
   if(saving)return {saved:false};
   saving=true;paint();
   let savedWidget;
   try{
     widget=readWidget();
     await window.commitAppBackgroundEditorDraft?.();
     window.persistThemeEditorUnifiedSettings?.();
     window.__commitDashboardEditorDraft?.();
     savedWidget={...widget,metricOrder:[...(widget.metricOrder||[])]};
     set(WK,savedWidget);
     await window.__commitAppStartEditorDraft?.();
     dirty=false;
     active=false;
   }catch(error){
     saving=false;paint();
     throw error;
   }
   saving=false;paint();
   let widgetSync={status:'not-native'};
   try{
     widgetSync=await sendWidget(savedWidget);
   }catch(error){
     widgetSync={status:'failed',message:error?.message||'Keine Bestätigung von Android erhalten.'};
     console.warn('[Editor] Editor-Einstellungen gespeichert; Android-Widget konnte nicht aktualisiert werden:',error);
   }
   await begin(false);
   if(widgetSync.status==='failed'){
     const status=document.getElementById('theme-editor-savebar-status');
     if(status)status.textContent='Editor gespeichert · Widget nicht aktualisiert';
   }
   return {saved:true,widgetSync};
 }
async function discard(){if(!active||saving)return;setSavebarVisible(false);await window.discardAppBackgroundEditorDraft?.();window.setThemeEditorUnifiedSettings?.(get('themeEditorUnifiedSettings_v1')||{});window.__discardDashboardEditorDraft?.();fillWidget(get(WK));await window.__discardAppStartEditorDraft?.();dirty=false;active=false;paint();}
window.__commitPremiumEditorSettings=commit;const init=window.initThemeEditor;if(typeof init==='function'&&!init.__premiumWorkflowWrapped){const wrap=function(){const r=init.apply(this,arguments);begin().catch(console.warn);return r;};wrap.__premiumWorkflowWrapped=true;window.initThemeEditor=wrap;}const nav=window.goToView;if(typeof nav==='function'&&!nav.__premiumWorkflowWrapped){const wrap=function(v){const was=document.getElementById('theme-view')?.classList.contains('visible')||document.getElementById('theme-view')?.classList.contains('active');if(was&&v!=='theme'&&v!=='theme-view')discard();return nav.apply(this,arguments);};wrap.__premiumWorkflowWrapped=true;window.goToView=wrap;}document.addEventListener('DOMContentLoaded',paint,{once:true});})();