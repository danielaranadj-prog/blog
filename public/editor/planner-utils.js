export const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function dayKey(ms,zone='America/Mazatlan') {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(ms));
  const get=k=>parts.find(p=>p.type===k).value;return `${get('year')}-${get('month')}-${get('day')}`;
}
export function localToUtc(value,zone) {
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))return null;
  const [y,m,d,h,min]=value.match(/\d+/g).map(Number), target=Date.UTC(y,m-1,d,h,min);
  let guess=target;
  const formatter=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
  for(let n=0;n<4;n++){
    const p=formatter.formatToParts(new Date(guess));const get=k=>Number(p.find(x=>x.type===k).value);
    const actual=Date.UTC(get('year'),get('month')-1,get('day'),get('hour'),get('minute'));
    const correction=target-actual;if(!correction)return guess;guess+=correction;
  }
  return null;
}
export function auditContent(p){
  const findings=[];const add=(level,message,field)=>findings.push({level,message,field});
  if(!(p.title||'').trim())add('error','Escribe el título del artículo.','post-title');
  if(!(p.description||'').trim())add('error','Añade la descripción del artículo.','post-desc');
  if(!p.hero)add('error','Selecciona una foto de portada.','post-hero');
  if(!p.author)add('error','Selecciona un autor.','post-author');
  if(!(p.html||'').replace(/<[^>]+>/g,'').trim())add('error','Escribe el relato.');
  if(p.urlSlug&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.urlSlug))add('error','La dirección admite minúsculas sin acentos, números y guiones.','seo-slug');
  if(p.modifiedDate&&p.date&&p.modifiedDate<p.date)add('error','La actualización no puede ser anterior a la publicación.','editorial-modified');
  const searchTitle=p.seoTitle||p.title||'';
  if(searchTitle.length>65)add('warning','El título para buscadores es largo; revisa si expresa claramente el tema. No hay un límite fijo de Google.','seo-title');
  if(p.description&&(p.description.length<50||p.description.length>160))add('warning','Revisa el resumen: entre 50 y 160 caracteres es una orientación, no un requisito.','post-desc');
  if(!p.heroAlt?.trim())add('warning','Describe la foto de portada para mejorar la accesibilidad.','hero-alt');
  if(!p.tags?.length&&!p.destination)add('warning','Añade un lugar o tema para conectar esta historia con otras.','editorial-destination');
  if(!p.editorialType)add('warning','Elige el tipo de artículo si quieres identificar su enfoque.','editorial-type');
  if(!p.focusQuestion)add('warning','Puedes anotar qué pregunta responde tu historia; esta nota es privada.','editorial-question');
  if(/\[(?:Completar|Verificar|Añadir|Tu |Pendiente)[^\]]*\]/i.test(p.html||''))add('error','Quedan campos de la plantilla por completar.');
  if(typeof DOMParser!=='undefined'){
    const d=new DOMParser().parseFromString(p.html||'','text/html');
    const missing=[...d.images].filter(i=>!i.getAttribute('alt')?.trim()).length;
    if(missing)add('warning',`${missing} fotografías del relato necesitan una descripción.`);
    if(d.querySelector('h1'))add('warning','El titular ya es el encabezado principal. Usa subtítulos H2 y H3 en el relato.');
    if(!d.querySelector('h2'))add('warning','Considera añadir subtítulos para facilitar la lectura.');
    let previous=1;for(const h of d.querySelectorAll('h2,h3,h4,h5,h6')){const level=Number(h.tagName[1]);if(level>previous+1){add('warning','Revisa la jerarquía de subtítulos: hay niveles saltados.');break;}previous=level;}
    let internal=false;
    for(const a of d.querySelectorAll('a[href]')){
      const href=a.getAttribute('href');if(!/^(https?:\/\/|\/[^/]|#|mailto:|tel:)/i.test(href))add('error',`Enlace inválido: ${href.slice(0,80)}`);
      if(/^\/posts\/|^https:\/\/www\.instantetrips\.com\/posts\//.test(href))internal=true;
    }
    if(!internal)add('warning','Si aporta valor, enlaza otra historia desde “Enlazar artículo”.');
  }
  if(!p.reviewAt)add('warning','Programa una revisión si incluyes precios, horarios o requisitos.','review-date');
  return findings;
}
const sections=titles=>titles.map(t=>`<h2>${t}</h2><p>[Completar con tu experiencia y fuentes verificadas]</p>`).join('');
export const templates={
  guia:{name:'Guía de destino',html:sections(['Lo que debes saber antes de ir','Cómo llegar y moverse','Dónde alojarse','Qué ver y hacer','Mi presupuesto real','Errores que evitaría','Fuentes y fecha de revisión'])},
  itinerario:{name:'Itinerario por días',html:sections(['Antes de empezar','Día 1: llegada y primeras paradas','Día 2: recorrido principal','Día 3: lo que no me perdería','Mapa y desplazamientos','Gastos y reservas'])},
  presupuesto:{name:'Presupuesto real',html:sections(['Fechas, moneda y duración del viaje','Transporte','Alojamiento','Comidas','Actividades y gastos inesperados','Total y cómo ahorrar'])},
  transporte:{name:'Comparativa de transporte',html:sections(['Origen, destino y fecha de consulta','Opción 1: precio y duración','Opción 2: precio y duración','Equipaje y condiciones','Mi elección y por qué','Enlaces y datos por verificar'])},
  experiencia:{name:'Experiencia y errores',html:sections(['Lo que esperaba','Lo que realmente pasó','Cuánto costó','Qué haría diferente','Para quién lo recomiendo'])}
};
const input=(name,label,placeholder='',type='text')=>`<label>${label}<input class="input-modern" name="${name}" type="${type}" placeholder="${placeholder}" required></label>`;
export const blocks={
  consejo:{name:'Consejo de viaje',html:'<blockquote><p><strong>Mi consejo:</strong> [Completar con tu recomendación]</p></blockquote><p></p>'},
  advertencia:{name:'Error que evitar',html:'<blockquote><p><strong>Atención:</strong> [Completar con el error y cómo evitarlo]</p></blockquote><p></p>'},
  resumen:{name:'Resumen del viaje',html:'<h2>El resumen al grano</h2><ul><li>Presupuesto: [Completar]</li><li>Mejor época: [Verificar]</li><li>Error que evitar: [Completar]</li></ul><p></p>'},
  gastos:{name:'Tabla de gastos',html:'<table><thead><tr><th>Concepto</th><th>Importe y moneda</th><th>Notas</th></tr></thead><tbody><tr><td>Transporte</td><td>[Completar]</td><td>[Completar]</td></tr><tr><td>Alojamiento</td><td>[Completar]</td><td>[Completar]</td></tr><tr><td>Comidas</td><td>[Completar]</td><td>[Completar]</td></tr><tr><td>Total</td><td>[Completar]</td><td>[Completar]</td></tr></tbody></table><p></p>'},
  boton:{name:'Botón con enlace',fields:input('text','Texto del enlace')+input('url','Dirección','https://','url'),build:d=>{if(!/^https:\/\//i.test(d.url))throw Error('Usa un enlace https.');return `<p><a class="editor-link-button" href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(d.text)} →</a></p>`;}},
  mapa:{name:'Enlace al mapa',fields:input('place','Lugar')+input('url','Enlace de Google Maps','https://maps.google.com/...','url'),build:d=>{const u=new URL(d.url);if(u.protocol!=='https:'||!['maps.google.com','www.google.com','maps.app.goo.gl','goo.gl'].includes(u.hostname))throw Error('Usa un enlace de Google Maps.');return `<p><a href="${escapeHtml(d.url)}" target="_blank" rel="noopener noreferrer">Ver ${escapeHtml(d.place)} en el mapa ↗</a></p>`;}},
  galeria:{name:'Galería de fotografías',html:'<h2>El viaje en imágenes</h2><p>Añade aquí tus fotos desde la biblioteca.</p>'}
};
export function buildTripDraft(trip,focus){
  const t=templates[focus]||templates.guia;
  return {title:`${t.name}: ${trip.destination||trip.title}`,description:'',tags:trip.destination?[trip.destination]:[],html:`<h2>Material de mi viaje</h2><p>${escapeHtml(trip.notes||'').replace(/\n/g,'<br>')}</p>${trip.budget?`<p>Presupuesto anotado: ${escapeHtml(trip.budget)}</p>`:''}<h2>Referencias por comprobar</h2><p>${escapeHtml(trip.links||'')}</p>${t.html}`};
}
