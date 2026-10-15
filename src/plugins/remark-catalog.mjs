import fs from 'node:fs';
import {visit} from 'unist-util-visit';
import sanitizeHtml from 'sanitize-html';
export function remarkCatalog(){
 const settings=JSON.parse(fs.readFileSync(new URL('../data/site-settings.json',import.meta.url),'utf8'));
 return tree=>visit(tree,'html',node=>{if(!node.value.includes('data-catalog-id'))return;
 node.value=node.value.replace(/<a\b([^>]*data-catalog-id=["']([a-z0-9-]+)["'][^>]*)>([\s\S]*?)<\/a>/g,(all,attrs,id,body)=>{
 const item=settings.catalog?.find(i=>i.id===id&&i.enabled&&i.confirmed);
 if(!item)return sanitizeHtml(body,{allowedTags:[],allowedAttributes:{}});
 const escape=s=>String(s).replace(/[&"<>]/g,c=>({'&':'&amp;','"':'&quot;','<':'&lt;','>':'&gt;'}[c]));
 return `<a href="${escape(item.url)}" data-catalog-id="${id}" data-track="${item.type==='affiliate'?'affiliate_click':'download_click'}" target="_blank" rel="${item.type==='affiliate'?'sponsored nofollow noopener':'noopener'}">${body}</a>`;
 });});
}
