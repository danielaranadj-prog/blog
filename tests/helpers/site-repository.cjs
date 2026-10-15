const crypto=require('node:crypto');
function repository(initial){
 const files=new Map(Object.entries(initial).map(([path,content])=>[path,{content,sha:crypto.createHash('sha1').update(content).digest('hex')}]));const blobs=new Map(),calls=[];let pendingTree=[],head='head0';
 const request=async(ep,method='GET',input)=>{calls.push({ep,method,input});
  if(ep.startsWith('/contents/')){const path=decodeURI(ep.split('?')[0].slice(10)),file=files.get(path);if(!file){const e=Error('missing');e.status=404;throw e;}return {sha:file.sha,content:Buffer.from(file.content).toString('base64')};}
  if(ep.startsWith('/git/ref/heads/'))return {object:{sha:head}};
  if(ep.startsWith('/git/commits/')&&method==='GET')return {tree:{sha:'tree0'}};
  if(ep==='/git/blobs'){const sha=crypto.createHash('sha1').update(input.content).digest('hex');blobs.set(sha,input.content);return {sha};}
  if(ep==='/git/trees'){pendingTree=input.tree;return {sha:'tree1'};}
  if(ep==='/git/commits'&&method==='POST')return {sha:'commit'+calls.length};
  if(ep.startsWith('/git/refs/heads/')&&method==='PATCH'){head=input.sha;for(const f of pendingTree){const content=f.content??Buffer.from(blobs.get(f.sha),'base64').toString();files.set(f.path,{content,sha:crypto.createHash('sha1').update(content).digest('hex')});}return {};}
  throw Error('Unexpected mock call '+method+' '+ep);
 };
 return {repository:{request,config:async()=>({branch:'main',path:'src/pages/posts'})},files,calls};
}
module.exports={repository};
