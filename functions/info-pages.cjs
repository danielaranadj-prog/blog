const crypto = require('node:crypto');
const sanitizeHtml = require('sanitize-html');
const DEFINITIONS = {
  manifesto: {label:'Manifiesto',url:'/manifiesto'},
  about: {label:'Sobre nosotros',url:'/sobre-mi'},
  cookies: {label:'Cookies',url:'/cookies'},
  privacy: {label:'Privacidad',url:'/legal/privacidad'},
  terms: {label:'Términos',url:'/legal/terminos'}
};
const DEFAULTS = {manifesto:require('../src/data/info-pages/manifesto.json'),about:require('../src/data/info-pages/about.json'),cookies:require('../src/data/info-pages/cookies.json'),privacy:require('../src/data/info-pages/privacy.json'),terms:require('../src/data/info-pages/terms.json')};
function fail(message,status=400){const error=new Error(message);error.status=status;throw error;}
function keyOf(key){if(!Object.hasOwn(DEFINITIONS,key))fail('Página no válida.',404);return key;}
function validatePage(input){
  if(!input||typeof input!=='object')fail('Falta el contenido de la página.');
  const page={revision:'draft'};
  for(const [key,max,required] of [['title',180,true],['description',320,true],['eyebrow',100,false],['summary',600,false]]){
    const text=String(input[key]||'').trim();if(text.length>max||required&&!text)fail(`Revisa el campo ${key}.`);page[key]=text;
  }
  if(typeof input.html!=='string'||Buffer.byteLength(input.html)>180000)fail('La página supera el tamaño permitido.');
  page.html=sanitizeHtml(input.html,{
    allowedTags:['p','br','h2','h3','h4','strong','b','em','i','u','s','ul','ol','li','blockquote','a','div','span','hr'],
    allowedAttributes:{'*':['class'],a:['href','title','rel','target']},
    allowedSchemes:['https','http','mailto'],allowProtocolRelative:false,
    transformTags:{a:(tag,attrs)=>({tagName:tag,attribs:{...attrs,...(attrs.target==='_blank'?{rel:'noopener noreferrer'}:{})}})}
  });
  if(!page.html.replace(/<[^>]*>/g,'').replace(/&nbsp;/g,' ').trim())fail('Escribe el contenido de la página.');
  return page;
}
function infoPagesService({db,read,commit,now=()=>Date.now(),fetcher=fetch,contact=async()=>''}){
  const path=key=>`src/data/info-pages/${keyOf(key)}.json`;
  const ref=key=>db.doc(`admin_pages/${keyOf(key)}`);
  async function source(key){const file=await read(path(key));return {page:file?JSON.parse(Buffer.from(file.content,'base64').toString()):DEFAULTS[key],sha:file?.sha||''};}
  async function load(key){keyOf(key);const current=await source(key),draft=(await ref(key).get()).data();const fresh=!!draft&&draft.version===draft.publishedVersion&&draft.baseSha!==current.sha;return {key,...DEFINITIONS[key],publishedSha:current.sha,contactEmail:await contact(),page:fresh?current.page:draft?.page||current.page,version:draft?.version||0,baseSha:fresh?current.sha:draft?.baseSha??current.sha,hasDraft:!!draft&&draft.version!==draft.publishedVersion,release:draft?.release||null};}
  async function list(){return Promise.all(Object.keys(DEFINITIONS).map(async key=>{const d=(await ref(key).get()).data();return {key,...DEFINITIONS[key],hasDraft:!!d&&d.version!==d.publishedVersion,release:d?.release||null};}));}
  async function save(input){const key=keyOf(input.key),page=validatePage(input.page);if(!Number.isInteger(input.version)||input.version<0)fail('Versión de borrador inválida.');await db.runTransaction(async tx=>{
    const target=ref(key),old=(await tx.get(target)).data();
    if(old?.lockUntil>now())fail('Esta página se está publicando. Espera un momento.',409);
    if((old?.version||0)!==input.version)fail('Otra pestaña guardó esta página. Recarga antes de continuar.',409);
    tx.set(target,{...old,page,version:input.version+1,baseSha:String(input.baseSha||''),updatedAt:now()});
  });return load(key);}
  async function reset(input){const current=await source(keyOf(input.key));return save({...input,page:current.page,baseSha:current.sha});}
  async function publish(input){
    const key=keyOf(input.key),target=ref(key),claim=crypto.randomUUID();let draft;
    await db.runTransaction(async tx=>{draft=(await tx.get(target)).data();if(!draft||draft.version!==input.version)fail('Guarda o recarga el borrador antes de publicar.',409);if(draft.lockUntil>now())fail('Ya hay una publicación en curso.',409);tx.set(target,{...draft,claim,lockUntil:now()+120000});});
    try{
      const page=validatePage(draft.page);page.revision=crypto.randomUUID();
      const sha=await commit([{path:path(key),content:JSON.stringify(page,null,2)+'\n'}],`Update ${key} page from online admin`,{[path(key)]:draft.baseSha});
      const current=await source(key),release={status:'deploying',revision:page.revision,commitSha:sha,createdAt:now()};
      await db.runTransaction(async tx=>{const latest=(await tx.get(target)).data();if(latest.claim===claim)tx.set(target,{...latest,page,baseSha:current.sha,publishedVersion:draft.version,release});});
      return release;
    }finally{await db.runTransaction(async tx=>{const latest=(await tx.get(target)).data();if(latest?.claim===claim)tx.set(target,{...latest,lockUntil:0});});}
  }
  async function status(key){const target=ref(key),draft=(await target.get()).data(),release=draft?.release;if(!release||release.status==='published')return release||null;
    const response=await fetcher(`https://www.instantetrips.com${DEFINITIONS[key].url}`,{signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});
    if(response.ok&&(await response.text()).includes(`name="managed-page-version" content="${release.revision}"`)){
      const ready={...release,status:'published',publishedAt:now()};
      await db.runTransaction(async tx=>{const latest=(await tx.get(target)).data();if(latest?.release?.revision===release.revision)tx.set(target,{...latest,release:ready});});return ready;
    }return release;
  }
  return {load,list,save,reset,publish,status};
}
module.exports={infoPagesService,validatePage,DEFINITIONS};
