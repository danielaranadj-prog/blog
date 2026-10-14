const {test}=require('node:test');
const assert=require('node:assert/strict');
const {service,normalizePost,validate,markdownFile,cleanHtml,slug}=require('../functions/editor-core.cjs');
const fixture={title:'Un viaje por Madrid',description:'Una guía personal con experiencias y consejos útiles para recorrer Madrid.',html:'<p>'+('Experiencia verificada del viaje. '.repeat(10))+'</p>',date:'2026-10-20',author:'daniel-arana',hero:'/uploads/foto.jpg',tags:['España'],timezone:'America/Mazatlan'};
class DB{
  constructor(){this.data=new Map();this.lock=Promise.resolve();}
  doc(path){const db=this;return {path,id:path.split('/').at(-1),async get(){return db.snap(path);},async set(value,options){db.data.set(path,options?.merge?{...db.data.get(path),...value}:value);},async update(value){if(!db.data.has(path))throw Error('missing');db.data.set(path,{...db.data.get(path),...value});}};}
  snap(path){const data=this.data.get(path);return {exists:!!data,id:path.split('/').at(-1),data:()=>data?structuredClone(data):undefined,ref:this.doc(path)};}
  collection(path){const db=this;const make=(filters=[],max=Infinity)=>({doc:id=>db.doc(`${path}/${id}`),where:(k,op,v)=>make([...filters,[k,op,v]],max),limit:n=>make(filters,n),async get(){const docs=[...db.data.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(k=>db.snap(k)).filter(s=>filters.every(([k,op,v])=>op==='=='?s.data()[k]===v:op==='in'?v.includes(s.data()[k]):s.data()[k]>=v)).slice(0,max);return {docs,size:docs.length,forEach:fn=>docs.forEach(fn)};}});return make();}
  async runTransaction(fn){const result=this.lock.then(()=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o),update:(r,v)=>r.update(v)}));this.lock=result.catch(()=>{});return result;}
}
const user={uid:'daniel',admin:true};
function setup(fetcher){const db=new DB();const api=service({db,admin:{firestore:{Timestamp:{fromMillis:n=>n}}},fetcher,now:()=>1000000});return {db,api};}
test('YAML quotes and newlines remain data, never frontmatter injection',()=>{
  const p=normalizePost({...fixture,title:'Título "comillas"\nlayout: atacante'});
  const matter=require('gray-matter');const output=markdownFile(p,p.html,'revision-1');
  assert.equal(matter(output).data.title,p.title);assert.equal(matter(output).data.layout,'../../layouts/BlogPost.astro');
});
test('HTML rejects scripts, handlers, unsafe URLs and foreign iframes',()=>{
  const safe=cleanHtml('<script>alert(1)</script><img src="javascript:alert(1)" onerror="alert(1)" data-media-id="id"><iframe src="https://evil.example"></iframe><iframe src="https://www.youtube.com/embed/123"></iframe>');
  assert(!safe.includes('<script'));assert(!safe.includes('onerror'));assert(!safe.includes('javascript'));assert(!safe.includes('src="https://evil'));assert(safe.includes('data-media-id'));assert(safe.includes('youtube.com'));
});
test('drafts save privately without any GitHub or publication call',async()=>{
  let calls=0;const {api}=setup(()=>{calls++;throw Error('must not publish');});
  const p=await api.save(user,{title:'Idea incompleta'});assert.equal(p.status,'draft');assert.equal(calls,0);assert.equal(p.version,1);
});
test('stale versions and simultaneous edits cannot overwrite newer work',async()=>{
  const {api}=setup();const p=await api.save(user,fixture);
  const results=await Promise.allSettled([api.save(user,{...p,title:'Versión de pestaña uno'}),api.save(user,{...p,title:'Versión de pestaña dos'})]);
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.find(x=>x.status==='rejected').reason.status,409);
});
test('other authors cannot load, overwrite or publish another author draft',async()=>{
  const {api}=setup();const p=await api.save(user,fixture);const other={uid:'otro',admin:false};
  await assert.rejects(api.getPost(other,p.id),{status:403});await assert.rejects(api.save(other,p),{status:403});await assert.rejects(api.publish(other,p.id),{status:403});
});
test('schedule requires healthy server and rejects past dates',async()=>{
  const {api,db}=setup();await assert.rejects(api.save(user,{...fixture,scheduledAt:1200000},'scheduled'),{status:503});
  await db.doc('editor_system/scheduler').set({lastHeartbeat:999000});
  await assert.rejects(api.save(user,{...fixture,scheduledAt:900000},'scheduled'),{status:400});
  const p=await api.save(user,{...fixture,scheduledAt:1200000},'scheduled');assert.equal(p.status,'scheduled');assert.equal(p.scheduledAt,1200000);
});
test('upload validates actual image bytes and is private by owner',async()=>{
  const {api}=setup();await assert.rejects(api.mediaSave(user,{base64:Buffer.from('<script>').toString('base64')}),{status:400});
  const m=await api.mediaSave(user,{name:'foto.jpg',base64:Buffer.from([255,216,255,1,2]).toString('base64')});
  const list=await api.mediaList(user);assert(!('base64' in list[0]));assert.equal(m.storage,'firestore');
  await assert.rejects(api.mediaGet({uid:'otro',admin:false},m.id),{status:403});
});
test('scheduler never publishes a future article or a draft',async()=>{
  let calls=0;const {api,db}=setup(()=>{calls++;throw Error('no');});
  await api.save(user,fixture);await db.doc('editor_system/scheduler').set({lastHeartbeat:999999});await api.save(user,{...fixture,scheduledAt:2000000},'scheduled');await api.tick();assert.equal(calls,0);
});
test('a public page without the expected revision remains pending',async()=>{
  const {api,db}=setup(async()=>({ok:true,text:async()=>'<html>old version</html>'}));
  const p=await api.save(user,fixture);await db.doc(`editor_posts/${p.id}`).update({status:'deploying',filename:'post.md',revision:'revision-2'});
  assert.equal((await api.verify(user,p.id)).status,'deploying');
});
test('slug supports accents and prevents path traversal',()=>{assert.equal(slug('¿México /../ Bogotá?'),'mexico-bogota');assert(validate(normalizePost(fixture)).length===0);});
function githubMock(){
  const log=[],state={file:null,tree:null,live:false};
  const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>typeof body==='string'?body:JSON.stringify(body)});
  const fetcher=async(url,opts={})=>{
    log.push({url,method:opts.method||'GET',body:opts.body?JSON.parse(opts.body):undefined});
    if(url.startsWith('https://www.instantetrips.com/'))return response(state.live?`<meta name="editor-revision" content="${state.revision}">`:'old');
    const path=new URL(url).pathname.replace('/repos/o/r','');
    if(path.startsWith('/contents/'))return state.file?response(state.file):response({},404);
    if(path.startsWith('/git/ref/heads/'))return response({object:{sha:'head'}});
    if(path==='/git/commits/head')return response({tree:{sha:'tree'}});
    if(path==='/git/trees'){state.tree=JSON.parse(opts.body);return response({sha:'newtree'});}
    if(path==='/git/commits')return response({sha:'newcommit'});
    if(path.startsWith('/git/refs/heads/')){
      const article=state.tree.tree.find(x=>x.path.endsWith('.md'));state.file={sha:'file-sha',content:Buffer.from(article.content).toString('base64')};state.revision=require('gray-matter')(article.content).data.editorRevision;return response({});
    }
    throw Error('Unexpected request '+path);
  };
  return {fetcher,log,state};
}
test('simultaneous publish creates one atomic commit and waits for verified live revision',async()=>{
  const mock=githubMock(),{api,db}=setup(mock.fetcher);await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main',postsPath:'src/pages/posts/'});
  const p=await api.save(user,fixture);
  const results=await Promise.allSettled([api.publish(user,p.id,p.version),api.publish(user,p.id,p.version)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(mock.log.filter(x=>x.method==='PATCH').length,1);
  assert.equal((await api.getPost(user,p.id)).status,'deploying');assert.equal((await api.verify(user,p.id)).status,'deploying');
  mock.state.live=true;assert.equal((await api.verify(user,p.id)).status,'published');assert.equal((await api.getPost(user,p.id)).sourceSha,'file-sha');
});
test('retry after commit succeeds without creating a second GitHub commit',async()=>{
  const mock=githubMock(),{api,db}=setup(mock.fetcher);await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main'});
  const p=await api.save(user,fixture);await api.publish(user,p.id,p.version);
  await db.doc(`editor_posts/${p.id}`).update({status:'error'});
  await api.publish(user,p.id,p.version);assert.equal(mock.log.filter(x=>x.method==='PATCH').length,1);assert.equal((await api.getPost(user,p.id)).status,'deploying');
});
test('publication refuses to overwrite an article changed outside the planner',async()=>{
  const mock=githubMock(),{api,db}=setup(mock.fetcher);await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main'});
  const p=await api.save(user,fixture);await db.doc(`editor_posts/${p.id}`).update({filename:'existing.md',sourceSha:'old-sha'});mock.state.file={sha:'new-external-sha',content:Buffer.from('---\ntitle: existing\n---\ntext').toString('base64')};
  await assert.rejects(api.publish(user,p.id,p.version),{status:409});assert.equal(mock.log.filter(x=>x.method==='PATCH').length,0);
});
test('calendar converts local time to UTC and rejects nonexistent daylight-saving time',async()=>{
  const fs=require('fs');const source=fs.readFileSync('public/editor/planner-utils.js','utf8');const u=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  assert.equal(new Date(u.localToUtc('2026-10-20T10:00','America/Mazatlan')).toISOString(),'2026-10-20T17:00:00.000Z');
  assert.equal(u.localToUtc('2026-03-29T02:30','Europe/Madrid'),null);
  assert.equal(u.dayKey(Date.parse('2026-10-20T01:00Z'),'America/Mazatlan'),'2026-10-19');
});
test('link checker blocks private, loopback, link-local and mapped addresses',()=>{
  const {isPublic}=require('../functions/link-check.cjs');
  for(const ip of ['127.0.0.1','10.0.0.1','169.254.169.254','192.168.0.1','172.16.1.1','100.64.0.1','::1','::ffff:127.0.0.1','fc00::1','2001:db8::1'])assert.equal(isPublic(ip),false,ip);
  assert.equal(isPublic('8.8.8.8'),true);assert.equal(isPublic('2606:4700::1111'),true);
});
test('archive cancels scheduling without deleting work and allows restoration',async()=>{
  const {api,db}=setup();await db.doc('editor_system/scheduler').set({lastHeartbeat:999999});
  const p=await api.save(user,{...fixture,scheduledAt:1200000},'scheduled');
  const archived=await api.archive(user,p.id,true);assert.equal(archived.status,'draft');assert.equal(archived.scheduledAt,null);assert.equal(archived.archived,true);
  assert.equal((await api.archive(user,p.id,false)).archived,false);
});
test('AI requires configured connection and explicit consent before transmitting text',async()=>{
  const {generateEditorialText}=require('../functions/editor-ai.cjs');const {db}=setup();let calls=0;
  await assert.rejects(generateEditorialText({db,user,input:{text:'notas privadas de un viaje',consent:true},fetcher:()=>{calls++;}}),{status:503});
  process.env.EDITOR_GEMINI_API_KEY='local-test-only';process.env.EDITOR_GEMINI_MODEL='test-model';
  try {await assert.rejects(generateEditorialText({db,user,input:{text:'notas privadas de un viaje',consent:false},fetcher:()=>{calls++;}}),{status:400});assert.equal(calls,0);}finally{delete process.env.EDITOR_GEMINI_API_KEY;delete process.env.EDITOR_GEMINI_MODEL;}
});
