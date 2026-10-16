const {test}=require('node:test'),assert=require('node:assert/strict');
const {catalogAnchor,resolveCatalogHtml}=require('../functions/catalog-presentation.cjs');
const {cleanHtml}=require('../functions/editor-core.cjs');
const item={id:'madrid',enabled:true,confirmed:true,type:'affiliate',url:'https://example.com/?aid=real&city=madrid',title:'Actividad <segura>',provider:'Proveedor',text:'Descripción real',button:'Ver disponibilidad'};
test('text, button and card preserve tracking and escape provider-controlled text',()=>{
 for(const format of ['text','button','card']){const html=catalogAnchor(item,{format,text:'Mi viaje <real>'});assert(html.includes('aid=real&amp;city=madrid'));assert(html.includes('rel="sponsored nofollow noopener"'));assert(!html.includes('<segura>'));assert(!html.includes('<real>'));assert(html.includes(`data-catalog-format="${format}"`));}
 assert(catalogAnchor(item,{format:'card'}).includes('Podemos recibir una comisión'));
});
test('publication refreshes card details and keeps custom inline link wording',()=>{
 const card=catalogAnchor(item,{format:'card'}),button=catalogAnchor(item,{format:'button',text:'Mi enlace'});
 const updated={...item,title:'Título actualizado',url:'https://example.com/?aid=new'};
 const html=resolveCatalogHtml(card+button,[updated]);assert(html.includes('Título actualizado'));assert(!html.includes('Actividad &lt;segura&gt;'));assert(html.includes('aid=new'));assert(html.includes('Mi enlace'));assert(!html.includes('→ →'));
});
test('inactive cards disappear and inactive links remain readable',()=>{
 assert.equal(resolveCatalogHtml(catalogAnchor(item,{format:'card'}),[]),'');
 const html=resolveCatalogHtml(catalogAnchor(item,{text:'Experiencia elegida'}),[]);assert.equal(html,'Experiencia elegida');
 assert.equal(catalogAnchor({...item,url:'javascript:alert(1)'},{format:'card'}),'');
});
test('sanitizer retains catalog presentation through private saves',()=>{
 const html=cleanHtml(catalogAnchor(item,{format:'card'}));assert(html.includes('data-catalog-format="card"'));assert(html.includes('catalog-inline-card'));assert(html.includes('sponsored'));
});
