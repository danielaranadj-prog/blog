const sanitizeHtml=require('sanitize-html');
const escape=value=>String(value||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function catalogAnchor(item,{format='text',text=''}={}){
 if(!item?.enabled||!item.confirmed||!/^https:\/\/[^\s\\]+$|^\/downloads\/[^\s\\]+$/.test(item.url||''))return '';
 const kind=item.type==='download'?'download':'affiliate';
 const mode=['text','button','card'].includes(format)?format:'text';
 const label=kind==='affiliate'?'ENLACE DE AFILIACIÓN':'RECURSO DESCARGABLE';
 const button=item.button||(kind==='affiliate'?'Consultar disponibilidad':'Descargar PDF');
 const attrs=`href="${escape(item.url)}" data-catalog-id="${escape(item.id)}" data-catalog-format="${mode}" data-track="${kind}_click" target="_blank" rel="${kind==='affiliate'?'sponsored nofollow noopener':'noopener'}"`;
 if(mode==='card')return `<a ${attrs} class="catalog-inline-card"><span class="catalog-inline-label">${label}${item.provider?' · '+escape(item.provider):''}</span><strong>${escape(item.title)}</strong>${item.text?`<span class="catalog-inline-description">${escape(item.text)}</span>`:''}<span class="catalog-inline-button">${escape(button)} →</span>${kind==='affiliate'?'<small>Podemos recibir una comisión si reservas desde este enlace.</small>':''}</a>`;
 return `<a ${attrs}${mode==='button'?' class="catalog-inline-button"':''}>${escape(mode==='button'?(text||button).replace(/(?:\s*→)+\s*$/,''):text||button)}${mode==='button'?' →':''}</a>`;
}
function resolveCatalogHtml(html,catalog){
 return html.replace(/<a\b([^>]*data-catalog-id=["']([a-z0-9-]+)["'][^>]*)>([\s\S]*?)<\/a>/g,(all,attrs,id,body)=>{
  const format=attrs.match(/data-catalog-format=["'](text|button|card)["']/)?.[1]||'text';
  const item=catalog.find(i=>i.id===id&&i.enabled&&i.confirmed);
  if(!item)return format==='card'?'':sanitizeHtml(body,{allowedTags:[],allowedAttributes:{}});
  const text=sanitizeHtml(body,{allowedTags:[],allowedAttributes:{}}).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
  return catalogAnchor(item,{format,text});
 });
}
module.exports={catalogAnchor,resolveCatalogHtml,escape};
