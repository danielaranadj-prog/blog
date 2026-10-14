import { localToUtc, dayKey, escapeHtml, auditContent, templates, blocks, buildTripDraft } from './planner-utils.js';
const labels={draft:'Borrador',scheduled:'Programado',publishing:'Publicando',deploying:'Actualizando web',published:'Publicado',error:'Error'};
const $=id=>document.getElementById(id);
const esc=escapeHtml;
export async function initPlanner(bridge) {
  let posts=[],active=null,view='calendar',month=new Date(),zone='America/Mazatlan',saveTimer,dirty=false,editing=false,loading=false,items=[],media=[],busy=false,disposed=false;
  const urls=new Map(),mediaMetadata=new Map();
  const auth=bridge.auth;
  let recovered=null;
  async function recovery(op,value){
    try {
      const database=await new Promise((resolve,reject)=>{const r=indexedDB.open('instante-editor-recovery',1);r.onupgradeneeded=()=>r.result.createObjectStore('pending');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
      const result=await new Promise((resolve,reject)=>{const tx=database.transaction('pending',op==='get'?'readonly':'readwrite');const store=tx.objectStore('pending');const r=op==='get'?store.get(auth.currentUser.uid):op==='put'?store.put(value,auth.currentUser.uid):store.delete(auth.currentUser.uid);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});database.close();return result;
    }catch{return null;}
  }
  const workspace=document.querySelector('#app-section .workspace');
  const nav=document.createElement('nav'); nav.className='planner-nav';nav.setAttribute('aria-label','Redacción');
  nav.innerHTML=[['calendar','Calendario'],['articles','Artículos'],['ideas','Ideas'],['trips','Mi viaje'],['questions','Preguntas'],['media','Fotografías'],['stats','Resultados']].map(([key,title])=>`<button data-view="${key}" aria-current="false">${title}</button>`).join('');
  workspace.before(nav);
  const panel=document.createElement('main');panel.className='planner-panel';workspace.before(panel);
  const dialog=document.createElement('dialog');dialog.className='planner-dialog';dialog.setAttribute('aria-label','Herramientas de contenido');document.body.append(dialog);
  const publication=$('publish-card');
  publication.insertAdjacentHTML('beforeend',`<div class="schedule-fields"><label>Fecha y hora programada<input id="schedule-date" type="datetime-local" class="input-modern"></label><label>Zona horaria<select id="schedule-zone" class="input-modern">${['America/Mazatlan','America/Mexico_City','America/Cancun','America/Argentina/Buenos_Aires','Europe/Madrid','UTC'].map(z=>`<option>${z}</option>`).join('')}</select></label><label>Revisar información el<input id="review-date" type="date" class="input-modern"></label></div><div class="planner-publish-actions"><button id="save-draft" class="planner-button">Guardar borrador</button><button id="schedule-post" class="planner-button primary">Programar</button><button id="cancel-schedule" class="planner-button" hidden>Cancelar programación</button></div><p id="draft-state" role="status" aria-live="polite"></p><button id="audit-post" class="text-action">Revisar artículo y enlaces</button><button id="check-links" class="text-action">Comprobar enlaces del relato</button><ul id="post-audit" class="planner-audit"></ul>`);
  $('btn-publish').textContent='Publicar ahora';
  document.querySelector('.writing-shortcuts').insertAdjacentHTML('beforeend','<button id="insert-template">Plantilla</button><button id="insert-block">Añadir bloque</button><button id="open-library">Biblioteca de fotos</button><button id="editor-assistant">Asistente editorial</button>');
  $('post-hero').insertAdjacentHTML('afterend','<label class="field-label" for="hero-alt">Descripción de la portada</label><input id="hero-alt" class="input-modern" placeholder="Describe lo que aparece en la foto">');
  const state=$('draft-state');
  function notify(message,error=false){state.textContent=message;state.classList.toggle('planner-error',error);}
  async function api(action,data={}) {
    if(!auth.currentUser) throw Error('Tu sesión terminó. Inicia sesión para guardar.');
    const token=await auth.currentUser.getIdToken();
    const res=await fetch('/api/editor',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({action,...data})});
    const result=await res.json();if(!res.ok) {const e=Error(result.error||'No se pudo completar la operación.');e.status=res.status;throw e;} return result;
  }
  const protect=fn=>async(...args)=>{try{return await fn(...args);}catch(e){notify(e.message,true);bridge.toast(e.message,'error');}};
  function setCurrent(p){active=p;posts=posts.filter(x=>x.id!==p.id);posts.push(p);}
  function snapshot(){
    const p=bridge.read();const ids=new Set();
    for(const image of new DOMParser().parseFromString(p.html,'text/html').querySelectorAll('[data-media-id]')) ids.add(image.dataset.mediaId);
    if(p.hero.startsWith('media:'))ids.add(p.hero.slice(6));
    return {...p,id:active?.id,version:active?.version,heroAlt:$('hero-alt').value,reviewAt:$('review-date').value,timezone:$('schedule-zone').value,mediaIds:[...ids],tripId:active?.tripId||''};
  }
  function sameContent(a,b){ const fields=['title','description','html','date','author','hero','heroAlt','reviewAt','timezone','flightDestination','tourCity'];return fields.every(k=>(a?.[k]||'')===(b?.[k]||''))&&JSON.stringify(a?.tags||[])===JSON.stringify(b?.tags||[]); }
  async function save(mode='draft',auto=false){
    if(loading||busy) return null;
    const p=snapshot();
    if(!p.title.trim()&&!p.html.trim()&&!p.hero)return null;
    if(auto && active && ['published','scheduled','publishing','deploying'].includes(active.status)) {notify('Cambios sin guardar. Guarda el borrador o vuelve a programarlo.');return null;}
    if(mode==='scheduled'){
      p.scheduledAt=localToUtc($('schedule-date').value,p.timezone);
      if(!p.scheduledAt)throw Error('Selecciona fecha, hora y zona horaria.');
      const errors=auditContent(p).filter(x=>x.level==='error');if(errors.length)throw Error(errors.map(x=>x.message).join('\n'));
    }
    busy=true;notify('Guardando…');
    try{
      const result=await api(mode==='scheduled'?'schedule':'save',{post:p});setCurrent(result);
      dirty=!sameContent(snapshot(),p);
      notify(`${labels[result.status]} guardado · ${new Date().toLocaleTimeString('es',{hour:'2-digit',minute:'2-digit'})}${dirty?' · Hay cambios nuevos pendientes.':''}`);
      $('cancel-schedule').hidden=result.status!=='scheduled';
      if(dirty)queueSave();else {await recovery('delete');recovered=null;}return result;
    }finally{busy=false;}
  }
  function queueSave(){
    if(loading||!editing||disposed)return;dirty=true;clearTimeout(saveTimer);
    recovery('put',{...snapshot(),recoveredAt:Date.now()});
    notify('Cambios pendientes…');saveTimer=setTimeout(()=>protect(()=>save('draft',true))(),1800);
  }
  async function leave(){if(dirty){if(active&&['scheduled','published'].includes(active.status)&&!confirm('¿Guardar los cambios como borrador? Si estaba programado, se cancelará su programación; la versión pública seguirá disponible.'))return false;const r=await save();if(!r||dirty)return false;}editing=false;clearTimeout(saveTimer);return true;}
  async function showView(next){
    if(editing&&!await leave())return;
    view=next;workspace.hidden=true;panel.hidden=false;
    nav.querySelectorAll('button').forEach(b=>b.setAttribute('aria-current',String(b.dataset.view===next)));
    panel.innerHTML='<div class="planner-wrap"><p role="status">Cargando…</p></div>';
    try{
      if(next==='calendar'||next==='articles')await refresh();
      else if(['ideas','trips','questions'].includes(next))await renderItems(next);
      else if(next==='media')await renderMedia();
      else if(next==='stats')await renderStats();
    }catch(e){panel.innerHTML=`<div class="planner-wrap"><h1>No se pudo cargar esta sección</h1><p role="alert">${esc(e.message)}</p><button class="planner-button" data-retry>Reintentar</button><button class="planner-button" data-new>Escribir un artículo</button></div>`;}
  }
  async function refresh(){
    const data=await api('list');posts=data.posts;
    if(!posts.length&&bridge.isAdmin){await api('import');posts=(await api('list')).posts;}
    const ready=data.scheduler&&Date.now()-data.scheduler<180000;
    $('schedule-post').disabled=!ready;
    $('schedule-post').textContent=ready?'Programar':'Programar · pendiente de activación';
    $('schedule-post').title=ready?'Publicar automáticamente en la fecha elegida':'Pendiente de activar el servicio automático';
    renderMain(ready);
  }
  function matches(p,q,filter){return (!q||`${p.title} ${(p.tags||[]).join(' ')} ${p.author}`.toLowerCase().includes(q.toLowerCase()))&&(!filter||p.status===filter);}
  function entries(){const q=$('planner-search')?.value||'',filter=$('planner-filter')?.value||'';return posts.filter(p=>matches(p,q,filter));}
  function postDay(p){return p.status==='scheduled'&&p.scheduledAt?dayKey(p.scheduledAt,zone):(p.date||dayKey(p.updatedAt,zone));}
  function card(p){return `<article class="planner-card state-${p.status}"><span class="state-label">${esc(labels[p.status]||p.status)}</span><h2>${esc(p.title||'Sin título')}</h2><p>${esc(postDay(p))} · ${esc((p.tags||[]).join(' · '))}</p>${p.reviewAt&&p.reviewAt<=dayKey(Date.now(),zone)?'<p class="planner-review">Pendiente de revisar información</p>':''}${p.error?`<p class="planner-error">${esc(p.error)}</p>`:''}<button class="planner-button" data-open="${p.id}">Abrir</button>${p.publishedUrl?`<a class="text-action" href="${esc(p.publishedUrl)}" target="_blank" rel="noopener">Ver artículo ↗</a>`:''}${p.status==='deploying'?`<button class="planner-button" data-verify="${p.id}">Comprobar publicación</button>`:''}</article>`;}
  function renderMain(ready){
    const monthName=month.toLocaleDateString('es',{month:'long',year:'numeric'});
    panel.innerHTML=`<div class="planner-wrap"><div class="planner-heading"><div><span class="eyebrow">Tu mesa de trabajo</span><h1>${view==='calendar'?'Calendario editorial':'Todos tus artículos'}</h1><p class="planner-subtitle">Organiza las historias que vienen. Zona del calendario: ${esc(zone)}.</p></div><div class="planner-tools"><button class="planner-button" data-import>Sincronizar publicados</button><button class="planner-button primary" data-new>+ Nueva historia</button></div></div>${!ready?'<p class="planner-notice">La publicación automática está pendiente de activación. Ya puedes escribir y guardar borradores privados.</p>':''}${recovered?'<p class="planner-notice">Encontramos cambios locales que no terminaron de guardarse. <button class="planner-button" data-recover>Recuperar trabajo</button></p>':''}<div class="planner-tools"><input id="planner-search" class="input-modern planner-search" placeholder="Buscar título, destino o autor" aria-label="Buscar artículos"><select id="planner-filter" class="input-modern" aria-label="Filtrar estado"><option value="">Todos los estados</option>${Object.entries(labels).map(([k,l])=>`<option value="${k}">${l}</option>`).join('')}</select>${view==='calendar'?`<button class="planner-button" data-month="-1" aria-label="Mes anterior">←</button><strong>${esc(monthName)}</strong><button class="planner-button" data-month="1" aria-label="Mes siguiente">→</button><button class="planner-button" data-today>Hoy</button>`:''}</div><div id="planner-content"></div></div>`;
    drawContent();
    $('planner-search').addEventListener('input',drawContent);$('planner-filter').addEventListener('change',drawContent);
  }
  function drawContent(){
    const filtered=entries();
    if(view==='articles'){$('planner-content').innerHTML=filtered.length?`<div class="planner-cards">${filtered.sort((a,b)=>b.updatedAt-a.updatedAt).map(card).join('')}</div>`:'<p class="planner-empty">No hay artículos con este filtro.</p>';return;}
    const first=new Date(month.getFullYear(),month.getMonth(),1,12),start=new Date(first);start.setDate(1-((first.getDay()+6)%7));
    let grid='<div class="calendar-weekdays" style="display:grid;grid-template-columns:repeat(7,1fr)">'+['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'].map(d=>`<span class="calendar-weekday">${d}</span>`).join('')+'</div><div class="calendar-grid">';
    for(let i=0;i<42;i++){
      const d=new Date(start);d.setDate(start.getDate()+i);const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      grid+=`<section class="calendar-day ${d.getMonth()!==month.getMonth()?'outside':''} ${key===dayKey(Date.now(),zone)?'today':''}"><button class="calendar-add" data-date="${key}" aria-label="Crear artículo el ${key}">${d.getDate()} +</button>${filtered.filter(p=>postDay(p)===key).map(p=>`<button class="calendar-entry state-${p.status}" data-open="${p.id}"><small>${labels[p.status]}</small><strong>${esc(p.title||'Sin título')}</strong>${p.status==='scheduled'?`<small>${new Date(p.scheduledAt).toLocaleTimeString('es',{timeZone:zone,hour:'2-digit',minute:'2-digit'})}</small>`:''}</button>`).join('')}</section>`;
    }
    const monthKey=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}`;
    const agenda=filtered.filter(p=>postDay(p).startsWith(monthKey)).sort((a,b)=>postDay(a).localeCompare(postDay(b)));
    $('planner-content').innerHTML=grid+'</div>'+`<div class="planner-agenda"><p class="planner-subtitle">Agenda del mes · Usa “Nueva historia” para elegir una fecha.</p>${agenda.length?agenda.map(card).join(''):'<p class="planner-empty">Este mes está listo para nuevas historias.</p>'}</div>`;
  }
  async function hydrate(html){
    const doc=new DOMParser().parseFromString(html,'text/html');
    for(const image of doc.querySelectorAll('[data-media-id]')) {try{image.src=await mediaUrl(image.dataset.mediaId);}catch{image.removeAttribute('src');}}
    return doc.body.innerHTML;
  }
  async function openPost(id){
    if(editing&&!await leave())return;
    loading=true;
    try{
      const p=await api('get',{id});setCurrent(p);
      const html=await hydrate(p.html||bridge.fromMarkdown(p.markdown||''));
      bridge.write({...p,html});$('hero-alt').value=p.heroAlt||'';$('review-date').value=p.reviewAt||'';$('schedule-zone').value=p.timezone||zone;
      $('schedule-date').value=p.scheduledAt?localInput(p.scheduledAt,p.timezone||zone):`${p.date||dayKey(Date.now(),zone)}T10:00`;
      workspace.hidden=false;panel.hidden=true;editing=true;dirty=false;
      $('cancel-schedule').hidden=p.status!=='scheduled';notify(labels[p.status]+(p.error?` · ${p.error}`:''));
      await updateHeroPreview();runAudit();
    }finally{loading=false;}
  }
  function localInput(ms,tz){const parts=new Intl.DateTimeFormat('sv-SE',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(ms));return parts.replace(' ','T');}
  async function newPost(date=dayKey(Date.now(),zone),data={}){
    if(editing&&!await leave())return;
    loading=true;active=null;bridge.write({title:'',description:'',html:'',date,hero:'',tags:[],...data});$('hero-alt').value='';$('review-date').value='';$('schedule-date').value=`${date}T10:00`;$('schedule-zone').value=zone;
    workspace.hidden=false;panel.hidden=true;editing=true;dirty=false;loading=false;$('cancel-schedule').hidden=true;notify('Nueva historia · El autoguardado empieza al escribir.');
    if(data.title||data.html)queueSave();
    $('post-title').focus();
  }
  function runAudit(){const findings=auditContent(snapshot());$('post-audit').innerHTML=findings.map(f=>`<li class="${f.level==='error'?'planner-error':''}">${f.level==='error'?'⚠':'○'} ${esc(f.message)}</li>`).join('')||'<li>✓ Ficha lista para revisión final.</li>';return findings;}
  async function publishNow(){
    const errors=runAudit().filter(x=>x.level==='error');if(errors.length)throw Error('Completa los campos señalados antes de publicar.');
    if(!confirm(`¿Publicar ahora “${bridge.read().title}”?`))return;
    const p=active?.status==='error'&&!dirty?active:await save();if(!p)throw Error('Espera a que termine el guardado.');
    busy=true;$('btn-publish').disabled=true;
    try{const result=await api('publish',{id:p.id,version:p.version});setCurrent(result);notify('Artículo enviado. Vercel está actualizando la web.');}
    finally{busy=false;$('btn-publish').disabled=false;}
  }
  async function mediaUrl(id){if(urls.has(id))return urls.get(id);const m=await api('mediaGet',{id});const bytes=Uint8Array.from(atob(m.base64),c=>c.charCodeAt(0));const url=URL.createObjectURL(new Blob([bytes],{type:m.mime}));urls.set(id,url);return url;}
  async function uploadFile(file,progress=()=>{}){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type))throw Error('Selecciona una foto JPG, PNG o WebP.');
    progress(10);
    const compressed=await imageCompression(file,{maxSizeMB:.42,maxWidthOrHeight:2200,useWebWorker:true,libURL:'/vendor/browser-image-compression/2.0.2/browser-image-compression.js'});progress(50);
    const base64=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=reject;r.readAsDataURL(compressed);});
    const m=await api('mediaSave',{media:{name:file.name,base64,destination:bridge.read().tags[0]||''}});mediaMetadata.set(m.id,m);const url=await mediaUrl(m.id);progress(100);return {...m,url};
  }
  async function updateHeroPreview(){const hero=bridge.read().hero;if(hero.startsWith('media:'))bridge.heroPreview(await mediaUrl(hero.slice(6)));else bridge.heroPreview(hero);}
  async function uploadHero(input){if(!input.files[0])return;const m=await uploadFile(input.files[0],n=>notify(`Subiendo portada… ${n}%`));$('post-hero').value=`media:${m.id}`;await updateHeroPreview();queueSave();notify('Portada añadida a la biblioteca privada.');input.value='';}
  async function insertMedia(id){const m=media.find(m=>m.id===id)||mediaMetadata.get(id)||{};const url=await mediaUrl(id);bridge.insert(`<figure><img src="${esc(url)}" data-media-id="${id}" alt="${esc(m.alt||'')}">${m.credit?`<figcaption>${esc(m.credit)}</figcaption>`:''}</figure><p></p>`);queueSave();}
  async function renderMedia(inDialog=false){
    media=await api('mediaList');
    const markup=`<div class="planner-heading"><div><h1>Biblioteca de fotografías</h1><p class="planner-subtitle">Fotos privadas y comprimidas · JPG, PNG o WebP. Añade descripción y crédito.</p></div><label class="planner-button primary">Subir fotografías<input id="library-upload" type="file" accept="image/jpeg,image/png,image/webp" multiple hidden></label></div><input id="media-search" class="input-modern" placeholder="Buscar por nombre o destino" aria-label="Buscar fotografías"><span id="media-progress" class="photo-progress" role="status"></span><div class="planner-cards" id="media-cards"></div>`;
    const root=inDialog?dialog:panel;
    root.innerHTML=inDialog?markup+'<footer><button class="planner-button" data-close-dialog>Cerrar</button></footer>':`<div class="planner-wrap">${markup}</div>`;
    if(inDialog&&!dialog.open)dialog.showModal();
    async function draw(){const q=$('media-search').value.toLowerCase();const list=media.filter(m=>`${m.name} ${m.destination}`.toLowerCase().includes(q));$('media-cards').innerHTML=list.map(m=>`<article class="planner-card"><img data-thumb="${m.id}" alt="${esc(m.alt||m.name)}"><p>${esc(m.name)}<br>${esc(m.destination||'Sin destino')}</p><button class="planner-button" data-meta="${m.id}">Descripción y crédito</button>${editing?`<button class="planner-button" data-photo="${m.id}">Insertar</button><button class="planner-button" data-cover="${m.id}">Usar de portada</button>`:''}</article>`).join('')||'<p class="planner-empty">Todavía no hay fotografías.</p>';for(const m of list){try{const url=await mediaUrl(m.id);const img=root.querySelector(`[data-thumb="${m.id}"]`);if(img)img.src=url;}catch(e){$('media-progress').textContent=e.message;}}}
    $('media-search').oninput=protect(draw);await draw();
    $('library-upload').onchange=protect(async event=>{const files=[...event.target.files];let count=0;for(const f of files){$('media-progress').textContent=`${count+1}/${files.length} · ${f.name}`;await uploadFile(f);count++;}await renderMedia(inDialog);$('media-progress').textContent=`${count} fotografías guardadas.`;});
  }
  function openForm(title,fields,submit){
    dialog.innerHTML=`<h2>${esc(title)}</h2><form class="planner-form">${fields}<footer><button type="button" class="planner-button" data-close-dialog>Cancelar</button><button type="submit" class="planner-button primary">Guardar</button></footer><p id="dialog-error" role="alert"></p></form>`;
    if(!dialog.open)dialog.showModal();
    dialog.querySelector('form').onsubmit=async e=>{e.preventDefault();const btn=e.submitter;btn.disabled=true;try{await submit(new FormData(e.target));dialog.close();}catch(error){$('dialog-error').textContent=error.message;}finally{btn.disabled=false;}};
  }
  function itemForm(kind,item={}){
    const title={ideas:'Idea para un artículo',trips:'Cuaderno de viaje',questions:'Pregunta de un viajero'}[kind];
    const fields=`<label>Título<input name="title" class="input-modern" value="${esc(item.title||'')}" required maxlength="200"></label><label>Destino<input name="destination" class="input-modern" value="${esc(item.destination||'')}"></label>${kind==='trips'?`<div class="planner-grid-two"><label>Fecha del viaje<input name="date" type="date" class="input-modern" value="${esc(item.date||'')}"></label><label>Presupuesto y moneda<input name="budget" class="input-modern" value="${esc(item.budget||'')}" placeholder="Ej. 300 EUR · 3 días"></label></div>`:''}<label>${kind==='questions'?'Contexto y respuesta pendiente':'Notas, experiencias y datos por verificar'}<textarea name="notes" class="input-modern">${esc(item.notes||'')}</textarea></label><label>Enlaces de referencia<textarea name="links" class="input-modern" placeholder="Un enlace por línea">${esc(item.links||'')}</textarea></label>`;
    openForm(title,fields,async f=>{await api('saveItem',{kind,item:{...item,...Object.fromEntries(f)}});await renderItems(kind);});
  }
  async function renderItems(kind){
    items=await api('items',{kind});const title={ideas:'Bandeja de ideas',trips:'Mi viaje',questions:'Preguntas de viajeros'}[kind];
    panel.innerHTML=`<div class="planner-wrap"><div class="planner-heading"><div><h1>${title}</h1><p class="planner-subtitle">Captura hoy lo que después se convertirá en una historia.</p></div><button class="planner-button primary" data-add-item="${kind}">+ Añadir</button></div><div class="planner-cards">${items.map(i=>`<article class="planner-card"><span class="eyebrow">${esc(i.destination)}</span><h2>${esc(i.title)}</h2><p>${esc(i.notes.slice(0,400))}</p><button class="planner-button" data-edit-item="${i.id}">Editar</button><button class="planner-button" data-convert="${i.id}">${kind==='trips'?'Preparar artículo':'Convertir en borrador'}</button><button class="text-action" data-archive="${i.id}">Archivar</button></article>`).join('')||'<p class="planner-empty">Guarda aquí tu primera nota.</p>'}</div></div>`;
  }
  async function renderStats(){const s=await api('stats');panel.innerHTML=`<div class="planner-wrap"><h1>Resultados del blog</h1><p class="planner-subtitle">Últimos ${s.days} días · Eventos registrados por el sitio. No representan visitantes únicos.${s.sampled?' Muestra limitada a 1.500 eventos.':''}</p><div class="planner-cards"><article class="planner-card"><h2>${s.views}</h2><p>Visitas registradas</p></article><article class="planner-card"><h2>${s.clicks}</h2><p>Clics registrados</p></article></div><h2>Artículos más consultados</h2>${s.pages.length?s.pages.map(p=>`<p><a href="${esc(p.path.startsWith('/')?p.path:'/')}" target="_blank" rel="noopener">${esc(p.path)}</a> · ${p.views}</p>`).join(''):'<p class="planner-empty">Todavía no hay visitas registradas en este período.</p>'}</div>`;}
  function chooseTemplate(){dialog.innerHTML=`<h2>Empezar con una plantilla</h2><p>Se añadirá al final del relato para conservar lo que ya escribiste.</p><div class="planner-cards">${Object.entries(templates).map(([k,t])=>`<button class="planner-button" data-template="${k}">${t.name}</button>`).join('')}</div><footer><button class="planner-button" data-close-dialog>Cerrar</button></footer>`;dialog.showModal();}
  function chooseBlock(){dialog.innerHTML=`<h2>Añadir un bloque</h2><div class="planner-cards">${Object.entries(blocks).map(([k,t])=>`<button class="planner-button" data-block="${k}">${t.name}</button>`).join('')}</div><footer><button class="planner-button" data-close-dialog>Cerrar</button></footer>`;dialog.showModal();}
  function assistant(){
    const p=snapshot(),words=p.html.replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
    dialog.innerHTML=`<h2>Asistente editorial</h2><p class="planner-subtitle">Herramientas basadas en tu contenido. Las sugerencias no verifican precios, horarios ni experiencias.</p><div class="assistant-output">${esc(`Tu artículo tiene ${words} palabras (${Math.max(1,Math.ceil(words/220))} min de lectura).\n\nPosibles enfoques para “${p.tags[0]||'este destino'}”:\n• Qué debes saber antes de viajar\n• Mi presupuesto y los gastos que no esperaba\n• Lo que haría diferente en mi próxima visita\n\nAntes de publicarlo:\n${auditContent(p).map(f=>'• '+f.message).join('\n')||'• Haz una última lectura y verifica tus fuentes.'}`)}</div><p class="planner-subtitle">La generación con IA requiere conectar un proveedor; esta versión organiza y revisa tu material sin generar datos nuevos.</p><footer><button class="planner-button" data-close-dialog>Cerrar</button></footer>`;dialog.showModal();
  }
  async function handle(e){
    const b=e.target.closest('button,[data-close-dialog]');if(!b)return;
    if(b.dataset.view)return showView(b.dataset.view);
    if(b.hasAttribute('data-close-dialog'))return dialog.close();
    if(b.hasAttribute('data-recover')){
      const p=recovered;await newPost(p.date,{...p,html:await hydrate(p.html)});
      if(p.id){const latest=await api('get',{id:p.id});if(latest.version===p.version)active=latest;else bridge.toast('Se recuperó como historia nueva para conservar la versión más reciente.');}
      $('hero-alt').value=p.heroAlt||'';$('review-date').value=p.reviewAt||'';await updateHeroPreview();queueSave();return;
    }
    if(b.hasAttribute('data-new'))return newPost();
    if(b.dataset.date)return newPost(b.dataset.date);
    if(b.dataset.open)return openPost(b.dataset.open);
    if(b.dataset.month){month=new Date(month.getFullYear(),month.getMonth()+Number(b.dataset.month),1,12);return refresh();}
    if(b.hasAttribute('data-today')){month=new Date();return refresh();}
    if(b.hasAttribute('data-retry'))return showView(view);
    if(b.hasAttribute('data-import')){b.disabled=true;try{const r=await api('import');bridge.toast(`${r.count} artículos incorporados al calendario.`);await refresh();}finally{b.disabled=false;}return;}
    if(b.dataset.verify){const p=await api('verify',{id:b.dataset.verify});setCurrent(p);return refresh();}
    if(b.dataset.addItem)return itemForm(b.dataset.addItem);
    if(b.dataset.editItem)return itemForm(view,items.find(i=>i.id===b.dataset.editItem));
    if(b.dataset.archive){await api('saveItem',{kind:view,item:{...items.find(i=>i.id===b.dataset.archive),archived:true}});return renderItems(view);}
    if(b.dataset.convert){const item=items.find(i=>i.id===b.dataset.convert);if(view==='trips'){
      dialog.innerHTML=`<h2>Crear a partir del viaje</h2><p>Las notas se conservarán como material de trabajo.</p>${['guia','itinerario','presupuesto','transporte','experiencia'].map(k=>`<button class="planner-button" data-trip="${item.id}" data-focus="${k}">${templates[k].name}</button>`).join('')}<footer><button class="planner-button" data-close-dialog>Cerrar</button></footer>`;dialog.showModal();return;
    }return newPost(undefined,{title:item.title,html:`<h2>Notas para desarrollar</h2><p>${esc(item.notes).replace(/\n/g,'<br>')}</p>`,tags:item.destination?[item.destination]:[]});}
    if(b.dataset.trip){const item=items.find(i=>i.id===b.dataset.trip);dialog.close();await newPost(undefined,buildTripDraft(item,b.dataset.focus));active={tripId:item.id};return;}
    if(b.dataset.template){bridge.insert(templates[b.dataset.template].html);dialog.close();queueSave();return;}
    if(b.dataset.block){const block=blocks[b.dataset.block];dialog.close();if(block.fields){openForm(block.name,block.fields,async f=>{bridge.insert(block.build(Object.fromEntries(f)));queueSave();});}else{bridge.insert(block.html);queueSave();}return;}
    if(b.dataset.photo){await insertMedia(b.dataset.photo);dialog.close();return;}
    if(b.dataset.cover){$('post-hero').value=`media:${b.dataset.cover}`;$('hero-alt').value=media.find(m=>m.id===b.dataset.cover)?.alt||'';await updateHeroPreview();queueSave();dialog.close();return;}
    if(b.dataset.meta){const m=media.find(m=>m.id===b.dataset.meta);openForm('Datos de la fotografía',`<label>Descripción de la imagen<input class="input-modern" name="alt" value="${esc(m.alt)}"></label><label>Crédito<input class="input-modern" name="credit" value="${esc(m.credit)}"></label><label>Destino<input class="input-modern" name="destination" value="${esc(m.destination)}"></label>`,async f=>{await api('mediaUpdate',{id:m.id,...Object.fromEntries(f)});await renderMedia(editing);});}
  }
  nav.addEventListener('click',protect(handle));panel.addEventListener('click',protect(handle));dialog.addEventListener('click',protect(handle));
  workspace.addEventListener('input',queueSave);workspace.addEventListener('change',queueSave);
  bridge.onChange(queueSave);
  $('save-draft').onclick=protect(()=>save());$('schedule-post').onclick=protect(()=>save('scheduled'));$('cancel-schedule').onclick=protect(async()=>{if(confirm('¿Cancelar la programación y conservarlo como borrador?'))await save();});
  $('check-links').onclick=protect(async()=>{
    const links=[...new DOMParser().parseFromString(snapshot().html,'text/html').querySelectorAll('a[href]')].map(a=>a.getAttribute('href')).filter(h=>/^https:\/\/|^\/[^/]/.test(h));
    if(!links.length){notify('No hay enlaces https para comprobar.');return;}
    notify('Comprobando enlaces…');
    const results=await api('checkLinks',{links});
    $('post-audit').innerHTML=results.map(r=>`<li class="${r.status==='broken'?'planner-error':''}">${r.status==='ok'?'✓':'⚠'} ${esc(r.message)} · <a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${esc(r.url)}</a></li>`).join('');notify('Revisión terminada · máximo 10 enlaces por revisión.');
  });
  $('audit-post').onclick=runAudit;$('insert-template').onclick=chooseTemplate;$('insert-block').onclick=chooseBlock;$('open-library').onclick=protect(()=>renderMedia(true));$('editor-assistant').onclick=assistant;
  $('schedule-zone').onchange=()=>{zone=$('schedule-zone').value;};
  window.publishCurrentPost=protect(publishNow);window.uploadHeroImage=protect(uploadHero);window.openLoadModal=protect(()=>showView('articles'));window.clearAll=protect(()=>newPost());
  window.plannerUpload=async(file,progress)=>{const m=await uploadFile(file,progress);return {url:m.url,id:m.id};};
  const beforeUnload=e=>{if(dirty){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',beforeUnload);
  const timer=setInterval(()=>{if(editing&&active?.status==='deploying'&&!busy)protect(async()=>{const p=await api('verify',{id:active.id});setCurrent(p);notify(labels[p.status]+(p.error?` · ${p.error}`:''));})();},30000);
  const unsubscribe=auth.onAuthStateChanged(user=>{if(!user){disposed=true;clearTimeout(saveTimer);clearInterval(timer);window.removeEventListener('beforeunload',beforeUnload);urls.forEach(url=>URL.revokeObjectURL(url));nav.remove();panel.remove();dialog.remove();unsubscribe();}});
  recovered=await recovery('get');
  await showView('calendar');
}
