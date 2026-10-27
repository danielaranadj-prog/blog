let tinyPromise;
function loadTiny(){
  if(window.tinymce)return Promise.resolve();
  if(tinyPromise)return tinyPromise;
  tinyPromise=new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://cdn.tiny.cloud/1/mzaiavt8ne1jnylgt9u8ns2j7xbaofg5gexdmktmbfa09jh3/tinymce/6/tinymce.min.js';script.referrerPolicy='origin';
    const timeout=setTimeout(()=>{tinyPromise=null;reject(Error('El editor está tardando en cargar. Vuelve a intentarlo.'));},20000);
    script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);tinyPromise=null;reject(Error('No se pudo cargar el editor de texto.'));};document.head.append(script);
  });return tinyPromise;
}
export function mountPages({container,api,esc,askConfirm,active}){
  let alive=true,busy=false,data=null,editor=null,dirty=false,poll=null,previewOpen=false;
  const footerButtons=[...document.querySelectorAll('.savebar button')];
  const safe=fn=>async(...args)=>{try{return await fn(...args);}catch(error){if(alive){message(error.message,true);}}};
  const find=id=>container.querySelector('#'+id);
  function message(text,error=false){if(!alive)return;const status=document.getElementById('save-state');status.textContent=text;status.classList.toggle('error',error);}
  function lock(value){busy=value;if(!alive)return;footerButtons.forEach(b=>b.disabled=value||(!data&&b.id!=='reload-settings'));container.querySelectorAll('input,textarea,button').forEach(el=>el.disabled=value);if(editor)editor.mode.set(value?'readonly':'design');}
  function changed(){if(!alive)return;dirty=true;message('Página con cambios pendientes de guardar.');if(previewOpen){find('page-preview').hidden=true;previewOpen=false;}}
  function collect(){
    const page={...data.page};for(const key of ['title','description','eyebrow','summary'])page[key]=container.querySelector(`[data-page-field="${key}"]`).value;
    page.html=editor?editor.getContent():find('page-body').value;
    if(data.contactEmail)page.html=page.html.replaceAll(data.contactEmail,'{{contactEmail}}');
    return page;
  }
  const displayHtml=page=>page.html.replaceAll('{{contactEmail}}',esc(data.contactEmail));
  function removeEditor(){if(editor){editor.remove();editor=null;}}
  async function showList(){
    if(busy)return;if(dirty&&!await askConfirm('¿Salir sin guardar los cambios de esta página?'))return;
    clearInterval(poll);removeEditor();data=null;dirty=false;lock(true);
    container.innerHTML='<span class="eyebrow">Instante · Páginas informativas</span><h1>Tu proyecto, con tus palabras.</h1><p class="intro">Edita la información del sitio sin tocar código. Cada página guarda y publica sus propios cambios.</p><div id="page-list" class="cards"><p>Cargando páginas…</p></div>';
    try{const result=await api('pageList');if(!alive)return;
      find('page-list').innerHTML=result.map(p=>`<section class="card"><h2>${esc(p.label)}</h2><p>${esc(p.url)}</p><p class="status-pill">${p.release?.status==='deploying'?'Actualizando la web':p.hasDraft?'Borrador guardado':p.release?.status==='published'?'Publicado':'Contenido actual'}</p><div class="page-card-actions"><button class="primary" data-open-page="${p.key}">Editar página →</button><a href="${esc(p.url)}" target="_blank" rel="noopener">Ver página ↗</a></div></section>`).join('');message('Elige una página para editar.');
    }finally{lock(false);}
  }
  async function open(key){
    if(busy)return;if(dirty&&!await askConfirm('¿Salir sin guardar los cambios de esta página?'))return;
    lock(true);clearInterval(poll);removeEditor();
    try{const result=await api('pageLoad',{key});if(!alive)return;data=result;dirty=false;
      container.innerHTML=`<span class="eyebrow">Instante · Páginas informativas</span><div class="section-heading"><h1>${esc(result.label)}</h1><div class="page-card-actions"><button id="back-pages">← Todas las páginas</button><a class="button" href="${esc(result.url)}" target="_blank" rel="noopener">Ver página pública ↗</a></div></div><p class="intro">Guarda el borrador para conservar tu trabajo. Publica cuando esté listo para aparecer en el sitio.</p><section class="card form-card"><h2>Presentación de la página</h2><div class="fields">${[['title','Título de la página'],['eyebrow','Etiqueta sobre el título'],['description','Descripción para buscadores'],['summary','Introducción visible']].map(([key,label])=>`<label>${label}${['description','summary'].includes(key)?`<textarea data-page-field="${key}" maxlength="${key==='summary'?600:320}">${esc(result.page[key])}</textarea>`:`<input data-page-field="${key}" maxlength="${key==='title'?180:100}" value="${esc(result.page[key])}">`}</label>`).join('')}</div></section><section class="card form-card"><h2>Contenido</h2><p>Escribe, pega texto y añade títulos, listas o enlaces.</p><textarea id="page-body" aria-label="Contenido de la página">${esc(displayHtml(result.page))}</textarea><div class="page-card-actions" style="margin-top:1rem"><button id="preview-page">Revisar vista previa</button><button id="discard-page">Recuperar versión publicada</button></div><p class="hint">El correo que coincide con el contacto del sitio seguirá conectado a los ajustes generales.${key==='about'?' La foto y el perfil se administran desde Autores.':''}</p></section><section id="page-preview" class="card" hidden><div class="section-heading"><h2>Vista previa del contenido</h2><button id="toggle-page-preview">Vista móvil</button></div><iframe title="Vista previa de la página" sandbox="" id="page-preview-frame"></iframe></section>`;
      await loadTiny();if(!alive)return;
      const editors=await window.tinymce.init({selector:'#page-body',language:'es',language_url:'/vendor/tinymce-i18n/26.9.28/es.js',height:520,menubar:false,branding:false,plugins:'link lists',toolbar:'undo redo | blocks | bold italic underline | bullist numlist | blockquote link | removeformat',block_formats:'Párrafo=p;Título de sección=h2;Subtítulo=h3',convert_urls:false,relative_urls:false,remove_script_host:false,skin:document.body.classList.contains('dark')?'oxide-dark':'oxide',content_style:"body{font-family:Arial,sans-serif;font-size:16px;line-height:1.9;background:#FDFBF7;color:#18181B;padding:12px}h2,h3{font-family:Georgia,serif}a{color:#C23E0B}",setup:instance=>{instance.on('input change undo redo',changed);}});
      if(!alive){editors.forEach(e=>e.remove());return;}if(!editors?.length)throw Error('No se pudo iniciar el editor. Usa Recargar para volver a intentarlo.');editor=editors[0];
      message(result.hasDraft?'Borrador de la página recuperado.':'Página cargada. Lista para editar.');
    }finally{lock(false);}
    if(data?.release?.status==='deploying')startPolling();
  }
  async function save(){
    if(busy||!data)return;lock(true);message('Guardando borrador de la página…');
    try{const result=await api('pageSave',{key:data.key,page:collect(),version:data.version,baseSha:data.baseSha});if(!alive)return;data=result;dirty=false;message('Borrador de la página guardado en línea.');return result;}finally{lock(false);}
  }
  async function preview(){
    if(busy||!data)return;lock(true);
    try{const page=await api('pagePreview',{page:collect()});if(!alive)return;
      const frame=find('page-preview-frame');frame.srcdoc=`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#FAF7F2;color:#18181B;font:15px/1.9 Arial,sans-serif;overflow-wrap:anywhere}h1,h2,h3{font-family:Georgia,serif;line-height:1.2}h1{font-size:36px}article{padding:24px;border:1.5px solid #18181B;border-radius:14px;background:#FDFBF7}a{color:#C23E0B}.eyebrow{color:#C23E0B;font-size:10px;font-weight:bold;letter-spacing:2px}.summary{color:#736D64}.stage-item{border-left:3px solid #E04F16;background:#F3EFE6;padding:16px;margin:12px 0}.stage-title{display:block;font-weight:bold}</style></head><body><span class="eyebrow">${esc(page.eyebrow)}</span><h1>${esc(page.title)}</h1><p class="summary">${esc(page.summary)}</p><article>${displayHtml(page)}</article></body></html>`;
      find('page-preview').hidden=false;previewOpen=true;find('page-preview').scrollIntoView({behavior:'smooth',block:'start'});message('Vista previa lista. Todavía no se ha publicado.');
    }finally{lock(false);}
  }
  async function publish(){
    if(busy||!data)return;
    await preview();if(!alive)return;
    if(!await askConfirm(`¿Publicar los cambios de «${collect().title}» en ${data.url}? La web se actualizará al terminar Vercel.`))return;
    const saved=await save();if(!saved)return;lock(true);message('Enviando la página al sitio…');
    try{const release=await api('pagePublish',{key:data.key,version:data.version});if(!alive)return;data.release=release;dirty=false;message('Página enviada. Esperando que la nueva versión aparezca en la web.');startPolling();}catch(error){lock(false);throw error;}
  }
  function startPolling(){
    clearInterval(poll);lock(true);let attempts=0,running=false;const key=data.key;
    poll=setInterval(async()=>{if(!alive||running)return;running=true;
      try{const release=await api('pageStatus',{key});if(!alive)return;if(release?.status==='published'){const latest=await api('pageLoad',{key});if(!alive)return;clearInterval(poll);data=latest;lock(false);message('Publicado. La nueva versión de esta página ya está visible en el sitio.');}else if(++attempts>=35){clearInterval(poll);lock(false);message('La actualización sigue pendiente. Usa Recargar para volver a comprobarla.');}}
      catch(error){if(++attempts>=35){clearInterval(poll);lock(false);message(error.message,true);}}
      finally{running=false;}
    },6000);
  }
  async function reload(){if(busy)return;if(!data)return showList();if(dirty&&!await askConfirm('¿Recargar esta página y descartar los cambios sin guardar?'))return;dirty=false;return open(data.key);}
  async function discard(){if(busy||!data)return;if(!await askConfirm('¿Reemplazar el borrador por la última versión publicada en GitHub?'))return;lock(true);try{await api('pageReset',{key:data.key,version:data.version});dirty=false;}finally{lock(false);}return open(data.key);}
  const onInput=event=>{if(event.target.matches('[data-page-field],#page-body'))changed();};
  const onClick=safe(async event=>{const button=event.target.closest('button');if(!button)return;if(button.dataset.openPage)return open(button.dataset.openPage);if(button.id==='back-pages')return showList();if(button.id==='preview-page')return preview();if(button.id==='discard-page')return discard();if(button.id==='toggle-page-preview'){const frame=find('page-preview-frame');frame.classList.toggle('mobile-preview');button.textContent=frame.classList.contains('mobile-preview')?'Vista escritorio':'Vista móvil';}});
  container.addEventListener('input',onInput);container.addEventListener('click',onClick);safe(showList)();
  return {save:safe(save),publish:safe(publish),reload:safe(reload),hasChanges:()=>dirty,canLeave:async()=>!busy&&(!dirty||await askConfirm('¿Salir sin guardar los cambios de esta página?')),destroy(){alive=false;footerButtons.forEach(button=>button.disabled=false);clearInterval(poll);removeEditor();container.removeEventListener('input',onInput);container.removeEventListener('click',onClick);}};
}
