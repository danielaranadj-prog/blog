const crypto=require('node:crypto');

function bulkService({db,getPost,prepareRemoval,config,gh,now,fail,safeId}) {
  const kinds=['ideas','trips','questions'];
  function selection(entries) {
    if(!Array.isArray(entries)||!entries.length||entries.length>20)fail('Selecciona entre 1 y 20 elementos.');
    if(entries.some(e=>!e||!safeId(e.id))||new Set(entries.map(e=>e.id)).size!==entries.length)fail('Selección inválida.');
    return entries;
  }
  function admin(user){if(!user.admin)fail('Solo el administrador puede gestionar artículos en grupo.',403);}
  async function prepareRemovals(user,ids) {
    admin(user);selection(Array.isArray(ids)?ids.map(id=>({id})):ids);
    return Promise.all(ids.map(id=>prepareRemoval(user,id)));
  }
  async function trashMany(user,entries) {
    admin(user);selection(entries);
    const articles=await Promise.all(entries.map(e=>getPost(user,e.id)));
    const publicArticles=articles.filter(p=>p.filename);
    let cfg,head,commit,files=[];
    if(publicArticles.length){
      cfg=await config();head=await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
      commit=await gh(`/git/commits/${head.object.sha}`);
      files=await Promise.all(publicArticles.map(async p=>{
        if(!/^[^/\\?#%\x00-\x1f]+\.md$/.test(p.filename))fail('Ruta de artículo inválida.');
        const expected=entries.find(e=>e.id===p.id);let file;
        try{file=await gh(`/contents/${cfg.path}/${encodeURIComponent(p.filename)}?ref=${head.object.sha}`);}catch(e){if(e.status!==404)throw e;}
        if(file&&(!expected.sourceSha||file.sha!==expected.sourceSha))fail(`“${p.title}” cambió. Revisa de nuevo la selección; no se retiró ningún artículo.`,409);
        return {p,file,path:`${cfg.path}/${p.filename}`};
      }));
      if(new Set(files.map(f=>f.path)).size!==files.length)fail('Hay fichas duplicadas del mismo artículo. Selecciona una por artículo.');
    }
    await db.runTransaction(async tx=>{
      const current=await Promise.all(articles.map(p=>tx.get(db.doc(`editor_posts/${p.id}`))));
      current.forEach((snap,i)=>{
        const p=snap.data(),e=entries[i];
        if(!p||p.version!==e.version||p.filename!==articles[i].filename)fail('Una ficha cambió. Actualiza la lista antes de retirar.',409);
        if(['publishing','deploying','trashed'].includes(p.status)||(p.status==='removing'&&(p.removalReady||now()-p.updatedAt<600000)))fail('Uno de los artículos tiene una operación en curso.',409);
      });
      current.forEach((snap,i)=>tx.update(snap.ref,{status:'removing',version:entries[i].version+1,scheduledAt:null,nextAttemptAt:0,removalReady:false,updatedAt:now(),error:''}));
    });
    let commitSha='';
    try{
      const deleted=files.filter(f=>f.file);
      await Promise.all(deleted.map(({p,file})=>db.doc(`editor_history/${p.id}-removed-${p.version}`).set({publicSource:Buffer.from(file.content,'base64').toString(),filename:p.filename,removedBy:user.uid,removedAt:now()})));
      if(deleted.length){
        const tree=await gh('/git/trees','POST',{base_tree:commit.tree.sha,tree:deleted.map(f=>({path:f.path,mode:'100644',type:'blob',sha:null}))});
        const next=await gh('/git/commits','POST',{message:`Remove ${deleted.length} articles from editor [batch:${crypto.randomUUID()}]`,tree:tree.sha,parents:[head.object.sha]});
        // A concurrent branch update cannot be overwritten: GitHub rejects a non-fast-forward.
        try{await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`,'PATCH',{sha:next.sha,force:false});}
        catch(error){if(error.status===409)fail('La web cambió durante la confirmación. Cierra este aviso y revisa otra vez la selección; no se retiró ningún artículo.',409);throw error;}
        commitSha=next.sha;
      }
      await Promise.all(articles.map(p=>db.doc(`editor_posts/${p.id}`).update(p.filename
        ?{removalReady:true,removalCommit:commitSha,removedAt:now(),updatedAt:now(),error:''}
        :{status:'trashed',archived:false,removedAt:now(),updatedAt:now(),error:''})));
      return {count:articles.length,publicCount:deleted.length,commitSha};
    }catch(error){
      await db.runTransaction(async tx=>{
        const current=await Promise.all(articles.map(p=>tx.get(db.doc(`editor_posts/${p.id}`))));
        current.forEach((snap,i)=>{const p=snap.data();if(p?.status==='removing'&&p.version===entries[i].version+1)tx.update(snap.ref,{status:'removal_error',error:error.message,updatedAt:now()});});
      });
      throw error;
    }
  }
  async function restoreMany(user,entries){
    admin(user);selection(entries);
    await db.runTransaction(async tx=>{
      if(entries.some(e=>e.kind&&!kinds.includes(e.kind)))fail('Tipo de nota inválido.');
      const docs=await Promise.all(entries.map(e=>tx.get(db.doc(`editor_${e.kind||'posts'}/${e.id}`))));
      docs.forEach((s,i)=>{const p=s.data(),e=entries[i];if(!p||(e.kind?!p.trashed:p.status!=='trashed')||(p.version||0)!==e.version)fail('La papelera cambió. Actualízala antes de restaurar.',409);});
      docs.forEach((s,i)=>tx.update(s.ref,entries[i].kind
        ?{trashed:false,archived:false,deletedAt:null,version:(s.data().version||0)+1,updatedAt:now()}
        :{status:'draft',archived:false,sourceSha:'',scheduledAt:null,nextAttemptAt:0,version:s.data().version+1,updatedAt:now(),error:'',removalReady:false}));
    });return {count:entries.length};
  }
  async function notes(user,kind,entries,restore=false){
    if(!kinds.includes(kind))fail('Colección inválida.');selection(entries);
    await db.runTransaction(async tx=>{
      const docs=await Promise.all(entries.map(e=>tx.get(db.doc(`editor_${kind}/${e.id}`))));
      docs.forEach((s,i)=>{
        const p=s.data();if(!p)fail('No se encontró una nota.',404);
        if(!user.admin&&p.owner!==user.uid)fail('No tienes acceso a esa nota.',403);
        if((p.version||0)!==entries[i].version||!!p.trashed!==restore)fail('Una nota cambió. Actualiza la sección antes de continuar.',409);
      });
      docs.forEach(s=>tx.update(s.ref,{trashed:!restore,archived:false,deletedAt:restore?null:now(),updatedAt:now(),version:(s.data().version||0)+1}));
    });return {count:entries.length};
  }
  async function trashedItems(user){
    const groups=await Promise.all(kinds.map(async kind=>{
      const collection=db.collection(`editor_${kind}`);const docs=await (user.admin?collection:collection.where('owner','==',user.uid)).limit(300).get();
      return docs.docs.filter(d=>d.data().trashed).map(d=>({id:d.id,...d.data(),kind}));
    }));return groups.flat();
  }
  async function reviewMany(user,entries,reviewAt){
    selection(entries);if(!/^\d{4}-\d{2}-\d{2}$/.test(reviewAt||'')||Number.isNaN(Date.parse(reviewAt))||new Date(reviewAt).toISOString().slice(0,10)!==reviewAt)fail('Selecciona una fecha de revisión válida.');
    await db.runTransaction(async tx=>{
      const docs=await Promise.all(entries.map(e=>tx.get(db.doc(`editor_posts/${e.id}`))));
      docs.forEach((s,i)=>{const p=s.data();if(!p||(!user.admin&&p.owner!==user.uid))fail('No tienes acceso a uno de los artículos.',403);if(p.version!==entries[i].version||['trashed','removing','removal_error','publishing','deploying'].includes(p.status))fail('Una ficha cambió. Actualiza la lista.',409);});
      docs.forEach(s=>tx.update(s.ref,{reviewAt,lastReviewedAt:now(),updatedAt:now(),version:s.data().version+1}));
    });return {count:entries.length};
  }
  return {prepareRemovals,trashMany,restoreMany,trashItems:(u,k,e)=>notes(u,k,e),restoreItems:(u,k,e)=>notes(u,k,e,true),trashedItems,reviewMany};
}
module.exports={bulkService};
