const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');
test('schema uses actual dates, absolute assets and editorial genre without inventing facts',async()=>{
 const {articleSchema,jsonLd}=await import('../src/utils/article-seo.mjs');const schema=articleSchema({post:{title:'¿Vale la pena?',description:'Experiencia',heroImage:'/uploads/a.jpg',publishDate:'2026-10-01',modifiedDate:'2026-10-12',editorialType:'opinion',destination:'El Calafate',tags:['Argentina'],focusQuestion:'PRIVADO'},author:{name:'Daniel',slug:'daniel'},permalink:'https://www.instantetrips.com/posts/calafate/',settings:{name:'Instante',assets:{favicon:'/logo.svg'}}});
 const p=schema['@graph'][0];assert.equal(p['@type'],'BlogPosting');assert.equal(p.genre,'Opinión');assert.equal(p.dateModified,'2026-10-12T00:00:00.000Z');assert.equal(p.image[0],'https://www.instantetrips.com/uploads/a.jpg');assert.equal(p.author.url,'https://www.instantetrips.com/posts/calafate/#autor');assert(!JSON.stringify(schema).includes('PRIVADO'));assert(!jsonLd({title:'</script><script>x</script>'}).includes('<'));
 const invalid=articleSchema({post:{title:'Sin fecha'},author:{name:'Daniel'},permalink:'https://www.instantetrips.com/posts/a/',settings:{name:'Instante',assets:{favicon:'/logo.svg'}}});assert.equal(invalid['@graph'][0].datePublished,undefined);
});
test('audit treats editorial recommendations as warnings and missing essentials as errors',async()=>{
 const source=fs.readFileSync('public/editor/planner-utils.js','utf8');const {auditContent}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const p={title:'Breve',description:'Corta',html:'<p>Respuesta.</p>',author:'daniel',hero:'/uploads/foto.jpg',tags:[]};assert.equal(auditContent(p).filter(f=>f.level==='error').length,0);assert(auditContent(p).some(f=>f.field==='hero-alt'));assert(auditContent({...p,urlSlug:'../a'}).some(f=>f.level==='error'&&f.field==='seo-slug'));assert(auditContent({...p,title:''}).some(f=>f.field==='post-title'));
});
test('generated public pages distinguish website and article and exclude search from indexing',()=>{
 assert(fs.readFileSync('dist/index.html','utf8').includes('property="og:type" content="website"'));
 const post=fs.readFileSync('dist/posts/vpn-vuelos/index.html','utf8');assert(post.includes('property="og:type" content="article"'));assert(post.includes('id="autor"'));
 assert(fs.readFileSync('dist/buscar/index.html','utf8').includes('noindex, follow'));
 const sitemap=fs.readFileSync('dist/sitemap-0.xml','utf8');assert(!sitemap.includes('/buscar/'));assert(sitemap.includes('<lastmod>'));assert(!post.includes('focusQuestion'));
});
