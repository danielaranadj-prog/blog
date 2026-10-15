const crypto=require('node:crypto');
const sharp=require('sharp');
const acorn=require('acorn');
const {infoPagesService}=require('./info-pages.cjs');
const DEFAULT=require('../src/data/site-settings.json');
const SETTINGS='src/data/site-settings.json';
const hash=x=>crypto.createHash('sha256').update(x).digest('hex').slice(0,20);
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function safeUrl(raw,optional=true){
 const value=String(raw||'').trim();if(!value&&optional)return '';
 if(/^\/(?!\/)[^\s\\]*$/.test(value))return value;
 if(/^mailto:[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(value))return value;
 try{const u=new URL(value);if(u.protocol==='https:'&&!u.username&&!u.password)return u.href;}catch{}
 fail('Usa una ruta del sitio, un correo mailto: o un enlace https válido.');
}
function validateSettings(input){
 const text=(key,max,required=false)=>{const s=String(input[key]||'').trim();if(s.length>max||required&&!s)fail(`Revisa el campo ${key}.`);return s;};
 const value={revision:DEFAULT.revision,name:text('name',100,true),shortName:text('shortName',30,true),brandTitle:text('brandTitle',40,true),brandSubtitle:text('brandSubtitle',60),description:text('description',320,true),homeTitle:text('homeTitle',160,true),tagline:text('tagline',180),footerText:text('footerText',600),copyrightName:text('copyrightName',150),contactEmail:text('contactEmail',150),themeColor:text('themeColor',7),backgroundColor:text('backgroundColor',7)};
 if(value.contactEmail&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.contactEmail))fail('El correo de contacto no es válido.');
 for(const c of ['themeColor','backgroundColor'])if(!/^#[a-f\d]{6}$/i.test(value[c]))fail('Selecciona un color válido.');
 value.assets={};for(const key of Object.keys(DEFAULT.assets)){const u=safeUrl(input.assets?.[key]);if(u&&!/^\/(?!\/)/.test(u)&&!u.startsWith('https:'))fail('Usa una imagen local o https.');value.assets[key]=u;}
 for(const name of ['navigation','footerLinks']){if(!Array.isArray(input[name])||input[name].length>8)fail('Usa hasta 8 enlaces por menú.');value[name]=input[name].map(link=>({label:String(link.label||'').trim().slice(0,70),url:safeUrl(link.url,false),enabled:link.enabled===true}));if(value[name].some(l=>!l.label))fail('Cada enlace necesita un texto.');}
 value.social={};for(const key of Object.keys(DEFAULT.social)){const url=safeUrl(input.social?.[key]);if(url&&!url.startsWith('https:'))fail('Las redes sociales necesitan un enlace https.');value.social[key]=url;}
 const ads=input.ads||{};value.ads={enabled:ads.enabled===true,publisherId:String(ads.publisherId||'').trim()};
 if(value.ads.publisherId&&!/^ca-pub-\d{16}$/.test(value.ads.publisherId))fail('El identificador AdSense debe tener formato ca-pub- y 16 dígitos.');
 for(const name of ['homeSlot','articleSlot','sidebarSlot']){value.ads[name]=String(ads[name]||'').trim();if(value.ads[name]&&!/^\d{6,20}$/.test(value.ads[name]))fail('El identificador de cada bloque debe contener solo números.');}
 if(value.ads.enabled&&(!value.ads.publisherId||!['homeSlot','articleSlot','sidebarSlot'].some(k=>value.ads[k])))fail('Añade el editor y al menos un bloque antes de activar AdSense.');
 const sponsor=input.sponsor||{};value.sponsor={confirmed:sponsor.confirmed===true,enabled:sponsor.enabled===true,title:String(sponsor.title||'').slice(0,180),text:String(sponsor.text||'').slice(0,600),button:String(sponsor.button||'').slice(0,80),url:safeUrl(sponsor.url)};
 if(value.sponsor.enabled&&!value.sponsor.confirmed)fail('Confirma las condiciones y el enlace de la tarjeta patrocinada.');
 if(value.sponsor.enabled&&(!value.sponsor.title||!value.sponsor.button||!value.sponsor.url?.startsWith('https:')))fail('Completa el título, botón y enlace https de la tarjeta patrocinada.');
 value.catalog=(Array.isArray(input.catalog)?input.catalog:[]).slice(0,100).map(item=>{
  const id=String(item.id||'');if(!/^[a-z0-9-]{1,80}$/.test(id))fail('Cada recomendación necesita un identificador válido.');
  const type=item.type==='download'?'download':'affiliate',url=safeUrl(item.url),enabled=item.enabled===true,confirmed=item.confirmed===true;
  const title=String(item.title||'').trim().slice(0,180),provider=String(item.provider||'').slice(0,100);
  if(enabled&&(!title||!url||!confirmed))fail('Para activar una recomendación completa su título, enlace y confirmación.');
  if(url&&!/^(https:\/\/|\/downloads\/)/.test(url))fail('Usa https o un PDF subido al sitio.');
  return {id,type,title,url,provider,partnerId:String(item.partnerId||'').slice(0,150),text:String(item.text||'').slice(0,600),button:String(item.button||'').slice(0,100),tags:String(item.tags||'').slice(0,300),placement:item.placement==='manual'?'manual':'sidebar',enabled,confirmed};
 });
 if(new Set(value.catalog.map(x=>x.id)).size!==value.catalog.length)fail('Los identificadores del catálogo no pueden repetirse.');
 const audience=input.audience||{};value.audience={newsletterUrl:safeUrl(audience.newsletterUrl),newsletterTitle:String(audience.newsletterTitle||'Recibe las próximas historias').slice(0,180),newsletterText:String(audience.newsletterText||'').slice(0,400)};
 if(value.audience.newsletterUrl&&!value.audience.newsletterUrl.startsWith('https:'))fail('Usa el enlace https de tu formulario de suscripción.');
 return value;
}
function manifest(s){return {id:'/',name:s.name,short_name:s.shortName,description:s.description,start_url:'/',scope:'/',display:'standalone',background_color:s.backgroundColor,theme_color:s.themeColor,lang:'es',icons:[{src:s.assets.icon192,sizes:'192x192',type:'image/png',purpose:'any'},{src:s.assets.icon512,sizes:'512x512',type:'image/png',purpose:'any'},{src:s.assets.appleTouchIcon,sizes:'180x180',type:'image/png',purpose:'any'}]};}
function readAuthors(source){
 const prefix=source.match(/export const AUTHORS\s*:\s*Record<string,\s*Author>\s*=\s*/);
 if(!prefix)fail('No se pudo leer la lista de autores sin ejecutar código.',502);
 const node=acorn.parseExpressionAt(source,prefix.index+prefix[0].length,{ecmaVersion:'latest'});
 function read(n){if(n.type==='Literal'&&typeof n.value==='string')return n.value;if(n.type==='ObjectExpression'){const out={};for(const p of n.properties){if(p.type!=='Property'||p.computed||p.kind!=='init')fail('Formato de autor no compatible.',502);const k=p.key.name||p.key.value;if(['__proto__','constructor','prototype'].includes(k))fail('Clave no válida.');out[k]=read(p.value);}return out;}fail('El archivo de autores contiene una expresión no permitida.',502);}
 return read(node);
}
function adminService({db,repository,now=()=>Date.now(),fetcher=fetch}){
 const request=repository.request;
 async function read(path,revision){try{const c=await repository.config();return await request(`/contents/${encodeURI(path)}?ref=${encodeURIComponent(revision||c.branch)}`);}catch(e){if(e.status===404)return null;throw e;}}
 async function published(){const f=await read(SETTINGS);return {settings:f?JSON.parse(Buffer.from(f.content,'base64').toString()):structuredClone(DEFAULT),sha:f?.sha||''};}
 async function load(){const p=await published();let draft=(await db.doc('admin_site/draft').get()).data();if(draft&&draft.version===draft.publishedVersion&&draft.baseSha!==p.sha)draft={...draft,settings:p.settings,baseSha:p.sha,assetIds:[]};return {published:p.settings,publishedSha:p.sha,draft:draft||null,connection:{connected:true,branch:(await repository.config()).branch},release:(await db.doc('admin_site/release').get()).data()||null};}
 async function saveDraft(input){const settings=validateSettings(input.settings);const ref=db.doc('admin_site/draft');await db.runTransaction(async tx=>{const old=(await tx.get(ref)).data();const lock=(await tx.get(db.doc('admin_site/lock'))).data();if(lock?.until>now())fail('Hay una publicación en curso. Espera antes de guardar.',409);if((old?.version||0)!==(input.version||0))fail('Otra pestaña guardó cambios. Recarga antes de continuar.',409);tx.set(ref,{settings,version:(old?.version||0)+1,baseSha:String(input.baseSha||''),assetIds:Array.isArray(input.assetIds)?input.assetIds.filter(i=>/^[\w-]{1,100}$/.test(i)).slice(0,30):[],updatedAt:now()});});return (await ref.get()).data();}
 async function prepareAsset(user,input){
  if(input.kind==='pdf'){const bytes=Buffer.from(String(input.base64||''),'base64');if(bytes.length>1500000||bytes.length<10||!bytes.subarray(0,5).equals(Buffer.from('%PDF-'))||!bytes.subarray(-2048).includes(Buffer.from('%%EOF')))fail('Sube un PDF válido de hasta 1,5 MB.');const id=crypto.randomUUID(),fileId=crypto.randomUUID(),path=`public/downloads/${id}.pdf`;await db.doc(`admin_asset_files/${fileId}`).set({owner:user.uid,group:id,path,mime:'application/pdf',base64:bytes.toString('base64')});await db.doc(`admin_assets/${id}`).set({owner:user.uid,kind:'pdf',files:[{id:fileId,path,mime:'application/pdf'}],refs:{download:path.replace(/^public/,'')},createdAt:now()});return {id,refs:{download:path.replace(/^public/,'')}};}
  if(!['icons','logo','social','avatar'].includes(input.kind))fail('Tipo de imagen no válido.');
  const bytes=Buffer.from(String(input.base64||''),'base64');if(!bytes.length||bytes.length>1600000)fail('Sube una imagen JPG, PNG o WebP de menos de 1,5 MB.');
  if(input.backgroundColor&&!/^#[a-f0-9]{6}$/i.test(input.backgroundColor))fail('El color de fondo no es válido.');
  const image=sharp(bytes,{limitInputPixels:36000000});const meta=await image.metadata();if(!['jpeg','png','webp'].includes(meta.format))fail('Usa JPG, PNG o WebP.');
  const id=crypto.randomUUID(),files=[],refs={};
  async function add(key,buffer,ext,mime){if(buffer.length>700000)fail('La imagen generada es demasiado grande. Prueba un archivo más sencillo.');const filename=`${hash(buffer)}-${key}.${ext}`;const path=`public/branding/${filename}`;const fileId=crypto.randomUUID();await db.doc(`admin_asset_files/${fileId}`).set({owner:user.uid,group:id,path,mime,base64:buffer.toString('base64')});files.push({id:fileId,path,mime});refs[key]=`/branding/${filename}`;}
  if(input.kind==='icons'){
   if(meta.width<512||meta.height<512)fail('Para los iconos utiliza una imagen de al menos 512 × 512 píxeles.');
   for(const [key,size]of [['favicon',48],['appleTouchIcon',180],['icon192',192],['icon512',512]])await add(key,await sharp(bytes).rotate().resize(size,size,{fit:'contain',background:input.backgroundColor||'#FAF7F2'}).png({compressionLevel:9}).toBuffer(),'png','image/png');
  }else if(input.kind==='social')await add('socialImage',await image.rotate().resize(1200,630,{fit:'cover'}).webp({quality:85}).toBuffer(),'webp','image/webp');
  else if(input.kind==='logo')await add('logo',await image.rotate().resize(700,220,{fit:'inside',withoutEnlargement:true}).png({compressionLevel:9}).toBuffer(),'png','image/png');
  else await add('avatar',await image.rotate().resize(400,400,{fit:'cover'}).webp({quality:85}).toBuffer(),'webp','image/webp');
  await db.doc(`admin_assets/${id}`).set({owner:user.uid,kind:input.kind,files,refs,createdAt:now()});
  const previewFile=await db.doc(`admin_asset_files/${files.at(-1).id}`).get();return {id,refs,preview:`data:${files.at(-1).mime};base64,${previewFile.data().base64}`};
 }
 async function assetFiles(ids){const out=[];for(const id of ids){if(!/^[\w-]{1,100}$/.test(id))fail('Imagen inválida.');const group=(await db.doc(`admin_assets/${id}`).get()).data();if(!group)fail('No se encontró una imagen pendiente.');for(const file of group.files){const f=(await db.doc(`admin_asset_files/${file.id}`).get()).data();if(!f||!/^public\/(?:branding|downloads)\/[\w.-]+$/.test(f.path))fail('Ruta de imagen inválida.');out.push(f);}}return out;}
 async function previewAsset(id){const group=(await db.doc(`admin_assets/${id}`).get()).data();if(!group)fail('Imagen no disponible.',404);const f=(await db.doc(`admin_asset_files/${group.files.at(-1).id}`).get()).data();return {refs:group.refs,preview:`data:${f.mime};base64,${f.base64}`};}
 async function commit(files,message,expected){
  const cfg=await repository.config();
  const tree=[];for(const file of files){if(file.base64){const blob=await request('/git/blobs','POST',{content:file.base64,encoding:'base64'});tree.push({path:file.path,mode:'100644',type:'blob',sha:blob.sha});}else tree.push({path:file.path,mode:'100644',type:'blob',content:file.content});}
  for(let attempt=0;attempt<3;attempt++){
   const head=await request(`/git/ref/heads/${encodeURIComponent(cfg.branch)}`);
   for(const [path,sha]of Object.entries(expected)){const current=await read(path,head.object.sha);if((current?.sha||'')!==sha)fail('El sitio cambió desde que abriste el panel. Recarga para conservar la versión más reciente.',409);}
   const parent=await request(`/git/commits/${head.object.sha}`),result=await request('/git/trees','POST',{base_tree:parent.tree.sha,tree}),revision=await request('/git/commits','POST',{message,tree:result.sha,parents:[head.object.sha]});
   try{await request(`/git/refs/heads/${encodeURIComponent(cfg.branch)}`,'PATCH',{sha:revision.sha,force:false});return revision.sha;}catch(e){if(e.status!==409||attempt===2)throw e;}
  }
 }
 async function publish(input){
  const ref=db.doc('admin_site/draft'),draft=(await ref.get()).data();if(!draft||draft.version!==input.version)fail('Guarda o recarga el borrador antes de publicar.',409);
  const lease=db.doc('admin_site/lock');const claim=crypto.randomUUID();await db.runTransaction(async tx=>{const s=(await tx.get(lease)).data();const latest=(await tx.get(ref)).data();if(latest?.version!==input.version)fail('El borrador cambió. Recarga antes de publicar.',409);if(s?.until>now())fail('Ya se están publicando los cambios. Espera un momento.',409);tx.set(lease,{claim,until:now()+120000});});
  try{
   const settings=validateSettings(draft.settings);settings.revision=crypto.randomUUID();
   const current=await published();if(current.sha!==draft.baseSha)fail('El sitio tiene una versión nueva. Recarga antes de publicar.',409);
   const files=(await assetFiles(draft.assetIds)).filter(file=>[...Object.values(settings.assets),...settings.catalog.map(x=>x.url)].includes(file.path.replace(/^public/,'')));
   files.push({path:SETTINGS,content:JSON.stringify(settings,null,2)+'\n'},{path:'public/manifest.json',content:JSON.stringify(manifest(settings),null,2)+'\n'},{path:'public/ads.txt',content:settings.ads.publisherId?`google.com, ${settings.ads.publisherId.replace('ca-','')}, DIRECT, f08c47fec0942fa0\n`:''});
   const sha=await commit(files,'Update website settings from the online admin',{[SETTINGS]:draft.baseSha});
   await db.doc('admin_site/release').set({revision:settings.revision,commitSha:sha,status:'deploying',createdAt:now()});
   await db.runTransaction(async tx=>{const latest=(await tx.get(ref)).data();if(latest.version===draft.version)tx.set(ref,{...draft,settings,publishedVersion:draft.version});});return {revision:settings.revision,commitSha:sha,status:'deploying'};
  }finally{await db.runTransaction(async tx=>{const s=(await tx.get(lease)).data();if(s?.claim===claim)tx.set(lease,{until:0});});}
 }
 async function releaseStatus(){const ref=db.doc('admin_site/release'),s=(await ref.get()).data();if(!s)return null;if(s.status==='deploying'){const r=await fetcher('https://www.instantetrips.com/',{signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});const text=r.ok?await r.text():'';if(text.includes(`name="site-settings-version" content="${s.revision}"`)){await ref.set({...s,status:'published',publishedAt:now()});const current=await published();await db.runTransaction(async tx=>{const d=await tx.get(db.doc('admin_site/draft'));if(d.data()?.settings?.revision===s.revision&&d.data()?.version===d.data()?.publishedVersion)tx.set(db.doc('admin_site/draft'),{...d.data(),baseSha:current.sha,assetIds:[]});});return {...s,status:'published'};}}return s;}
 async function authors(){const file=await read('src/data/authors.ts');if(!file)fail('No se encontraron los autores.',404);return {authors:readAuthors(Buffer.from(file.content,'base64').toString()),sha:file.sha};}
 async function saveAuthor(input){const current=await authors();if(input.sha!==current.sha)fail('La lista de autores cambió. Recarga antes de guardar.',409);const a=input.author||{},slug=String(a.slug||'');if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))fail('Usa un identificador con letras minúsculas y guiones.');const author={slug,name:String(a.name||'').trim().slice(0,120),role:String(a.role||'').slice(0,150),bio:String(a.bio||'').slice(0,1200),image:safeUrl(a.image),email:String(a.email||'').trim().slice(0,160)};if(author.image&&!/^(https:\/\/|\/(?!\/))/.test(author.image))fail('La foto del autor debe ser una imagen local o https.');if(!author.name||!author.image)fail('Completa el nombre y la imagen.');if(author.email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(author.email))fail('Correo del autor no válido.');current.authors[slug]=author;const content='export type Author = { slug: string; name: string; role: string; bio: string; image: string; email?: string; };\n\nexport const AUTHORS: Record<string, Author> = '+JSON.stringify(current.authors,null,2)+';\n\nexport const DEFAULT_AUTHOR = AUTHORS[\'daniel-arana\'] || Object.values(AUTHORS)[0];\n';const files=(await assetFiles(input.assetIds||[])).filter(file=>file.path.replace(/^public/,'')===author.image);files.push({path:'src/data/authors.ts',content});const sha=await commit(files,`Update author ${slug} from online admin`,{'src/data/authors.ts':current.sha});return {commitSha:sha};}
 async function resetDraft(input){const p=await published();return saveDraft({version:input.version,settings:p.settings,baseSha:p.sha,assetIds:[]});}
 return {load,saveDraft,resetDraft,prepareAsset,previewAsset,publish,releaseStatus,authors,saveAuthor,pages:infoPagesService({db,read,commit,now,fetcher,contact:async()=>{const p=await published();if(p.settings.contactEmail)return p.settings.contactEmail;const a=await authors();return a.authors['daniel-arana']?.email||'';}})};
}
module.exports={adminService,validateSettings,manifest,readAuthors};
