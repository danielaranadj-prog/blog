class DB{
  constructor(){this.data=new Map();this.lock=Promise.resolve();}
  doc(path){const db=this;return {path,id:path.split('/').at(-1),async get(){return db.snap(path);},async delete(){db.data.delete(path);},async set(value,options){db.data.set(path,options?.merge?{...db.data.get(path),...value}:value);},async update(value){if(!db.data.has(path))throw Error('missing');db.data.set(path,{...db.data.get(path),...value});}};}
  snap(path){const data=this.data.get(path);return {exists:!!data,id:path.split('/').at(-1),data:()=>data?structuredClone(data):undefined,ref:this.doc(path)};}
  collection(path){const db=this;const make=(filters=[],max=Infinity)=>({doc:id=>db.doc(`${path}/${id}`),where:(k,op,v)=>make([...filters,[k,op,v]],max),limit:n=>make(filters,n),async get(){const docs=[...db.data.keys()].filter(k=>k.startsWith(path+'/')&&k.split('/').length===path.split('/').length+1).map(k=>db.snap(k)).filter(s=>filters.every(([k,op,v])=>op==='=='?s.data()[k]===v:op==='in'?v.includes(s.data()[k]):op==='<'?s.data()[k]<v:s.data()[k]>=v)).slice(0,max);return {docs,size:docs.length,forEach:fn=>docs.forEach(fn)};}});return make();}
  async runTransaction(fn){const result=this.lock.then(()=>fn({get:r=>r.get(),set:(r,v,o)=>r.set(v,o),update:(r,v)=>r.update(v)}));this.lock=result.catch(()=>{});return result;}
}
module.exports={DB};
