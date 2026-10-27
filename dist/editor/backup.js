const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function mountBackup(panel,api,toast){
 panel.innerHTML=`<div class="planner-wrap"><h1>Respaldos y recuperación</h1><p>Exporta artículos, notas y fotografías privadas a un archivo en tu dispositivo. No incluye contraseñas ni claves. Las imágenes externas y las ya publicadas conservan sus enlaces; este archivo no es una copia de todo el alojamiento.</p><label><input type="checkbox" id="backup-media" checked> Incluir fotografías privadas (puede tardar)</label><p><button class="planner-button primary" id="export-backup">Exportar mi redacción</button></p><h2>Recuperar un respaldo</h2><p>Se crean borradores nuevos: no se reemplazan ni se publican tus artículos. No importes respaldos de otras personas.</p><input type="file" id="backup-file" accept="application/json"><button class="planner-button" id="import-backup">Revisar respaldo</button><p id="backup-status" role="status" aria-live="polite"></p><div id="backup-review"></div></div>`;
 const status=panel.querySelector('#backup-status');let running=false;
 async function task(button,fn){if(running)return;running=true;button.disabled=true;try{await fn();}catch(e){status.textContent=e.message;}finally{button.disabled=false;running=false;}}
 function download(data,name){const url=URL.createObjectURL(new Blob([JSON.stringify(data)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
 panel.querySelector('#export-backup').onclick=e=>task(e.target,async()=>{
  const list=(await api('list')).posts;const backup={format:'instante-editor',version:1,createdAt:new Date().toISOString(),posts:[],media:[],library:{}};
  for(const p of list){status.textContent=`Exportando artículo ${backup.posts.length+1} de ${list.length}…`;const full=await api('get',{id:p.id});const {owner,claim,...safe}=full;backup.posts.push(safe);}
  for(const kind of ['ideas','trips','questions'])backup.library[kind]=await api('items',{kind});
  if(panel.querySelector('#backup-media').checked){const media=await api('mediaList');for(const m of media){status.textContent=`Exportando foto ${backup.media.length+1} de ${media.length}…`;backup.media.push({...m,...await api('mediaGet',{id:m.id})});}}
  download(backup,`instante-redaccion-${new Date().toISOString().slice(0,10)}.json`);status.textContent=`Respaldo descargado: ${list.length} artículos y ${backup.media.length} fotos. Guárdalo en un lugar privado. Límites de esta versión: 500 artículos y 250 fotos.`;
 });
 panel.querySelector('#import-backup').onclick=e=>task(e.target,async()=>{
  const file=panel.querySelector('#backup-file').files[0];if(!file||file.size>200000000)throw Error('Selecciona un respaldo JSON de hasta 200 MB.');const b=JSON.parse(await file.text());
  if(b.format!=='instante-editor'||b.version!==1||!Array.isArray(b.posts)||!Array.isArray(b.media)||b.posts.length>500||b.media.length>250)throw Error('Este archivo no es un respaldo compatible.');
  const review=panel.querySelector('#backup-review');review.innerHTML=`<p>${b.posts.length} artículos · ${b.media.length} fotografías. Las programaciones y los estados publicados no se recuperan.</p><button class="planner-button primary" id="confirm-backup">Crear borradores desde este respaldo</button>`;
  const batchId=crypto.randomUUID(),map=new Map();
  review.querySelector('button').onclick=e=>task(e.target,async()=>{
   for(const m of b.media){if(map.has(m.id))continue;status.textContent=`Recuperando fotos: ${map.size+1}/${b.media.length}…`;const saved=await api('mediaSave',{media:m});map.set(m.id,saved.id);}
   let count=0,unresolved=0;for(const [index,original] of b.posts.entries()){const restoreId=`restore-${batchId}-${index}`;try{await api('get',{id:restoreId});count++;continue;}catch(e){if(e.status!==404)throw e;}const {post:p,missing}=restorePostInput(original,map,restoreId);unresolved+=missing;
    await api('save',{post:p});status.textContent=`Recuperando borradores: ${++count}/${b.posts.length}…`;
   }
   for(const kind of ['ideas','trips','questions'])for(const [index,item] of (b.library?.[kind]||[]).slice(0,300).entries())await api('saveItem',{kind,item:{...item,id:`restore-${batchId}-${kind}-${index}`}});
   review.replaceChildren();status.textContent=`${count} borradores recuperados. Revisa el contenido y sus fotos antes de publicar.${unresolved?' Algunas fotos privadas no estaban en el respaldo; revísalas antes de publicar.':''}`;toast('Recuperación terminada como borradores privados.');
  });
 });
}

export function restorePostInput(original,map,id){let missing=0;const p={...original,id:id,version:undefined,tripId:''};
    p.mediaIds=(p.mediaIds||[]).flatMap(id=>map.has(id)?[map.get(id)]:[]);
    if(p.hero?.startsWith('media:')){const id=p.hero.slice(6);if(map.has(id))p.hero='media:'+map.get(id);else{p.hero='';missing++;}}
    p.html=String(p.html||'').replace(/data-media-id="([\w-]+)"/g,(all,id)=>{if(map.has(id))return `data-media-id="${map.get(id)}"`;missing++;return '';}).replace(/\ssrc="blob:[^"]*"/g,'');
return {post:p,missing};}
