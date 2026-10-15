const {test}=require('node:test'),assert=require('node:assert/strict');
const {infoPagesService,validatePage,DEFINITIONS}=require('../functions/info-pages.cjs');
const {DB}=require('./helpers/memory-db.cjs'),{repository}=require('./helpers/site-repository.cjs');
const initial=require('../src/data/info-pages/about.json');
function setup(){
 const files=Object.fromEntries(Object.keys(DEFINITIONS).map(key=>[`src/data/info-pages/${key}.json`,JSON.stringify(require(`../src/data/info-pages/${key}.json`))]));
 files['src/data/authors.ts']=require('node:fs').readFileSync('src/data/authors.ts','utf8');
 const repo=repository(files),db=new DB();let live='';const fetched=[];
 // Exercise the same optimistic atomic commit used by the admin service.
 const {adminService}=require('../functions/site-admin.cjs');
 const api=adminService({db,repository:repo.repository,now:()=>2000000,fetcher:async url=>{fetched.push(url);return {ok:true,text:async()=>live};}}).pages;
 return {api,repo,db,fetched,setLive:value=>live=value};
}
test('page HTML retains formatting and contact binding but removes executable content',()=>{
 const page=validatePage({...initial,html:'<h2>Una historia</h2><p><strong>Texto</strong> <a href="mailto:{{contactEmail}}">{{contactEmail}}</a><a href="https://example.com/?ref=123" target="_blank">Reserva</a></p><script>alert(1)</script><iframe src="https://evil.test"></iframe><a href="javascript:alert(1)" onclick="alert(1)">No</a>'});
 assert(page.html.includes('<strong>Texto</strong>'));assert(page.html.includes('{{contactEmail}}'));assert(page.html.includes('ref=123'));assert(page.html.includes('rel="noopener noreferrer"'));assert(!/script|iframe|onclick|javascript:/i.test(page.html));
});
test('empty pages and oversized metadata are rejected',()=>{
 assert.throws(()=>validatePage({...initial,title:''}));assert.throws(()=>validatePage({...initial,html:'<p> </p>'}));assert.throws(()=>validatePage({...initial,description:'x'.repeat(321)}));assert.throws(()=>validatePage({...initial,html:'x'.repeat(180001)}));
});
test('only the fixed information pages can be accessed',async()=>{
 const {api,repo}=setup();for(const key of ['../config/main','constructor','privacy/../../x'])await assert.rejects(api.load(key),{status:404});assert.equal(repo.calls.length,0);assert.deepEqual((await api.list()).map(p=>p.key),Object.keys(DEFINITIONS));
});
test('saving drafts is private, survives reload and rejects an older version',async()=>{
 const {api,repo}=setup(),loaded=await api.load('about');const saved=await api.save({key:'about',version:0,baseSha:loaded.baseSha,page:{...loaded.page,summary:'Una nueva introducción'}});
 assert.equal(saved.version,1);assert(saved.hasDraft);assert.equal((await api.load('about')).page.summary,'Una nueva introducción');assert.equal(repo.calls.filter(c=>c.method!=='GET').length,0);await assert.rejects(api.save({key:'about',version:0,baseSha:loaded.baseSha,page:initial}),{status:409});
});
test('publication changes one page in one commit and verifies the actual public revision',async()=>{
 const {api,repo,setLive,fetched}=setup(),loaded=await api.load('about');await api.save({key:'about',version:0,baseSha:loaded.baseSha,page:{...loaded.page,title:'Nuestra historia'}});const untouched=repo.files.get('src/data/info-pages/privacy.json').content;
 const release=await api.publish({key:'about',version:1});assert.equal(repo.calls.filter(c=>c.method==='PATCH').length,1);assert.equal(repo.calls.find(c=>c.ep==='/git/trees').input.tree.length,1);assert.equal(repo.files.get('src/data/info-pages/privacy.json').content,untouched);assert.equal((await api.status('about')).status,'deploying');setLive(`<meta name="managed-page-version" content="${release.revision}">`);assert.equal((await api.status('about')).status,'published');assert.equal(fetched.at(-1),'https://www.instantetrips.com/sobre-mi');const after=await api.load('about');assert.equal(after.hasDraft,false);assert.equal(after.baseSha,repo.files.get('src/data/info-pages/about.json').sha);
 // A second edit must use the new source SHA and remain publishable.
 await api.save({key:'about',version:after.version,baseSha:after.baseSha,page:{...after.page,summary:'Segunda edición'}});await api.publish({key:'about',version:2});assert.equal(repo.calls.filter(c=>c.method==='PATCH').length,2);
});
test('publication refuses to overwrite a source edited outside the panel',async()=>{
 const {api,repo}=setup(),loaded=await api.load('cookies');await api.save({key:'cookies',version:0,baseSha:loaded.baseSha,page:loaded.page});repo.files.get('src/data/info-pages/cookies.json').sha='external-change';await assert.rejects(api.publish({key:'cookies',version:1}),{status:409});assert.equal(repo.calls.filter(c=>c.method==='PATCH').length,0);
});
test('simultaneous publication cannot create duplicate commits',async()=>{
 const {api,repo}=setup(),loaded=await api.load('terms');await api.save({key:'terms',version:0,baseSha:loaded.baseSha,page:loaded.page});const results=await Promise.allSettled([api.publish({key:'terms',version:1}),api.publish({key:'terms',version:1})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(repo.calls.filter(c=>c.method==='PATCH').length,1);
});
test('recovering the source replaces the draft without publishing or affecting other pages',async()=>{
 const {api,repo}=setup(),loaded=await api.load('privacy');await api.save({key:'privacy',version:0,baseSha:loaded.baseSha,page:{...loaded.page,title:'Borrador privado'}});const restored=await api.reset({key:'privacy',version:1});assert.equal(restored.page.title,loaded.page.title);assert.equal(restored.version,2);assert.equal(repo.calls.filter(c=>c.method!=='GET').length,0);
});

test('migrated pages preserve exactly one valid contact placeholder in each link',()=>{for(const key of ['about','privacy']){const page=require(`../src/data/info-pages/${key}.json`);assert(page.html.includes('href="mailto:{{contactEmail}}"'));assert(!page.html.includes('{{{'));}});
