const admin = require('firebase-admin');
const { service } = require('../functions/editor-core.cjs');
function init() {
  if(!admin.apps.length) {
    if(!process.env.FIREBASE_SERVICE_ACCOUNT) { const e=new Error('Falta configurar Firebase en el servidor.');e.status=503;throw e; }
    const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({credential:admin.credential.cert(account),storageBucket:process.env.EDITOR_STORAGE_BUCKET || 'instantetrips-editor.firebasestorage.app'});
  }
  return service({admin,db:admin.firestore(),bucket:admin.storage().bucket()});
}
module.exports=async(req,res)=>{
  res.setHeader('Cache-Control','no-store');
  res.setHeader('X-Content-Type-Options','nosniff');
  if(req.method!=='POST') return res.status(405).json({error:'Utiliza POST.'});
  if(req.headers.origin && req.headers.origin!==`https://${req.headers.host}` && !/^http:\/\/localhost(:\d+)?$/.test(req.headers.origin)) return res.status(403).json({error:'Origen no permitido.'});
  try {
    const api=init();
    const token=(req.headers.authorization||'').replace(/^Bearer /,'');
    if(!token) return res.status(401).json({error:'Inicia sesión.'});
    const user=await api.authorized(await admin.auth().verifyIdToken(token,true));
    const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
    let result;
    switch(b.action) {
      case 'bootstrap':result={connection:await api.repository.config()};break;
      case 'authors':result=await require('../functions/site-admin.cjs').adminService({db:admin.firestore(),repository:api.repository}).authors();break;
      case 'readPublished': {
        const ep=String(b.path||'');
        if(!/^\/contents\/(?:src\/data\/authors\.ts|src\/pages\/posts(?:\/[^/?#%\\]+\.md)?)$/.test(ep))return res.status(400).json({error:'Ruta no permitida.'});
        result=await api.repository.request(ep);break;
      }
      case 'list': result={posts:await api.list(user),scheduler:(await admin.firestore().doc('editor_system/scheduler').get()).data()?.lastHeartbeat || 0,aiReady:!!(process.env.EDITOR_GEMINI_API_KEY&&process.env.EDITOR_GEMINI_MODEL),storage:process.env.EDITOR_USE_STORAGE==='true'?'storage':'private-compressed'};break;
      case 'get':{result=await api.getPost(user,b.id);if(result.filename&&!result.quickSummary){const cfg=await api.repository.config();try{const raw=await api.repository.request(`/contents/${cfg.path}/${encodeURIComponent(result.filename)}?ref=${encodeURIComponent(cfg.branch)}`);result.quickSummary=require('gray-matter')(Buffer.from(raw.content,'base64').toString()).data.quickSummary||{};}catch(e){if(e.status!==404)throw e;}}break;}
      case 'save':result=await api.save(user,b.post,'draft');break;
      case 'schedule':result=await api.save(user,b.post,'scheduled');break;
      case 'publish':result=await api.publish(user,b.id,b.version);break;
      case 'verify':result=await api.verify(user,b.id);break;
      case 'mediaList':result=await api.mediaList(user);break;
      case 'mediaSave':result=await api.mediaSave(user,b.media);break;
      case 'mediaGet': {const m=await api.mediaGet(user,b.id);result={id:m.id,mime:m.mime,base64:m.bytes.toString('base64')};break;}
      case 'mediaUpdate': {
        await api.mediaGet(user,b.id);
        await admin.firestore().doc(`editor_media/${b.id}`).update({alt:String(b.alt||'').slice(0,300),credit:String(b.credit||'').slice(0,200),destination:String(b.destination||'').slice(0,100)});
        result={ok:true};break;
      }
      case 'items': if(!['ideas','trips','questions'].includes(b.kind)) throw Error('Tipo inválido.'); result=await api.library(user,b.kind);break;
      case 'saveItem':result=await api.saveItem(user,b.kind,b.item);break;
      case 'reviewed':result=await api.reviewMany(user,[{id:b.id,version:b.version}],b.reviewAt);break;
      case 'history':result=await api.history(user,b.id);break;
      case 'restoreVersion':result=await api.restoreVersion(user,b.id,b.historyVersion,b.version);break;
      case 'catalog':{const cfg=await api.repository.config();const raw=await api.repository.request(`/contents/src/data/site-settings.json?ref=${encodeURIComponent(cfg.branch)}`);const settings=JSON.parse(Buffer.from(raw.content,'base64').toString());result=(settings.catalog||[]).filter(i=>i.enabled&&i.confirmed).map(item=>({...item,presentations:{card:require('../functions/catalog-presentation.cjs').catalogAnchor(item,{format:'card'})}}));break;}
      case 'prepareRemovals':result=await api.prepareRemovals(user,b.ids);break;
      case 'trashMany':result=await api.trashMany(user,b.entries);break;
      case 'restoreMany':result=await api.restoreMany(user,b.entries);break;
      case 'trashItems':result=await api.trashItems(user,b.kind,b.entries);break;
      case 'restoreItems':result=await api.restoreItems(user,b.kind,b.entries);break;
      case 'trashedItems':result=await api.trashedItems(user);break;
      case 'reviewMany':result=await api.reviewMany(user,b.entries,b.reviewAt);break;
      case 'prepareRemoval':result=await api.prepareRemoval(user,b.id);break;
      case 'trash':result=await api.trash(user,b.id,b.version,b.sourceSha);break;
      case 'restore':result=await api.restore(user,b.id,b.version);break;
      case 'verifyRemoval':result=await api.verifyRemoval(user,b.id);break;
      case 'archive':result=await api.archive(user,b.id,b.archived);break;
      case 'reloadPublished':result=await api.reloadPublished(user,b.id);break;
      case 'import':result=await api.importPosts(user);break;
      case 'generate':result=await require('../functions/editor-ai.cjs').generateEditorialText({db:admin.firestore(),user,input:b});break;
      case 'checkLinks': {
        const links=[...new Set(Array.isArray(b.links)?b.links:[])].filter(x=>typeof x==='string'&&x.length<2000).slice(0,10);
        const {checkLink}=require('../functions/link-check.cjs');
        result=[];for(let i=0;i<links.length;i+=5)result.push(...await Promise.all(links.slice(i,i+5).map(l=>checkLink(l))));break;
      }
      case 'stats':result=await api.stats(user);break;
      default:return res.status(400).json({error:'Acción desconocida.'});
    }
    return res.status(200).json(result);
  }catch(e){
    console.error('editor-api',e.code||e.status||'error');
    const status=e.status || (/auth\//.test(e.code||'')?401:500);
    return res.status(status).json({error:status===500?'No se pudo completar la operación. Tu contenido permanece en el editor.':e.message});
  }
};
