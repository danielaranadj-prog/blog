import {getShortUrl} from './short-links.mjs';
import { escapeHtml as esc } from './planner-utils.js';
export const articleTypes={experiencia:'Experiencia',opinion:'Opinión',guia:'Guía práctica',comparativa:'Comparativa',seleccion:'Listas y recomendaciones',entrevista:'Entrevista'};
export const budgetLevels={gratis:'Gratis',economico:'Económico',intermedio:'Intermedio',premium:'Premium',mixto:'Mixto'};
export const editorialStructures={
 experiencia:['Antes del viaje','Lo que viví','Gastos y condiciones reales','Lo que haría diferente','A quién se lo recomendaría'],
 opinion:['Mi postura y el contexto','Los hechos que sustentan mi opinión','Mi experiencia y sus límites','Cuándo podría ser diferente para ti','Alternativas para otros presupuestos'],
 guia:['Respuesta rápida','Antes de ir','Cómo hacerlo paso a paso','Gastos, horarios y condiciones','Consejos y alternativas','Fuentes y fecha de consulta'],
 comparativa:['Qué opciones comparo y para quién','Criterios y fecha de comparación','Precios y condiciones','Ventajas y limitaciones','Cuál elegiría en cada caso'],
 seleccion:['Cómo elegí estas opciones','Las opciones y para quién encajan','Precios y datos por comprobar','Cómo organizar la visita','Fuentes y experiencia personal'],
 entrevista:['Quién es la persona entrevistada','Contexto y fecha de la conversación','Preguntas y respuestas','Lo que aprendí','Referencias y agradecimientos']
};
const STOPWORDS=new Set(['el','la','los','las','un','una','unos','unas','de','del','al','a','en','con','sin','por','para','como','que','cual','cuales','mi','mis','tu','tus','su','sus','este','esta','esto','estos','estas','ese','esa','muy','mas','pero','si','no','ya','casi','me','te','se','lo','le','les','nos','fue','son','es','era','o','u','y','e','ni','sobre','entre','hasta','desde','hacia','donde','cuando','quien','porque','todo','toda','todos','todas','otro','otra','otros','otras','mismo','misma','tan','tanto','tanta','algo','nada','poco','mucho','mucha','hacer','hice','hacerlo','ir','ver','usar']);
export function cleanSlug(value, maxWords=4, maxLen=36){
 const norm=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/^\d{4}-\d{2}-\d{2}-+/,'');
 const tokens=norm.match(/[a-z0-9]+/g)||[];
 if(!tokens.length)return '';
 const raw=tokens.join('-');
 if(tokens.length<=3&&raw.length<=28)return raw;
 const meaningful=tokens.filter(w=>!STOPWORDS.has(w)&&(w.length>1||/\d/.test(w)));
 const pool=meaningful.length>=2?meaningful:tokens;
 const out=[];let len=0;
 for(const w of pool){
  if(out.length>=maxWords)break;
  const next=len===0?w.length:len+1+w.length;
  if(next>maxLen&&out.length>=2)break;
  out.push(w);len=next;
 }
 return out.join('-').replace(/^-|-$/g,'');
}
export function getShortShareUrl(info={}){return getShortUrl(info);}
export function structureHtml(type){return (editorialStructures[type]||[]).map(title=>`<h2>${esc(title)}</h2><p>[Completar con tu experiencia o fuentes verificadas]</p>`).join('');}
const fields={editorialType:'editorial-type',destination:'editorial-destination',budgetLevel:'editorial-budget',focusQuestion:'editorial-question',seoTitle:'seo-title',urlSlug:'seo-slug',modifiedDate:'editorial-modified'};
export function mountEditorialTools(bridge){
 const root=document.createElement('section');root.className='editorial-tools';root.setAttribute('aria-label','Enfoque editorial y buscadores');
 const options=values=>Object.entries(values).map(([key,label])=>`<option value="${key}">${label}</option>`).join('');
 root.innerHTML=`
 <div class="shortlink-box">
  <div class="shortlink-heading">
   <label for="seo-slug" class="field-label">Dirección y enlace para compartir</label>
   <div class="shortlink-actions">
    <button type="button" id="btn-shorten-slug" class="planner-button">Acortar dirección</button>
    <button type="button" id="btn-copy-shortlink" class="planner-button primary">Copiar enlace corto</button>
   </div>
  </div>
  <input id="seo-slug" class="input-modern" maxlength="100" placeholder="Se genera corto automáticamente desde el título" pattern="[a-z0-9]+(-[a-z0-9]+)*">
  <p id="seo-slug-help" class="field-help" style="margin-top:.4rem;"></p>
  <p id="shortlink-live-badge" class="field-help" style="margin-top:.25rem;font-weight:700;color:#E04F16;"></p>
 </div>
 <div class="editorial-tools-heading"><span class="eyebrow">Dale dirección a tu historia</span><p>Clasifica el contenido y prepara cómo se presenta al lector.</p></div>
 <div class="planner-grid-two"><label for="editorial-type">Tipo de artículo<select id="editorial-type" class="input-modern"><option value="">Sin clasificar</option>${options(articleTypes)}</select></label><label for="editorial-budget">Enfoque de presupuesto · opcional<select id="editorial-budget" class="input-modern"><option value="">Sin especificar</option>${options(budgetLevels)}</select></label></div>
 <label for="editorial-destination">Lugar principal<input id="editorial-destination" class="input-modern" maxlength="120" placeholder="Ej. El Calafate, Argentina"></label>
 <p class="field-help">Los temas y destinos adicionales siguen en tus etiquetas.</p>
 <label for="editorial-question">¿Qué pregunta responde este artículo? · privada<textarea id="editorial-question" class="input-modern" rows="2" maxlength="500" placeholder="Ej. ¿Vale la pena visitar El Calafate con poco presupuesto?"></textarea></label>
 <button type="button" id="editorial-structure" class="planner-button">Añadir estructura del tipo elegido</button>
 <p class="field-help">Opcional. Se añade al final y conserva lo que ya escribiste.</p>
 <details class="publication-details" id="seo-details"><summary>Buscadores y vista previa</summary><div class="field-stack publication-fields"><label for="seo-title">Título para buscadores · opcional<input id="seo-title" class="input-modern" maxlength="180" placeholder="Se utiliza el titular si lo dejas vacío"></label><p class="field-help">La descripción se toma de “La historia, en dos líneas”. La longitud es orientativa, no un requisito de Google.</p><label for="editorial-modified">Última actualización significativa · opcional<input id="editorial-modified" type="date" class="input-modern"></label><p class="field-help">Solo cambia esta fecha cuando revises de forma sustancial el contenido. No es la fecha de autoguardado.</p><div class="seo-preview" aria-label="Vista aproximada en buscadores"><span id="seo-preview-url"></span><strong id="seo-preview-title"></strong><p id="seo-preview-description"></p></div><p class="field-help">Vista orientativa. Los buscadores pueden elegir otros títulos y fragmentos.</p><div class="seo-preview" aria-label="Vista aproximada al compartir"><span>Al compartir</span><strong id="social-preview-title"></strong><p id="social-preview-description"></p></div></div></details>`;
 document.getElementById('post-desc').parentElement.after(root);
 let filename='',manual=false;
 const $=id=>document.getElementById(id);
 function read(){return Object.fromEntries(Object.entries(fields).map(([key,id])=>[key,$(id).value.trim()]));}
 function refresh(){
  const p=bridge.read();
  if(!manual&&!filename)$('seo-slug').value=cleanSlug(p.title,4,36);
  const slug=filename?filename.slice(0,-3):$('seo-slug').value||cleanSlug(p.title,4,36);
  const shortShare=getShortShareUrl({filename,urlSlug:$('seo-slug').value,title:p.title});
  $('seo-preview-url').textContent='www.instantetrips.com/posts/'+(slug||'tu-historia')+'/';
  if($('shortlink-live-badge'))$('shortlink-live-badge').textContent=`Enlace para compartir: ${shortShare.replace('https://www.','')}`;
  $('seo-preview-title').textContent=($('seo-title').value.trim()||p.title||'El título de tu historia')+' | Instante Trips';
  $('seo-preview-description').textContent=p.description||'Aquí aparecerá la descripción de tu artículo.';
  $('social-preview-title').textContent=$('seo-preview-title').textContent;
  $('social-preview-description').textContent=$('seo-preview-description').textContent;
 }
 function write(p={}){
  filename=p.filename||'';manual=!!p.urlSlug;
  for(const [key,id] of Object.entries(fields))$(id).value=p[key]||'';
  $('seo-slug').disabled=!!filename;
  if($('btn-shorten-slug'))$('btn-shorten-slug').disabled=!!filename;
  if($('btn-copy-shortlink')){$('btn-copy-shortlink').disabled=!filename;$('btn-copy-shortlink').title=filename?'Copiar el enlace del artículo':'Publica el artículo para disponer de un enlace activo';}
  if(filename)$('seo-slug').value=filename.slice(0,-3);
  $('seo-slug-help').textContent=filename?'Dirección publicada protegida. Usa el botón “Copiar enlace corto” para compartir la versión corta en redes.':'Se genera corto automáticamente quitando conectores. Puedes editarlo o pulsar “Acortar dirección” antes de publicar.';
  refresh();
 }
 $('seo-slug').addEventListener('input',()=>{manual=!!$('seo-slug').value;refresh();});
 $('btn-shorten-slug')?.addEventListener('click',()=>{
  if(filename)return;
  const p=bridge.read();
  const base=$('seo-slug').value||p.title;
  const shorter=cleanSlug(base,3,24);
  if(shorter){$('seo-slug').value=shorter;manual=true;refresh();bridge.toast?.(`Link acortado a: ${shorter}`);}
 });
 $('btn-copy-shortlink')?.addEventListener('click',async()=>{
  const p=bridge.read();
  const shortUrl=getShortShareUrl({filename,urlSlug:$('seo-slug').value,title:p.title});
  try{await navigator.clipboard.writeText(shortUrl);bridge.toast?.(`Link corto copiado: ${shortUrl}`);}
  catch{prompt('Copia tu link corto:',shortUrl);}
 });
 function snapshot(){const p=read();if(filename)p.urlSlug='';return p;}
 function lock(p){if(p.filename){const data=read();write({...data,filename:p.filename,urlSlug:p.urlSlug});}}
 return {root,read:snapshot,write,refresh,lock,dispose:()=>root.remove()};
}
