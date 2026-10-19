const {test}=require('node:test');
const assert=require('node:assert/strict');
const {service,normalizePost,validate,markdownFile,cleanHtml,slug}=require('../functions/editor-core.cjs');
const fixture={title:'Un viaje por Madrid',description:'Una guía personal con experiencias y consejos útiles para recorrer Madrid.',html:'<p>'+('Experiencia verificada del viaje. '.repeat(10))+'</p>',date:'2026-10-20',author:'daniel-arana',hero:'/uploads/foto.jpg',tags:['España'],timezone:'America/Mazatlan'};
const {DB}=require('./helpers/memory-db.cjs');
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
    if(path==='/git/blobs')return response({sha:'image-blob'});
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

test('private photographs and the article are published together in one commit',async()=>{
  const mock=githubMock(),{api,db}=setup(mock.fetcher);await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main'});
  const m=await api.mediaSave(user,{name:'foto.jpg',base64:Buffer.from([255,216,255,1,2]).toString('base64')});
  const p=await api.save(user,{...fixture,hero:'media:'+m.id,html:fixture.html+`<img data-media-id="${m.id}" src="blob:local" alt="Vista del viaje">`,mediaIds:[m.id]});
  await api.publish(user,p.id,p.version);
  assert.equal(mock.log.filter(x=>x.method==='PATCH').length,1);
  assert.equal(mock.state.tree.tree.length,2);
  const article=mock.state.tree.tree.find(x=>x.path.endsWith('.md')).content;
  assert(article.includes(`/uploads/${m.id}.jpg`));assert(!article.includes('blob:local'));assert(!article.includes('heroImage: "media:'));
});
test('statistics use new daily aggregates and exclude legacy individual events',async()=>{
 const {api,db}=setup();await db.doc('analytics_events/old').set({type:'page_view',path:'/old',timestamp:1000000});await db.doc('analytics_daily/a').set({day:'1970-01-01',type:'page_view',path:'/posts/madrid',count:2});await db.doc('analytics_daily/b').set({day:'1970-01-01',type:'affiliate_click',path:'/posts/madrid',target:'madrid-tour',count:3});const result=await api.stats(user);assert.equal(result.views,2);assert.equal(result.clicks,3);assert.deepEqual(result.pages,[{path:'/posts/madrid',views:2}]);assert.deepEqual(result.targets,[{id:'madrid-tour',clicks:3}]);
});

test('legacy integration credentials move atomically to private server configuration',async()=>{const {db,api}=setup();await db.doc('config/main').set({repoOwner:'owner',repoName:'repo',branch:'main',postsPath:'src/pages/posts/',githubToken:'test-only-secret',geminiToken:'test-only-ai'});await api.repository.secureConfig();const publicData=(await db.doc('config/main').get()).data(),privateData=(await db.doc('server_config/main').get()).data();assert.equal(publicData.githubToken,undefined);assert.equal(publicData.geminiToken,undefined);assert.equal(privateData.githubToken,'test-only-secret');assert.equal((await api.repository.config()).branch,'main');await api.repository.secureConfig();assert.equal((await db.doc('server_config/main').get()).data().githubToken,'test-only-secret');});

function removalSetup({file=true,conflict=false,liveStatus=200,deleteStatus=200}={}) {
  const log=[],state={file:file?{sha:conflict?'external-sha':'original-sha',content:Buffer.from('---\ntitle: Original\n---\nContenido público original').toString('base64')}:null,liveStatus};
  const response=(body,status=200)=>({ok:status>=200&&status<300,status,json:async()=>body,text:async()=>String(body)});
  const {api,db}=setup(async(url,options={})=>{
    const body=options.body?JSON.parse(options.body):null;log.push({url,method:options.method||'GET',body});
    if(url.startsWith('https://www.instantetrips.com/'))return response('',state.liveStatus);
    if(options.method==='DELETE'){if(deleteStatus!==200)return response({},deleteStatus);assert.equal(body.sha,state.file.sha);state.file=null;return response({commit:{sha:'removal-commit'}});}
    return state.file?response(state.file):response({},404);
  });
  async function seed(extra={}){await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main'});const p=await api.save(user,fixture);await db.doc(`editor_posts/${p.id}`).update({status:'published',filename:'prueba.md',sourceSha:'original-sha',publishedUrl:'https://www.instantetrips.com/posts/prueba/',...extra});return api.getPost(user,p.id);}
  return {api,db,seed,log,state};
}
test('removal deletes only the public source, keeps private work and verifies live 404 before trash',async()=>{
  const {api,db,seed,log,state}=removalSetup();const p=await seed();
  const removing=await api.trash(user,p.id,p.version);assert.equal(removing.status,'removing');assert.equal(removing.removalReady,true);assert.equal(removing.scheduledAt,null);assert.equal(removing.html,p.html);
  assert.equal(log.filter(x=>x.method==='DELETE').length,1);assert(log.find(x=>x.method==='DELETE').url.endsWith('/src/pages/posts/prueba.md'));
  const history=(await db.doc(`editor_history/${p.id}-removed-${p.version}`).get()).data();assert(history.publicSource.includes('Contenido público original'));assert.equal((await api.getPost(user,p.id)).html,p.html);
  assert.equal((await api.verifyRemoval(user,p.id)).status,'removing');
  state.liveStatus=500;assert.equal((await api.verifyRemoval(user,p.id)).status,'removing');
  state.liveStatus=404;const trashed=await api.verifyRemoval(user,p.id);assert.equal(trashed.status,'trashed');assert.equal(trashed.sourceSha,'');
  const count=log.length;const restored=await api.restore(user,p.id,trashed.version);assert.equal(restored.status,'draft');assert.equal(restored.html,p.html);assert.equal(restored.filename,'prueba.md');assert.equal(log.length,count);
});
test('removal is admin-only and requires the current version',async()=>{
  const {api,seed,log}=removalSetup();const p=await seed();
  await assert.rejects(api.trash({uid:user.uid,admin:false},p.id,p.version),{status:403});
  await assert.rejects(api.trash(user,p.id,p.version-1),{status:409});assert.equal(log.length,0);
});
test('simultaneous removal makes only one GitHub deletion',async()=>{
  const {api,seed,log}=removalSetup();const p=await seed();const results=await Promise.allSettled([api.trash(user,p.id,p.version),api.trash(user,p.id,p.version)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(log.filter(x=>x.method==='DELETE').length,1);
});
test('removal refuses external edits and never retries via the scheduler',async()=>{
  const {api,seed,log}=removalSetup({conflict:true});const p=await seed({scheduledAt:1,nextAttemptAt:1});
  await assert.rejects(api.trash(user,p.id,p.version),{status:409});assert.equal(log.filter(x=>x.method==='DELETE').length,0);
  const failed=await api.getPost(user,p.id);assert.equal(failed.status,'removal_error');assert.equal(failed.nextAttemptAt,0);assert.equal(failed.scheduledAt,null);
  const count=log.length;await api.tick();assert.equal(log.length,count);await assert.rejects(api.publish(user,p.id,failed.version),{status:409});
});
test('failed GitHub deletion retains content and offers an explicit retry',async()=>{
  const {api,seed}=removalSetup({deleteStatus:502});const p=await seed();await assert.rejects(api.trash(user,p.id,p.version),{status:502});const failed=await api.getPost(user,p.id);assert.equal(failed.status,'removal_error');assert.equal(failed.html,p.html);
});
test('private drafts move to trash with no network request and cancel scheduling',async()=>{
  const {api,db,log}=removalSetup();const p=await api.save(user,fixture);await db.doc(`editor_posts/${p.id}`).update({status:'scheduled',scheduledAt:1200000});
  const trashed=await api.trash(user,p.id,p.version);assert.equal(trashed.status,'trashed');assert.equal(trashed.scheduledAt,null);assert.equal(log.length,0);
  await assert.rejects(api.save(user,trashed),{status:409});await assert.rejects(api.publish(user,p.id,trashed.version),{status:409});await assert.rejects(api.archive(user,p.id,false),{status:409});await assert.rejects(api.restore(user,p.id,p.version),{status:409});
});
test('already missing source is removable and cannot be republished from the trash',async()=>{
  const {api,seed,state,log}=removalSetup({file:false,liveStatus:404});const p=await seed();await api.trash(user,p.id,p.version);const trashed=await api.verifyRemoval(user,p.id);assert.equal(trashed.status,'trashed');assert.equal(log.filter(x=>x.method==='DELETE').length,0);
  await assert.rejects(api.publish(user,p.id,trashed.version),{status:409});await assert.rejects(api.reloadPublished(user,p.id),{status:404});
});
test('malformed filenames cannot escape the article directory during removal',async()=>{
  const {api,seed,log}=removalSetup();const p=await seed({filename:'../authors.ts.md'});await assert.rejects(api.trash(user,p.id,p.version),{status:400});assert.equal(log.length,0);
});
test('summary survives normalization, Markdown publication and links are validated',()=>{
 const p=normalizePost({...fixture,quickSummary:{budget:'120 EUR',bestSeason:'Octubre',ctaText:'Descargar mi PDF',ctaLink:'/downloads/prueba.pdf'}});const f=require('gray-matter')(markdownFile(p,p.html,'v')).data;assert.equal(f.quickSummary.budget,'120 EUR');assert.equal(f.quickSummary.ctaLink,'/downloads/prueba.pdf');assert.throws(()=>normalizePost({...fixture,quickSummary:{ctaLink:'javascript:alert(1)'}}),{status:400});
});
test('versions are recoverable as private drafts without publishing or overwriting other authors',async()=>{
 let calls=0;const {api}=setup(()=>{calls++;throw Error('No network');});const p=await api.save(user,fixture);const updated=await api.save(user,{...p,title:'Versión más reciente del viaje'});const list=await api.history(user,p.id);assert.equal(list.length,1);assert.equal(list[0].version,1);await assert.rejects(api.restoreVersion({uid:'other',admin:false},p.id,1,2),{status:403});await assert.rejects(api.restoreVersion(user,p.id,1,1),{status:409});const restored=await api.restoreVersion(user,p.id,1,updated.version);assert.equal(restored.title,p.title);assert.equal(restored.status,'draft');assert.equal(calls,0);
});


test('editorial fields survive draft, source publication, reload and preserve private question',async()=>{
 const mock=githubMock(),{api,db}=setup(mock.fetcher);await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main'});
 const p=await api.save(user,{...fixture,seoTitle:'Calafate con poco presupuesto',editorialType:'opinion',destination:'El Calafate',budgetLevel:'economico',focusQuestion:'Pregunta privada de trabajo',urlSlug:'calafate-presupuesto',modifiedDate:'2026-10-21'});
 assert.equal((await api.getPost(user,p.id)).focusQuestion,'Pregunta privada de trabajo');
 const result=await api.publish(user,p.id,p.version);assert.equal(result.filename,'calafate-presupuesto.md');
 const file=mock.state.tree.tree.find(x=>x.path.endsWith('.md')).content;const f=require('gray-matter')(file).data;
 assert.equal(f.seoTitle,p.seoTitle);assert.equal(f.editorialType,'opinion');assert.equal(f.modifiedDate,'2026-10-21');assert(!file.includes(p.focusQuestion));assert(!file.includes('focusQuestion:'));
 await db.doc(`editor_posts/${p.id}`).update({status:'published'});const reloaded=await api.reloadPublished(user,p.id);assert.equal(reloaded.budgetLevel,'economico');assert.equal(reloaded.focusQuestion,p.focusQuestion);assert.equal(reloaded.urlSlug,p.urlSlug);
 await assert.rejects(api.save(user,{...reloaded,urlSlug:'otra-direccion'}),{status:409});
 const legacyClient={...fixture,id:p.id,version:reloaded.version};const compatible=await api.save(user,legacyClient);assert.equal(compatible.seoTitle,p.seoTitle);assert.equal(compatible.urlSlug,p.urlSlug);
});
test('editorial validation rejects unsafe slugs and invalid dates without imposing word counts',()=>{
 for(const urlSlug of ['../admin','con espacios','https://evil.example','a--b'])assert.throws(()=>normalizePost({...fixture,urlSlug}),{status:400});
 for(const modifiedDate of ['2026-02-30','2026-99-99'])assert.throws(()=>normalizePost({...fixture,modifiedDate}),{status:400});
 const p=normalizePost({...fixture,title:'Breve',description:'Una descripción.',html:'<p>Una respuesta breve.</p>',tags:[],editorialType:'inventado',budgetLevel:'otro'});assert.deepEqual(validate(p),[]);assert.equal(p.editorialType,'');assert.equal(p.budgetLevel,'');
 assert(validate({...p,modifiedDate:'2020-01-01'}).some(e=>e.includes('anterior')));
});
test('first publication collision never overwrites another article',async()=>{
 const mock=githubMock(),{api,db}=setup(mock.fetcher);await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'test-only',branch:'main'});
 mock.state.file={sha:'existing',content:Buffer.from('---\ntitle: Otro artículo\n---\nTexto').toString('base64')};
 const p=await api.save(user,{...fixture,urlSlug:'ya-existe'});await assert.rejects(api.publish(user,p.id,p.version),{status:409});assert.equal(mock.log.filter(x=>x.method==='PATCH').length,0);
});


test('removal review reads the current public version without changing the private draft',async()=>{
 const {api,seed,log}=removalSetup({conflict:true});const p=await seed();
 const review=await api.prepareRemoval(user,p.id);
 assert.equal(review.sourceSha,'external-sha');assert.equal(review.changed,true);assert.equal(review.title,'Original');assert.equal(review.version,p.version);
 assert.deepEqual(await api.getPost(user,p.id),p);assert.equal(log.filter(x=>x.method==='DELETE').length,0);
 await assert.rejects(api.prepareRemoval({uid:user.uid,admin:false},p.id),{status:403});
});
test('explicit review allows removal of a changed public version while preserving private content',async()=>{
 const {api,db,seed,log}=removalSetup({conflict:true});const p=await seed();const review=await api.prepareRemoval(user,p.id);
 const result=await api.trash(user,p.id,p.version,review.sourceSha);
 assert.equal(result.status,'removing');assert.equal(result.html,p.html);assert.equal(log.filter(x=>x.method==='DELETE').length,1);
 assert((await db.doc(`editor_history/${p.id}-removed-${p.version}`).get()).data().publicSource.includes('Contenido público original'));
});
test('a public edit after the removal review still prevents deletion',async()=>{
 const {api,seed,state,log}=removalSetup({conflict:true});const p=await seed();const review=await api.prepareRemoval(user,p.id);state.file.sha='edited-after-review';
 await assert.rejects(api.trash(user,p.id,p.version,review.sourceSha),{status:409});
 assert.equal(log.filter(x=>x.method==='DELETE').length,0);assert.equal((await api.getPost(user,p.id)).html,p.html);
});
test('a source created after reviewing a missing article cannot be silently removed',async()=>{
 const {api,seed,state,log}=removalSetup({file:false});const p=await seed();const review=await api.prepareRemoval(user,p.id);assert.equal(review.missing,true);
 state.file={sha:'new-source',content:Buffer.from('A newly published article').toString('base64')};
 await assert.rejects(api.trash(user,p.id,p.version,review.sourceSha),{status:409});assert.equal(log.filter(x=>x.method==='DELETE').length,0);
});
