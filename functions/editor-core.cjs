const crypto = require('node:crypto');
const sanitizeHtml = require('sanitize-html');
const matter = require('gray-matter');
const { editorialFields } = require('./editorial-fields.cjs');
const SITE = 'https://www.instantetrips.com';
const statuses = new Set(['draft', 'scheduled', 'publishing', 'deploying', 'published', 'error', 'removing', 'removal_error', 'trashed']);
const safeId = id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id);
const slug = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 100) || 'historia';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
function fail(message, status = 400) { const e = new Error(message); e.status = status; throw e; }
function cleanHtml(html) {
  return sanitizeHtml(String(html || ''), {
    allowedTags: [...sanitizeHtml.defaults.allowedTags, 'img', 'figure', 'figcaption', 'iframe'],
    allowedAttributes: { ...sanitizeHtml.defaults.allowedAttributes, '*': ['class'], a: ['href', 'title', 'target', 'rel', 'class', 'data-catalog-id', 'data-catalog-format'], img: ['src', 'alt', 'title', 'width', 'height', 'data-media-id'], iframe: ['src', 'title', 'allowfullscreen', 'width', 'height'] },
    allowedIframeHostnames: ['www.youtube.com', 'www.youtube-nocookie.com', 'www.tiktok.com'],
    allowedSchemes: ['http', 'https'], allowProtocolRelative: false
  });
}
function normalizePost(input) {
  const text = (key, max) => String(input[key] || '').slice(0, max);
  const post = {
    ...editorialFields(input),
    title: text('title', 180), description: text('description', 320), html: cleanHtml(text('html', 600000)),
    markdown: text('markdown', 600000), date: text('date', 10), author: text('author', 100), hero: text('hero', 2000),
    quickSummary: Object.fromEntries(['budget','bestSeason','pitfall','ctaText','ctaLink'].map(k=>[k,String(input.quickSummary?.[k]||'').trim().slice(0,k==='ctaLink'?2000:240)])),
    heroAlt: text('heroAlt', 300), tags: Array.isArray(input.tags) ? input.tags.slice(0, 30).map(t => String(t).slice(0, 80)) : [],
    flightDestination: text('flightDestination', 100), tourCity: text('tourCity', 100),
    timezone: text('timezone', 100) || 'America/Mazatlan', reviewAt: text('reviewAt', 10),
    tripId: safeId(input.tripId) ? input.tripId : '',
    mediaIds: Array.isArray(input.mediaIds) ? [...new Set(input.mediaIds.filter(safeId))].slice(0, 30) : []
  };
  try { new Intl.DateTimeFormat('es', { timeZone: post.timezone }); } catch { fail('Zona horaria inválida.'); }
  if (post.date && !/^\d{4}-\d{2}-\d{2}$/.test(post.date)) fail('Fecha inválida.');
  if (Buffer.byteLength(JSON.stringify(post)) > 850000) fail('El artículo supera el tamaño permitido.');
  if (post.hero && !/^(https:\/\/|\/uploads\/|\/assets\/|media:)/.test(post.hero)) fail('La portada debe ser una imagen https o de la biblioteca.');
  if(post.quickSummary.ctaLink&&!/^(https:\/\/|\/(?!\/))[^\s\\]*$/.test(post.quickSummary.ctaLink))fail('Usa un enlace https o un recurso del sitio en el resumen.');
  return post;
}
function validate(post) {
  const errors = [];
  if (!post.title.trim()) errors.push('Escribe un título.');
  if (!post.description.trim()) errors.push('Añade una descripción.');
  if (!post.html.replace(/<[^>]+>/g, '').trim()) errors.push('Escribe el relato.');
  if (!post.hero) errors.push('Selecciona una portada.');
  if (!post.author) errors.push('Selecciona un autor.');
  if (/\[(?:Completar|Verificar|Añadir|Tu |Pendiente)[^\]]*\]/i.test(post.html)) errors.push('Completa los campos pendientes de la plantilla.');
  if (post.modifiedDate && post.modifiedDate < post.date) errors.push('La actualización no puede ser anterior a la publicación.');
  return errors;
}
function yaml(value) { return JSON.stringify(String(value || '')); }
function markdownFile(post, body, revision) {
  const lines = ['---', `title: ${yaml(post.title)}`, `description: ${yaml(post.description)}`, `publishDate: ${yaml(post.date)}`, `author: ${yaml(post.author)}`, `heroImage: ${yaml(post.hero)}`, `alt: ${yaml(post.heroAlt || post.title)}`, 'layout: "../../layouts/BlogPost.astro"', `tags: ${JSON.stringify(post.tags)}`, `editorRevision: ${yaml(revision)}`];
  for(const key of ['seoTitle','editorialType','destination','budgetLevel','modifiedDate']) if(post[key]) lines.push(`${key}: ${yaml(post[key])}`);
  if(post.quickSummary) lines.push(`quickSummary: ${JSON.stringify(post.quickSummary)}`);
  if (post.flightDestination) lines.push(`flight_destination: ${yaml(post.flightDestination)}`);
  if (post.tourCity) lines.push(`tour_city: ${yaml(post.tourCity)}`);
  return lines.join('\n') + '\n---\n\n' + body;
}
function service({ db, admin, bucket, fetcher = fetch, now = () => Date.now() }) {
  const posts = db.collection('editor_posts');
  async function connectionConfig() {
    const privateConfig=(await db.doc('server_config/main').get()).data();
    return privateConfig || (await db.doc('config/main').get()).data() || {};
  }
  async function secureConfig() {
    await db.runTransaction(async tx=>{
      const privateRef=db.doc('server_config/main'),publicRef=db.doc('config/main');
      const saved=(await tx.get(privateRef)).data(),legacy=(await tx.get(publicRef)).data();
      if(!legacy)return;
      if(!saved)tx.set(privateRef,legacy);
      if('githubToken' in legacy || 'geminiToken' in legacy){
        const safe={};for(const key of ['repoOwner','repoName','branch','postsPath'])if(legacy[key]!==undefined)safe[key]=legacy[key];
        tx.set(publicRef,safe);
      }
    });
    return {secured:true};
  }
  async function gh(ep, method = 'GET', body) {
    const cfg = await connectionConfig();
    const token = process.env.EDITOR_GITHUB_TOKEN || cfg.githubToken;
    if (!token || !/^[\w.-]+$/.test(cfg.repoOwner || '') || !/^[\w.-]+$/.test(cfg.repoName || '')) fail('Falta la conexión con GitHub.', 503);
    const res = await fetcher(`https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}${ep}`, { method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(20000) });
    if (!res.ok) fail(`GitHub no completó la operación (${res.status}).`, res.status === 404 ? 404 : res.status === 409 || res.status === 422 ? 409 : 502);
    return res.status === 204 ? {} : res.json();
  }
  async function config() {
    const c = await connectionConfig();
    const path = (c.postsPath || 'src/pages/posts/').replace(/\/+$/, '');
    if (path !== 'src/pages/posts') fail('La carpeta de artículos debe ser src/pages/posts.', 503);
    return { branch: c.branch || 'main', path };
  }
  async function authorized(decoded) {
    if (!decoded || !decoded.uid) fail('Inicia sesión.', 401);
    const emails = (process.env.EDITOR_ADMIN_EMAILS || 'danielaranadj@gmail.com').toLowerCase().split(',').map(s => s.trim());
    if (emails.includes(String(decoded.email || '').toLowerCase())) return { uid: decoded.uid, admin: true };
    const member = await db.doc(`editor_members/${decoded.uid}`).get();
    if (!member.exists || member.data().active !== true) fail('Esta cuenta no tiene acceso a la redacción.', 403);
    return { uid: decoded.uid, admin: member.data().role === 'admin' };
  }
  async function getPost(user, id) {
    if (!safeId(id)) fail('Artículo inválido.');
    const snap = await posts.doc(id).get();
    if (!snap.exists) fail('No se encontró el artículo.', 404);
    const data = { id: snap.id, ...snap.data() };
    if (!user.admin && data.owner !== user.uid) fail('No tienes acceso a este artículo.', 403);
    return data;
  }
  async function save(user, input, mode = 'draft') {
    const id = input.id || crypto.randomUUID();
    if (!safeId(id)) fail('Artículo inválido.');
    const post = normalizePost(input);
    const scheduler = (await db.doc('editor_system/scheduler').get()).data() || {};
    const scheduledAt = Number(input.scheduledAt);
    if (mode === 'scheduled') {
      if (!scheduler.lastHeartbeat || now() - scheduler.lastHeartbeat > 180000) fail('La publicación automática todavía no está activa. Puedes guardar un borrador.', 503);
      const errors = validate(post); if (errors.length) fail(errors.join('\n'));
      if (!Number.isFinite(scheduledAt) || scheduledAt < now() + 60000) fail('Elige una fecha al menos un minuto en el futuro.');
      const parts=new Intl.DateTimeFormat('en-CA',{timeZone:post.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date(scheduledAt));
      post.date=['year','month','day'].map(k=>parts.find(p=>p.type===k).value).join('-');
    }
    await db.runTransaction(async tx => {
      const ref = posts.doc(id), snap = await tx.get(ref), old = snap.data();
      if (old && !user.admin && old.owner !== user.uid) fail('Sin acceso.', 403);
      if (old && ['publishing', 'deploying', 'removing', 'removal_error', 'trashed'].includes(old.status)) fail('Espera a que termine la publicación.', 409);
      if (old && input.version !== old.version) fail('Hay una versión más reciente. Vuelve a abrir el artículo antes de guardar.', 409);
      if(old)for(const key of ['seoTitle','editorialType','destination','budgetLevel','focusQuestion','urlSlug','modifiedDate'])if(!(key in input))post[key]=old[key]||'';
      if(old?.filename && post.urlSlug && post.urlSlug !== (old.urlSlug||'')) fail('La dirección ya está publicada y no puede cambiarse desde el editor.',409);
      if(old?.filename) post.urlSlug=old.urlSlug||'';
      if(old)tx.set(db.doc(`editor_history/${id}-${old.version}`),{...old,postId:id,savedAt:now()});
      tx.set(ref, { ...post, owner: old?.owner || user.uid, status: mode, scheduledAt: mode === 'scheduled' ? scheduledAt : null, version: (old?.version || 0) + 1, createdAt: old?.createdAt || now(), updatedAt: now(), filename: old?.filename || '', sourceSha: old?.sourceSha || '', publishedUrl: old?.publishedUrl || '', error: '', attempts: 0, nextAttemptAt: 0 }, { merge: true });
    });
    return getPost(user, id);
  }
  async function list(user) {
    const q = user.admin ? posts : posts.where('owner', '==', user.uid);
    const snap = await q.limit(500).get();
    return snap.docs.map(s => { const { html, markdown, ...data } = s.data(); return { id: s.id, ...data }; }).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  async function mediaGet(user, id) {
    if (!safeId(id)) fail('Imagen inválida.');
    const snap = await db.doc(`editor_media/${id}`).get();
    if (!snap.exists) fail('Imagen no disponible.', 404);
    const m = snap.data();
    if (!user.admin && m.owner !== user.uid) fail('Sin acceso a esta imagen.', 403);
    const bytes = m.base64 ? Buffer.from(m.base64, 'base64') : (await bucket.file(m.storagePath).download())[0];
    return { ...m, bytes, id };
  }
  async function mediaSave(user, input) {
    const bytes = Buffer.from(String(input.base64 || ''), 'base64');
    const mime = bytes[0] === 0xff && bytes[1] === 0xd8 ? 'image/jpeg' : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' : bytes.subarray(0,4).toString() === 'RIFF' && bytes.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : '';
    if (!mime || bytes.length > 460000 || !bytes.length) fail('Utiliza JPG, PNG o WebP de hasta 450 KB.');
    const id = crypto.randomUUID();
    const metadata = { owner: user.uid, name: String(input.name || 'Foto').slice(0, 160), alt: String(input.alt || '').slice(0, 300), credit: String(input.credit || '').slice(0, 200), destination: String(input.destination || '').slice(0, 100), mime, size: bytes.length, createdAt: now(), storage: 'firestore' };
    // Compressed private images work on Spark. Storage is used when explicitly enabled.
    if (process.env.EDITOR_USE_STORAGE === 'true' && bucket) {
      const storagePath = `editor-private/${user.uid}/${id}`;
      await bucket.file(storagePath).save(bytes, { metadata: { contentType: mime }, resumable: false });
      await db.doc(`editor_media/${id}`).set({ ...metadata, storage: 'storage', storagePath });
    } else await db.doc(`editor_media/${id}`).set({ ...metadata, base64: bytes.toString('base64') });
    return { id, ...metadata };
  }
  async function mediaList(user) {
    const col = db.collection('editor_media');
    const snap = await (user.admin ? col : col.where('owner', '==', user.uid)).limit(250).get();
    return snap.docs.map(s => { const { base64, storagePath, ...data } = s.data(); return { id: s.id, ...data }; }).sort((a,b) => b.createdAt-a.createdAt);
  }
  async function publish(user, id, expectedVersion) {
    await getPost(user, id);
    const ref = posts.doc(id);
    let post;
    const claim = crypto.randomUUID();
    await db.runTransaction(async tx => {
      const snap = await tx.get(ref); post = snap.data();
      if (expectedVersion != null && expectedVersion !== post.version) fail('La versión cambió. Vuelve a abrir el artículo.', 409);
      if (['publishing', 'deploying', 'published', 'removing', 'removal_error', 'trashed'].includes(post.status)) fail('El artículo ya se está publicando o está publicado.', 409);
      const errors = validate(post); if (errors.length) fail(errors.join('\n'));
      tx.update(ref, { status: 'publishing', claim, leaseUntil: now()+600000, attempts: (post.attempts || 0)+1, updatedAt: now(), error: '' });
    });
    try {
      const cfg = await config();
      const revision = `${id}-${post.version}`;
      const filename = post.filename || `${post.urlSlug || slug(post.title)}.md`;
      const path = `${cfg.path}/${filename}`;
      let current;
      try { current = await gh(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(cfg.branch)}`); } catch(e) { if (e.status !== 404) throw e; }
      if (current && matter(Buffer.from(current.content || '', 'base64').toString()).data.editorRevision === revision) {
        await ref.update({ status:'deploying', filename, sourceSha:current.sha, revision, publishedUrl:`${SITE}/posts/${filename.slice(0,-3)}/`, updatedAt:now() });
        return getPost(user,id);
      }
      if (post.sourceSha && current?.sha !== post.sourceSha) fail('El artículo cambió en GitHub. Importa la versión reciente antes de actualizar.', 409);
      if (post.filename && current && !post.sourceSha) fail('Ya existe una versión en esta dirección. Recárgala antes de publicar.',409);
      if (!post.filename && current) fail('Ya existe otro artículo con esta dirección.', 409);
      const ids = new Set(post.mediaIds);
      for (const m of post.html.matchAll(/data-media-id="([\w-]+)"/g)) ids.add(m[1]);
      if (post.hero.startsWith('media:')) ids.add(post.hero.slice(6));
      const replacements = new Map();
      const tree = [];
      if(ids.size>30)fail('Usa hasta 30 fotografías por artículo.');
      const mediaQueue=[...ids];
      for(let offset=0;offset<mediaQueue.length;offset+=4) {
        await Promise.all(mediaQueue.slice(offset,offset+4).map(async mediaId=>{
          const media=await mediaGet(user,mediaId);
          const ext=media.mime==='image/png'?'png':media.mime==='image/webp'?'webp':'jpg';
          const target=`uploads/${mediaId}.${ext}`;
          const blob=await gh('/git/blobs','POST',{content:media.bytes.toString('base64'),encoding:'base64'});
          tree.push({path:`public/${target}`,mode:'100644',type:'blob',sha:blob.sha});
          replacements.set(mediaId,`/${target}`);
        }));
      }
      let body = cleanHtml(post.html);
      body = body.replace(/<img\b[^>]*>/g, tag => {
        const match = tag.match(/data-media-id="([\w-]+)"/);
        return match && replacements.has(match[1]) ? tag.replace(/\ssrc="[^"]*"/,'').replace('<img', `<img src="${replacements.get(match[1])}"`) : tag;
      });
      if (post.hero.startsWith('media:')) post.hero = replacements.get(post.hero.slice(6)) || '';
      const content = markdownFile(post,body,revision);
      tree.push({path, mode:'100644', type:'blob', content});
      // Atomic article + photos commit. Compare-and-swap branch update preserves concurrent commits.
      let commit;
      for (let attempt=0; attempt<3; attempt++) {
        if(attempt>0 && current) {
          const latest=await gh(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(cfg.branch)}`);
          if(latest.sha!==current.sha) fail('Otro editor actualizó este artículo. Vuelve a cargarlo.',409);
        }
        const head = await gh(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
        const parent = await gh(`/git/commits/${head.object.sha}`);
        const result = await gh('/git/trees','POST',{base_tree:parent.tree.sha,tree});
        commit = await gh('/git/commits','POST',{message:`Publish ${filename} [editor:${revision}]`,tree:result.sha,parents:[head.object.sha]});
        try { await gh(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`,'PATCH',{sha:commit.sha,force:false}); break; }
        catch(e) { if (e.status!==409 || attempt===2) throw e; }
      }
      await ref.update({status:'deploying',filename, revision, commitSha:commit.sha, publishedUrl:`${SITE}/posts/${filename.slice(0,-3)}/`, updatedAt:now(), leaseUntil:0 });
      return getPost(user,id);
    } catch(e) {
      await db.runTransaction(async tx => { const s = await tx.get(ref); if(s.data()?.claim===claim) tx.update(ref,{status:'error',error:e.message,updatedAt:now(),nextAttemptAt:post.scheduledAt && e.status!==409 ? now()+300000 : 0,leaseUntil:0}); });
      throw e;
    }
  }
  async function verify(user,id) {
    const p = await getPost(user,id);
    if(p.status!=='deploying') return p;
    const url = `${SITE}/posts/${encodeURIComponent(p.filename.slice(0,-3))}/`;
    const response = await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
    const text = response.ok ? await response.text() : '';
    if(text.includes(`name="editor-revision" content="${p.revision}"`)) {
      const cfg = await config();
      const file = await gh(`/contents/${encodeURI(`${cfg.path}/${p.filename}`)}?ref=${encodeURIComponent(cfg.branch)}`);
      await posts.doc(id).update({status:'published',publishedAt:now(),updatedAt:now(),sourceSha:file.sha,error:''});
    } else if(now()-p.updatedAt>1800000) await posts.doc(id).update({error:'La actualización sigue pendiente en Vercel. Revisa el despliegue.'});
    return getPost(user,id);
  }
  async function tick() {
    await db.doc('editor_system/scheduler').set({lastHeartbeat:now()}, {merge:true});
    const snap = await posts.where('status','in',['scheduled','publishing','deploying','error']).limit(100).get();
    const ordered=snap.docs.sort((a,b)=>(a.data().scheduledAt||0)-(b.data().scheduledAt||0));
    let publishedThisRun=0;
    for(const doc of ordered) {
      const p=doc.data(), user={uid:p.owner,admin:true};
      try {
        if(p.status==='deploying') await verify(user,doc.id);
        else if(p.status==='publishing' && p.leaseUntil<now()) await doc.ref.update({status:'error',error:'Se interrumpió la publicación. Se reintentará.',nextAttemptAt:now(),updatedAt:now()});
        else if(publishedThisRun<3 && ((p.status==='scheduled' && p.scheduledAt<=now()) || (p.status==='error' && p.nextAttemptAt && p.nextAttemptAt<=now() && p.attempts<5))) { publishedThisRun++; await publish(user,doc.id); }
      } catch(e) { console.error('editor-job',doc.id,e.message); }
    }
  }
  async function library(user,kind) {
    const c=db.collection(`editor_${kind}`);
    const snap=await (user.admin?c:c.where('owner','==',user.uid)).limit(300).get();
    return snap.docs.map(s=>({id:s.id,...s.data()})).filter(d=>!d.archived).sort((a,b)=>b.updatedAt-a.updatedAt);
  }
  async function saveItem(user,kind,input) {
    if(!['ideas','trips','questions'].includes(kind)) fail('Colección inválida.');
    const id=input.id || crypto.randomUUID(); if(!safeId(id)) fail('Ficha inválida.');
    const ref=db.doc(`editor_${kind}/${id}`), old=(await ref.get()).data();
    if(old && !user.admin && old.owner!==user.uid) fail('Sin acceso.',403);
    const data={owner:old?.owner||user.uid,title:String(input.title||'').slice(0,200),notes:String(input.notes||'').slice(0,80000),destination:String(input.destination||'').slice(0,150),date:String(input.date||'').slice(0,10),budget:String(input.budget||'').slice(0,200),links:String(input.links||'').slice(0,5000),updatedAt:now(),archived:input.archived===true};
    await ref.set(data,{merge:true}); return {id,...data};
  }
  async function importPosts(user) {
    if(!user.admin) fail('Solo el administrador puede sincronizar el sitio.',403);
    const cfg=await config(), files=await gh(`/contents/${cfg.path}?ref=${encodeURIComponent(cfg.branch)}`);
    const existing=(await posts.get()).docs.map(d=>d.data().filename);
    let count=0;
    for(const file of files.filter(f=>f.name.endsWith('.md')&&!existing.includes(f.name))) {
      const raw=await gh(`/contents/${encodeURI(`${cfg.path}/${file.name}`)}?ref=${encodeURIComponent(cfg.branch)}`);
      const parsed=matter(Buffer.from(raw.content,'base64').toString()); const f=parsed.data;
      const id=`import-${hash(file.name).slice(0,24)}`;
      await posts.doc(id).set({owner:user.uid,...editorialFields(f),quickSummary:f.quickSummary||{},title:String(f.title||file.name),description:String(f.description||''),date:f.publishDate instanceof Date?f.publishDate.toISOString().slice(0,10):String(f.publishDate||'').slice(0,10),author:String(f.author||''),hero:String(f.heroImage||f.heroImageLink||''),heroAlt:String(f.alt||''),tags:Array.isArray(f.tags)?f.tags:[],html:'',markdown:parsed.content,filename:file.name,sourceSha:raw.sha,version:1,status:'published',createdAt:now(),updatedAt:now(),publishedUrl:`${SITE}/posts/${file.name.slice(0,-3)}/`,mediaIds:[],timezone:'America/Mazatlan',flightDestination:f.flight_destination||'',tourCity:f.tour_city||'',reviewAt:'',scheduledAt:null}); count++;
    }
    return {count};
  }
  async function archive(user,id,archived) {
    await getPost(user,id);
    await db.runTransaction(async tx=>{
      const ref=posts.doc(id),snap=await tx.get(ref),p=snap.data();
      if(['publishing','deploying','removing','removal_error','trashed'].includes(p.status))fail('Espera a que termine la publicación.',409);
      tx.update(ref,{archived:archived===true,status:p.status==='scheduled'?'draft':p.status,scheduledAt:p.status==='scheduled'?null:p.scheduledAt||null,updatedAt:now(),version:p.version+1});
    });
    return getPost(user,id);
  }
  async function reloadPublished(user,id) {
    const p=await getPost(user,id);if(!p.filename)fail('Este borrador todavía no tiene versión publicada.');
    const cfg=await config(),raw=await gh(`/contents/${encodeURI(`${cfg.path}/${p.filename}`)}?ref=${encodeURIComponent(cfg.branch)}`);
    const parsed=matter(Buffer.from(raw.content,'base64').toString()),f=parsed.data;
    const updated=normalizePost({...p,...editorialFields(f),urlSlug:p.urlSlug||'',focusQuestion:p.focusQuestion||'',quickSummary:f.quickSummary||{},title:f.title,description:f.description,date:f.publishDate instanceof Date?f.publishDate.toISOString().slice(0,10):String(f.publishDate||'').slice(0,10),author:f.author,hero:f.heroImage||f.heroImageLink,heroAlt:f.alt||'',tags:f.tags||[],html:'',markdown:parsed.content,flightDestination:f.flight_destination||'',tourCity:f.tour_city||''});
    await db.runTransaction(async tx=>{
      const ref=posts.doc(id),current=await tx.get(ref);
      if(current.data().version!==p.version||['publishing','deploying','removing','trashed'].includes(current.data().status))fail('La ficha cambió; vuelve a abrirla.',409);
      tx.set(db.doc(`editor_history/${id}-${p.version}`),p);
      tx.update(ref,{...updated,status:'published',sourceSha:raw.sha,version:p.version+1,updatedAt:now(),error:'',scheduledAt:null});
    });
    return getPost(user,id);
  }
  // Removal keeps the private article and Git history; only its public source is removed.
  async function trash(user,id,expectedVersion) {
    if(!user.admin) fail('Solo el administrador puede eliminar artículos.',403);
    await getPost(user,id);
    const ref=posts.doc(id);let p;
    await db.runTransaction(async tx=>{
      p=(await tx.get(ref)).data();
      if(expectedVersion!==p.version)fail('La ficha cambió. Actualiza la lista antes de eliminar.',409);
      if(['publishing','deploying','trashed'].includes(p.status)||(p.status==='removing'&&(p.removalReady||now()-p.updatedAt<600000)))fail('Espera a que termine la operación actual.',409);
      if(p.filename && !/^[^/\\?#%\x00-\x1f]+\.md$/.test(p.filename))fail('La ruta del artículo no es válida.');
      tx.update(ref,{status:'removing',scheduledAt:null,nextAttemptAt:0,version:p.version+1,updatedAt:now(),error:'',removalReady:false});
    });
    try {
      if(p.filename) {
        const cfg=await config(),ep=`/contents/${cfg.path}/${encodeURIComponent(p.filename)}`;
        let file;
        try {file=await gh(`${ep}?ref=${encodeURIComponent(cfg.branch)}`);}catch(e){if(e.status!==404)throw e;}
        if(file) {
          if(!p.sourceSha || file.sha!==p.sourceSha)fail('El artículo cambió en GitHub. Recarga la versión publicada antes de eliminarlo.',409);
          // Preserve the exact public Markdown as well as the current private working copy.
          await db.doc(`editor_history/${id}-removed-${p.version}`).set({publicSource:Buffer.from(file.content,'base64').toString(),filename:p.filename,removedBy:user.uid,removedAt:now()});
          const result=await gh(ep,'DELETE',{message:`Remove article ${p.filename} [editor:${id}]`,sha:file.sha,branch:cfg.branch});
          await ref.update({removalCommit:result.commit?.sha||''});
        }
        await ref.update({removalReady:true,removedAt:now(),updatedAt:now(),error:''});
      } else await ref.update({status:'trashed',removedAt:now(),updatedAt:now(),archived:false});
      return getPost(user,id);
    }catch(e){await ref.update({status:'removal_error',error:e.message,updatedAt:now()});throw e;}
  }
  async function verifyRemoval(user,id) {
    const p=await getPost(user,id);
    if(p.status!=='removing'||!p.removalReady)return p;
    const response=await fetcher(`${SITE}/posts/${encodeURIComponent(p.filename.slice(0,-3))}/`,{redirect:'error',signal:AbortSignal.timeout(15000),headers:{'Cache-Control':'no-cache'}});
    if(response.status===404) {
      await db.runTransaction(async tx=>{
        const ref=posts.doc(id),current=(await tx.get(ref)).data();
        if(current.status==='removing'&&current.version===p.version)tx.update(ref,{status:'trashed',archived:false,sourceSha:'',publishedUrl:'',updatedAt:now(),error:''});
      });
    } else if(now()-p.updatedAt>1800000)await posts.doc(id).update({error:'La retirada sigue pendiente. Comprueba la actualización de la web.'});
    return getPost(user,id);
  }
  async function restore(user,id,expectedVersion) {
    if(!user.admin)fail('Solo el administrador puede restaurar artículos.',403);
    await getPost(user,id);
    await db.runTransaction(async tx=>{
      const ref=posts.doc(id),p=(await tx.get(ref)).data();
      if(p.status!=='trashed'||p.version!==expectedVersion)fail('Actualiza la papelera antes de restaurar.',409);
      tx.update(ref,{status:'draft',archived:false,sourceSha:'',scheduledAt:null,nextAttemptAt:0,version:p.version+1,updatedAt:now(),error:'',removalReady:false});
    });
    return getPost(user,id);
  }
  async function history(user,id){await getPost(user,id);const docs=(await db.collection('editor_history').where('postId','==',id).limit(100).get()).docs;return docs.map(d=>({id:d.id,version:d.data().version,title:d.data().title,savedAt:d.data().savedAt||d.data().updatedAt})).sort((a,b)=>b.version-a.version);}
  async function restoreVersion(user,id,version,currentVersion){const current=await getPost(user,id);if(current.version!==currentVersion)fail('La ficha cambió. Recarga antes de recuperar.',409);const snapshot=(await db.doc(`editor_history/${id}-${Number(version)}`).get()).data();if(!snapshot||snapshot.postId!==id)fail('No se encontró esa versión.',404);return save(user,{...snapshot,id,version:currentVersion},'draft');}
  async function stats(user) {
    if(!user.admin) fail('Solo el administrador puede ver resultados.',403);
    const day=new Date(now()-29*86400000).toISOString().slice(0,10);
    const snap=await db.collection('analytics_daily').where('day','>=',day).limit(5000).get();
    const totals={},targets={};let views=0,clicks=0;
    snap.forEach(d=>{const e=d.data(),count=Number(e.count)||0;if(e.type==='page_view'){views+=count;totals[e.path]=(totals[e.path]||0)+count;}else {clicks+=count;if(e.target)targets[e.target]=(targets[e.target]||0)+count;}});
    return {views,clicks,sampled:snap.size===5000,days:30,version:2,pages:Object.entries(totals).sort((a,b)=>b[1]-a[1]).slice(0,20).map(([path,views])=>({path,views})),targets:Object.entries(targets).sort((a,b)=>b[1]-a[1]).map(([id,clicks])=>({id,clicks}))};
  }
  return {authorized,save,list,getPost,publish,verify,tick,mediaSave,mediaGet,mediaList,library,saveItem,importPosts,stats,archive,reloadPublished,trash,restore,verifyRemoval,history,restoreVersion,repository:{request:gh,config,secureConfig}};
}
module.exports={service,normalizePost,validate,markdownFile,cleanHtml,slug,safeId};
