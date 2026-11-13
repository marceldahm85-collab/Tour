/* Gipfelfoto-Jahresordner für Stats > Gipfel. */
(() => {
'use strict';
const KEY='tour.stats.summit-photo-folders.v1', COLLAPSE='tour.stats.collapsible-sections.v1';
let root=null, token=0, nativeReady=null, images=[], viewer=null, viewerIndex=0, viewerHistory=false, viewerToken=0, observer=null, thumbs=null;
const request=(type,payload,timeout)=>{if(typeof window.__androidNativeRequest!=='function')return Promise.reject(new Error('Native Android-Galerie nicht verfügbar.'));return window.__androidNativeRequest(type,payload||{},timeout||30000);};
const folders=()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return x&&typeof x==='object'&&!Array.isArray(x)?x:{};}catch(_){return {};}};
const collapseState=()=>{try{return JSON.parse(localStorage.getItem(COLLAPSE)||'{}')||{};}catch(_){return {};}};
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const filterYear=()=>document.getElementById('stats-year-select')?.value||String(new Date().getFullYear());
const ASSIGNMENTS_KEY='summitPhotoAssignments.v1';
function getAssignments(){try{return typeof appStorage!=='undefined'?(appStorage.get(ASSIGNMENTS_KEY)||{}):{};}catch(_){return {};}}
function saveAssignments(value){try{if(typeof appStorage!=='undefined')appStorage.set(ASSIGNMENTS_KEY,value);else localStorage.setItem(ASSIGNMENTS_KEY,JSON.stringify(value));}catch(e){console.warn('Gipfelfoto-Zuordnung konnte nicht gespeichert werden.',e);}}
function getTours(){try{return typeof appStorage!=='undefined'?(appStorage.get('touren')||[]):[];}catch(_){return [];}}
function normalizeTourDate(value){
 const raw=String(value||'').trim();let m=raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
 if(m)return m[1]+'-'+m[2]+'-'+m[3];
 m=raw.match(/^(\d{1,2})[.\/]([0-9]{1,2})[.\/](\d{4})$/);
 if(m)return m[3]+'-'+String(m[2]).padStart(2,'0')+'-'+String(m[1]).padStart(2,'0');
 return '';
}
function toursForDate(date){return getTours().filter(t=>normalizeTourDate(t?.date)===date);}
function assignmentFor(uri){return getAssignments()[uri]||null;}
function renderAssignmentPanel(item,context){
 const panel=viewer?.querySelector('.summit-gallery-assignment');if(!panel)return;
 const caption=viewer?.querySelector('.summit-gallery-photo-caption');
 const setCaption=(name,height)=>{if(!caption)return;if(!name){caption.hidden=true;caption.innerHTML='';return;}caption.innerHTML='<span class="summit-gallery-photo-caption-name">'+esc(name)+'</span>'+(height?'<span class="summit-gallery-photo-caption-height">'+Number(height).toLocaleString('de-AT')+' m</span>':'');caption.hidden=false;};
 const saved=assignmentFor(item.uri);
 if(context?.status==='loading'){setCaption('');panel.innerHTML='<div class="summit-gallery-assignment-note">Aufnahmedatum wird geprüft …</div>';return;}
 if(context?.status!=='ok'){setCaption('');panel.innerHTML='<div class="summit-gallery-assignment-note">Kein EXIF-Aufnahmedatum vorhanden. Eine automatische Tourzuordnung ist deshalb nicht möglich.</div>';return;}
 const matches=toursForDate(context.dateTaken);
 if(matches.length===0){setCaption('');panel.innerHTML='<div class="summit-gallery-assignment-note">Aufnahmedatum '+esc(context.dateTaken)+' · Keine passende Tour gefunden.</div>';return;}
 if(matches.length!==1){setCaption('');panel.innerHTML='<div class="summit-gallery-assignment-note">Für '+esc(context.dateTaken)+' wurden mehrere Touren gefunden. Eine eindeutige Zuordnung ist nicht möglich.</div>';return;}
 const tour=matches[0],peaks=Array.isArray(tour.gipfelDetails)?tour.gipfelDetails:[];
 if(!peaks.length){setCaption('');panel.innerHTML='<div class="summit-gallery-assignment-note">'+esc(tour.tourname||'Tour')+' · Keine Gipfel in dieser Tour hinterlegt.</div>';return;}
 const selected=saved&&String(saved.tourId||'')===String(tour.id||'')?Number(saved.peakIndex):-1;
 const selectedPeak=selected>=0?peaks[selected]:null;
 const selectedName=selectedPeak?String(selectedPeak.name||'Gipfel '+(selected+1)):'';
 const selectedHeight=selectedPeak?(Number(String(selectedPeak.hoehe||'').replace(/[^0-9]/g,''))||0):0;
 setCaption(selectedPeak?selectedName:'',selectedHeight);
 const peakLabel=peak=>{const name=String(peak?.name||'Gipfel'),height=Number(String(peak?.hoehe||'').replace(/[^0-9]/g,''))||0;return name+(height?' · '+height.toLocaleString('de-AT')+' m':'');};
 const currentLabel=selectedPeak?peakLabel(selectedPeak):'Keinem Gipfel zuordnen';
 const options=['<button type="button" class="summit-gallery-peak-option'+(selected<0?' is-selected':'')+'" data-peak-option="">Keinem Gipfel zuordnen</button>'].concat(peaks.map((peak,index)=>
  '<button type="button" class="summit-gallery-peak-option'+(selected===index?' is-selected':'')+'" data-peak-option="'+index+'">'+esc(peakLabel(peak))+'</button>'
 )).join('');
 panel.innerHTML='<div class="summit-gallery-assignment-meta"><strong>'+esc(tour.tourname||'Tour')+'</strong><span>'+esc(context.dateTaken)+'</span></div><button type="button" class="summit-gallery-peak-trigger" data-peak-trigger aria-expanded="false"><span>'+esc(currentLabel)+'</span><span class="summit-gallery-peak-chevron" aria-hidden="true">⌄</span></button><div class="summit-gallery-peak-options" data-peak-options hidden>'+options+'</div>';
 const all=getAssignments();
 panel.querySelector('[data-peak-trigger]')?.addEventListener('click',event=>{
  const list=panel.querySelector('[data-peak-options]'),open=list?.hidden===true;
  if(list)list.hidden=!open;
  event.currentTarget.setAttribute('aria-expanded',open?'true':'false');
 });
 panel.querySelectorAll('[data-peak-option]').forEach(button=>button.addEventListener('click',()=>{
  const value=button.dataset.peakOption;
  if(value===''){delete all[item.uri];saveAssignments(all);renderAssignmentPanel(item,context);return;}
  const index=Number(value),peak=peaks[index];if(!peak)return;
  all[item.uri]={tourId:String(tour.id||''),tourDate:context.dateTaken,peakIndex:index,peakName:String(peak.name||''),peakHeight:Number(String(peak.hoehe||'').replace(/[^0-9]/g,''))||0};
  saveAssignments(all);renderAssignmentPanel(item,context);
 }));
}
async function getPhotoContext(item){
 if(item._photoContext&&item._photoContext.status!=='loading')return item._photoContext;
 if(item._photoContextPromise)return item._photoContextPromise;
 item._photoContext={status:'loading'};
 item._photoContextPromise=(async()=>{
  try{
   const result=await request('gallery.summit.folder.date',{uri:item.uri},30000);
   item._photoContext=result.status==='ok'&&/^\d{4}-\d{2}-\d{2}$/.test(result.dateTaken||'')?{status:'ok',dateTaken:result.dateTaken}:{status:result.status||'no_date'};
  }catch(_){item._photoContext={status:'no_date'};}
  return item._photoContext;
 })();
 return item._photoContextPromise;
}

function setExpanded(section,on){const state=collapseState();state['peaks:gipfelfotos']=on;try{localStorage.setItem(COLLAPSE,JSON.stringify(state));}catch(_){}section.classList.toggle('is-collapsed',!on);section.querySelector(':scope > .stats-analysis-title')?.setAttribute('aria-expanded',on?'true':'false');}
function ensureSection(){
 if(!root)root=document.getElementById('stats-peaks-content');if(!root)return null;
 let section=root.querySelector(':scope > .summit-gallery-section');
 if(!section){section=document.createElement('section');section.className='stats-analysis-section stats-section-collapsible summit-gallery-section';section.dataset.statsCollapseKey='peaks:gipfelfotos';
 section.innerHTML='<div class="stats-analysis-title" role="button" tabindex="0" aria-expanded="false" aria-label="Gipfelfotos öffnen"><span>Gipfelfotos</span></div><div class="summit-gallery-content"><div class="summit-gallery-management"></div><div class="summit-gallery-images"></div></div>';
 const state=collapseState(),on=Object.prototype.hasOwnProperty.call(state,'peaks:gipfelfotos')&&state['peaks:gipfelfotos']===true;section.classList.toggle('is-collapsed',!on);section.querySelector('.stats-analysis-title').setAttribute('aria-expanded',on?'true':'false');root.appendChild(section);}

 return section;
}
async function checkNative(){if(!nativeReady)nativeReady=request('bridge.ping',{},9000).then(r=>{const f=new Set(r.features||[]);if(!f.has('gallery.summit.folder.v1')||!f.has('gallery.summit.image.v1')||!f.has('gallery.summit.exif-date.v1'))throw new Error('Bitte installiere die aktuelle Android-App-Version.');return true;});return nativeReady;}
function setMessage(el,msg,error){el.innerHTML='<div class="summit-gallery-empty"'+(error?' data-kind="error"':'')+'>'+esc(msg)+'</div>';}
function manageHtml(year,folder){if(!/^\d{4}$/.test(year))return '';if(!folder)return '<div class="summit-gallery-folder-row"><div class="summit-gallery-folder-copy"><strong>'+year+'</strong><span>Noch kein Gipfelfoto-Ordner für dieses Jahr verknüpft.</span></div><button type="button" class="summit-gallery-action summit-gallery-action-primary" data-pick="'+year+'">Ordner auswählen</button></div>';return '<div class="summit-gallery-folder-row"><div class="summit-gallery-folder-copy"><strong>'+year+'</strong><span>'+esc(folder.name||'Ausgewählter Ordner')+'</span></div><div class="summit-gallery-folder-actions"><button type="button" class="summit-gallery-action summit-gallery-action-primary" data-pick="'+year+'">Ordner ändern</button><button type="button" class="summit-gallery-action" data-remove="'+year+'">Entfernen</button></div></div>';}
async function pick(year,button){button.disabled=true;const old=folders()[year]?.uri;try{await checkNative();const r=await request('gallery.summit.folder.pick',{year:Number(year)},180000);if(r.status==='cancelled')return;if(r.status!=='ok'||!r.uri)throw new Error(r.error||'Ordnerauswahl fehlgeschlagen.');const f=folders();f[year]={uri:r.uri,name:r.name||'Ausgewählter Ordner'};localStorage.setItem(KEY,JSON.stringify(f));if(old&&old!==r.uri&&!Object.values(f).some(x=>x?.uri===old))request('gallery.summit.folder.release',{uri:old},10000).catch(()=>{});}catch(e){const s=ensureSection();setMessage(s.querySelector('.summit-gallery-images'),e.message||'Ordnerauswahl fehlgeschlagen.',true);}finally{if(button.isConnected)button.disabled=false;render();}}
async function removeFolder(year,button){const f=folders(),uri=f[year]?.uri;if(!uri)return;button.disabled=true;delete f[year];localStorage.setItem(KEY,JSON.stringify(f));if(!Object.values(f).some(x=>x?.uri===uri)){try{await request('gallery.summit.folder.release',{uri},10000);}catch(_){}}render();}
async function readFolder(folder,year){const r=await request('gallery.summit.folder.list',{uri:folder.uri},45000);if(r.status!=='ok')throw new Error(r.status==='permission_changed'?'Ordnerzugriff nicht mehr verfügbar. Bitte Ordner erneut verknüpfen.':(r.error||'Ordner konnte nicht gelesen werden.'));return (r.images||[]).map(x=>Object.assign({},x,{year:String(year)}));}
async function render(){
 const s=ensureSection();if(!s)return;const id=++token,year=filterYear(),f=folders(),manage=s.querySelector('.summit-gallery-management'),display=s.querySelector('.summit-gallery-images');
 if(typeof window.__androidNativeRequest!=='function'){manage.innerHTML='';setMessage(display,'Die Gipfelfoto-Ordnergalerie steht in der nativen Android-App zur Verfügung.');return;}
 manage.innerHTML=/^\d{4}$/.test(year)?manageHtml(year,f[year]):'';
 const years=Object.keys(f).filter(y=>/^\d{4}$/.test(y)&&f[y]?.uri).filter(y=>year==='all'||(year==='past'&&Number(y)!==new Date().getFullYear())||y===year).sort((a,b)=>Number(a)-Number(b));
 if(!years.length){setMessage(display,year==='all'?'Noch sind keine Jahresordner verknüpft. Wähle ein bestimmtes Jahr, um einen Ordner hinzuzufügen.':year==='past'?'Für vergangene Jahre sind keine Gipfelfoto-Ordner verknüpft.':'Wähle einen Ordner für dieses Jahr aus.');return;}
 setMessage(display,'Gipfelfotos werden geladen …');
 try{await checkNative();const groups=await Promise.all(years.map(async y=>({year:y,photos:await readFolder(f[y],y)})));if(id!==token||!display.isConnected)return;
 const seen=new Set();const clean=groups.map(g=>({year:g.year,photos:g.photos.filter(p=>p.uri&&!seen.has(p.uri)&&seen.add(p.uri)).sort((a,b)=>Number(a.lastModified||0)-Number(b.lastModified||0))})).filter(g=>g.photos.length);
 images=clean.flatMap(g=>g.photos);if(!images.length){setMessage(display,'In den verknüpften Jahresordnern wurden keine Fotos gefunden.');return;}
 display.innerHTML=clean.map(g=>'<section class="summit-gallery-year-group">'+((year==='all'||year==='past')?'<div class="summit-gallery-year-label">'+g.year+'</div>':'')+'<div class="summit-gallery-grid">'+g.photos.map(p=>{const n=images.indexOf(p);return '<button type="button" class="summit-gallery-photo" data-photo="'+n+'" aria-label="Gipfelfoto '+g.year+'"><span class="summit-gallery-photo-placeholder"></span><img alt="" loading="lazy" decoding="async" data-thumb="'+esc(p.uri)+'"></button>';}).join('')+'</div></section>').join('');
 watchThumbs(display);
 }catch(e){if(id===token)setMessage(display,e.message||'Gipfelfotos konnten nicht geladen werden.',true);}
}
function watchThumbs(el){if(thumbs)thumbs.disconnect();thumbs=new IntersectionObserver(entries=>entries.forEach(e=>{if(!e.isIntersecting)return;thumbs.unobserve(e.target);loadThumb(e.target);}),{rootMargin:'180px 0px'});el.querySelectorAll('[data-thumb]').forEach(img=>thumbs.observe(img));}
async function loadThumb(img){if(img.dataset.loading==='1'||img.dataset.loaded==='1')return;img.dataset.loading='1';try{const r=await request('gallery.summit.folder.thumbnail',{uri:img.dataset.thumb},30000);if(!img.isConnected)return;if(r.status==='ok'&&r.data){img.src='data:'+(r.mimeType||'image/jpeg')+';base64,'+r.data;img.dataset.loaded='1';img.closest('.summit-gallery-photo')?.classList.add('has-image');}else img.closest('.summit-gallery-photo')?.classList.add('is-unavailable');}catch(_){if(img.isConnected)img.closest('.summit-gallery-photo')?.classList.add('is-unavailable');}finally{img.dataset.loading='0';}}
function ensureViewer(){if(viewer)return viewer;viewer=document.createElement('div');viewer.className='summit-gallery-viewer';viewer.hidden=true;viewer.innerHTML='<button type="button" class="summit-gallery-viewer-close" aria-label="Schließen">×</button><div class="summit-gallery-viewer-count"></div><div class="summit-gallery-viewer-stage"><img alt=""><div class="summit-gallery-photo-caption" hidden></div></div><div class="summit-gallery-assignment"></div>';document.body.appendChild(viewer);viewer.querySelector('button').addEventListener('click',closeViewer);const stage=viewer.querySelector('.summit-gallery-viewer-stage');let x=0,y=0;stage.addEventListener('touchstart',e=>{const t=e.changedTouches?.[0];if(t){x=t.clientX;y=t.clientY;}},{passive:true});stage.addEventListener('touchend',e=>{const t=e.changedTouches?.[0];if(!t)return;const dx=t.clientX-x,dy=t.clientY-y;if(Math.abs(dx)>58&&Math.abs(dx)>Math.abs(dy)*1.25)showImage(viewerIndex+(dx<0?1:-1));else if(dy>85&&Math.abs(dy)>Math.abs(dx)*1.25)closeViewer();},{passive:true});return viewer;}
async function showImage(n){if(!images.length)return;viewerIndex=(n+images.length)%images.length;const v=ensureViewer(),img=v.querySelector('img'),count=v.querySelector('.summit-gallery-viewer-count'),item=images[viewerIndex],id=++viewerToken;img.removeAttribute('src');count.textContent=(viewerIndex+1)+' / '+images.length+' · '+item.year;renderAssignmentPanel(item,{status:'loading'});getPhotoContext(item).then(context=>{if(id===viewerToken&&!v.hidden)renderAssignmentPanel(item,context);});try{const r=await request('gallery.summit.folder.full',{uri:item.uri},45000);if(id!==viewerToken||v.hidden)return;if(r.status!=='ok'||!r.data)throw new Error('Foto kann nicht geöffnet werden.');img.src='data:'+(r.mimeType||'image/jpeg')+';base64,'+r.data;}catch(e){if(id===viewerToken)count.textContent=e.message||'Foto nicht verfügbar';}}
function openViewer(n){if(!images.length)return;const v=ensureViewer();v.hidden=false;document.body.classList.add('summit-gallery-viewer-open');if(!viewerHistory){viewerHistory=true;history.pushState({summitPhotoViewer:true},'');}showImage(n);}
function closeViewer(){if(!viewer||viewer.hidden)return;const back=viewerHistory;viewerHistory=false;viewerToken++;viewer.hidden=true;document.body.classList.remove('summit-gallery-viewer-open');if(back)history.back();}
window.addEventListener('popstate',()=>{if(viewer&&!viewer.hidden){viewerHistory=false;viewerToken++;viewer.hidden=true;document.body.classList.remove('summit-gallery-viewer-open');}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&viewer&&!viewer.hidden)closeViewer();});
function init(){root=document.getElementById('stats-peaks-content');if(!root)return;root.addEventListener('click',e=>{const p=e.target.closest('[data-pick]');if(p){pick(p.dataset.pick,p);return;}const r=e.target.closest('[data-remove]');if(r){removeFolder(r.dataset.remove,r);return;}const photo=e.target.closest('[data-photo]');if(photo)openViewer(Number(photo.dataset.photo));});new MutationObserver(()=>{ensureSection();render();}).observe(root,{childList:true});ensureSection();document.getElementById('stats-year-select')?.addEventListener('change',render);render();}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();