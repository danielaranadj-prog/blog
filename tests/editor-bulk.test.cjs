const {test}=require('node:test'),assert=require('node:assert/strict');
const {service}=require('../functions/editor-core.cjs');const {DB}=require('./helpers/memory-db.cjs');
const user={uid:'owner',admin:true};
async function setup(count=5){
 const db=new DB(),files=new Map(),log=[];let moved=false,refConflict=false,commits=0;
 const api=service({db,now:()=>1000000,fetcher:async(url,options={})=>{
  const method=options.method||'GET',body=options.body?JSON.parse(options.body):null;log.push({url,method,body});
  const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data,text:async()=>''});
  if(url.startsWith('https://www.instantetrips.com/'))return response({},moved?404:200);
  const ep=new URL(url).pathname.replace('/repos/o/r','');
  if(ep.startsWith('/contents/')){const name=decodeURIComponent(ep.split('/').at(-1));return files.has(name)?response(files.get(name)):response({},404);}
  if(ep==='/git/ref/heads/main')return response({object:{sha:'base-head'}});
  if(ep==='/git/commits/base-head')return response({tree:{sha:'base-tree'}});
  if(ep==='/git/trees'){assert.equal(body.base_tree,'base-tree');return response({sha:'next-tree'});}
  if(ep==='/git/commits'&&method==='POST'){commits++;assert.deepEqual(body.parents,['base-head']);return response({sha:'next-commit'});}
  if(ep==='/git/refs/heads/main'&&method==='PATCH'){
   assert.equal(body.force,false);if(refConflict)return response({},422);moved=true;
   const tree=log.find(x=>x.method==='POST'&&x.url.endsWith('/git/trees')).body.tree;tree.forEach(x=>files.delete(x.path.split('/').at(-1)));return response({object:{sha:'next-commit'}});
  }
  throw Error('Unexpected request: '+ep);
 }});
 await db.doc('config/main').set({repoOwner:'o',repoName:'r',githubToken:'fake-test-only',branch:'main'});
 const posts=[];
 for(let i=0;i<count;i++){
  const p=await api.save(user,{title:'Artículo '+i,description:'Descripción',html:'<p>Trabajo privado '+i+'</p>',author:'daniel',hero:'/uploads/a.jpg'});
  const filename='article-'+i+'.md',sha='sha-'+i;files.set(filename,{sha,content:Buffer.from('---\ntitle: Public '+i+'\n---\nOriginal '+i).toString('base64')});
  await db.doc('editor_posts/'+p.id).update({status:'published',filename,sourceSha:sha,publishedUrl:'https://www.instantetrips.com/posts/article-'+i+'/'});posts.push(await api.getPost(user,p.id));
 }
 const review=()=>api.prepareRemovals(user,posts.map(p=>p.id));
 return {db,api,posts,files,log,review,setRefConflict:()=>refConflict=true,get commits(){return commits;}};
}
test('five reviewed articles are removed by one tree, one commit and one branch update',async()=>{
 const s=await setup();const reviewed=await s.review();const result=await s.api.trashMany(user,reviewed);
 assert.equal(result.publicCount,5);assert.equal(result.commitSha,'next-commit');assert.equal(s.commits,1);
 assert.equal(s.log.filter(r=>r.method==='PATCH').length,1);assert.equal(s.log.filter(r=>r.method==='DELETE').length,0);
 const tree=s.log.find(r=>r.url.endsWith('/git/trees')).body.tree;assert.equal(tree.length,5);assert(tree.every(e=>e.sha===null));
 for(const p of s.posts){const current=await s.api.getPost(user,p.id);assert.equal(current.status,'removing');assert.equal(current.html,p.html);assert.equal(current.removalCommit,'next-commit');assert((await s.db.doc(`editor_history/${p.id}-removed-${p.version}`).get()).data().publicSource.includes('Original'));assert.equal((await s.api.verifyRemoval(user,p.id)).status,'trashed');}
});
test('one public edit blocks the entire group before any Git write or private status change',async()=>{
 const s=await setup();const reviewed=await s.review();s.files.get('article-2.md').sha='changed';
 await assert.rejects(s.api.trashMany(user,reviewed),{status:409});assert.equal(s.log.filter(r=>r.method!=='GET').length,0);
 for(const p of s.posts)assert.equal((await s.api.getPost(user,p.id)).status,'published');
});
test('a stale private version blocks all selected articles before any Git write',async()=>{
 const s=await setup();const reviewed=await s.review();await s.db.doc('editor_posts/'+s.posts[1].id).update({version:2});
 await assert.rejects(s.api.trashMany(user,reviewed),{status:409});assert.equal(s.log.filter(r=>r.method!=='GET').length,0);assert.equal((await s.api.getPost(user,s.posts[0].id)).status,'published');
});
test('a concurrent branch update cannot be overwritten and retains the private work',async()=>{
 const s=await setup(2);const reviewed=await s.review();s.setRefConflict();await assert.rejects(s.api.trashMany(user,reviewed),{status:409});
 assert.equal(s.files.size,2);for(const p of s.posts){const current=await s.api.getPost(user,p.id);assert.equal(current.html,p.html);assert.equal(current.status,'removal_error');}
});
test('duplicate paths and oversized, duplicate or unauthorized selections never write to GitHub',async()=>{
 const s=await setup(2);const reviewed=await s.review();await assert.rejects(s.api.trashMany({uid:'owner',admin:false},reviewed),{status:403});
 await assert.rejects(s.api.trashMany(user,[reviewed[0],reviewed[0]]),{status:400});await assert.rejects(s.api.prepareRemovals(user,Array.from({length:21},(_,i)=>'id'+i)),{status:400});
 await s.db.doc('editor_posts/'+s.posts[1].id).update({filename:s.posts[0].filename});const next=await s.review();await assert.rejects(s.api.trashMany(user,next),{status:400});assert.equal(s.log.filter(r=>r.method!=='GET').length,0);
});
test('already absent public files and private drafts need no Git commit and retries do not redeploy',async()=>{
 const s=await setup(2);const reviewed=await s.review();await s.api.trashMany(user,reviewed);
 const retry=await s.review();for(const p of s.posts)await s.db.doc('editor_posts/'+p.id).update({status:'removal_error'});
 await s.api.trashMany(user,retry);assert.equal(s.commits,1);
 const privatePost=await s.api.save(user,{title:'Privado'});const before=s.log.length;await s.api.trashMany(user,[{id:privatePost.id,version:privatePost.version,sourceSha:''}]);assert.equal(s.log.length,before);assert.equal((await s.api.getPost(user,privatePost.id)).status,'trashed');
});
test('notes are recoverably deleted together, hidden from their library and cannot be edited until restored',async()=>{
 const s=await setup(0);const a=await s.api.saveItem(user,'ideas',{title:'A',notes:'Notas A'}),b=await s.api.saveItem(user,'ideas',{title:'B',notes:'Notas B'});
 await s.api.trashItems(user,'ideas',[a,b]);assert.deepEqual(await s.api.library(user,'ideas'),[]);const trashed=await s.api.trashedItems(user);assert.equal(trashed.length,2);
 await assert.rejects(s.api.saveItem(user,'ideas',{...a,title:'Overwrite'}),{status:409});
 await s.api.restoreItems(user,'ideas',trashed);const restored=await s.api.library(user,'ideas');assert.equal(restored.length,2);assert(restored.some(p=>p.notes==='Notas A'));assert.equal(s.log.length,0);
});
test('one stale note or a note owned by another author prevents a partial deletion',async()=>{
 const s=await setup(0);const a=await s.api.saveItem(user,'trips',{title:'A'}),b=await s.api.saveItem(user,'trips',{title:'B'});
 await assert.rejects(s.api.trashItems(user,'trips',[a,{...b,version:0}]),{status:409});assert.equal((await s.api.library(user,'trips')).length,2);
 await assert.rejects(s.api.trashItems({uid:'other',admin:false},'trips',[a]),{status:403});assert.equal((await s.api.library(user,'trips')).length,2);
});
test('several posts restore as private drafts and reviews update together without publishing',async()=>{
 const s=await setup(2);for(const p of s.posts)await s.db.doc('editor_posts/'+p.id).update({status:'trashed'});
 await s.api.restoreMany(user,s.posts);const restored=await Promise.all(s.posts.map(p=>s.api.getPost(user,p.id)));assert(restored.every(p=>p.status==='draft'&&!p.sourceSha));
 await s.api.reviewMany(user,restored,'2026-12-01');assert.equal((await s.api.getPost(user,s.posts[0].id)).reviewAt,'2026-12-01');
 await assert.rejects(s.api.reviewMany(user,restored,'2026-02-31'),{status:400});assert.equal(s.log.length,0);
});

test('the trash restores a mixed selection of notes and articles in one transaction',async()=>{
 const s=await setup(1);const post=s.posts[0];await s.db.doc('editor_posts/'+post.id).update({status:'trashed'});
 const note=await s.api.saveItem(user,'ideas',{title:'Nota recuperable',notes:'Conservar'});await s.api.trashItems(user,'ideas',[note]);const [trashed]=await s.api.trashedItems(user);
 await assert.rejects(s.api.restoreMany(user,[post,{...trashed,version:0}]),{status:409});assert.equal((await s.api.getPost(user,post.id)).status,'trashed');
 await s.api.restoreMany(user,[post,trashed]);assert.equal((await s.api.getPost(user,post.id)).status,'draft');assert.equal((await s.api.library(user,'ideas'))[0].notes,'Conservar');assert.equal(s.log.length,0);
});
