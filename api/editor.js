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
      case 'get':result=await api.getPost(user,b.id);break;
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
      case 'reviewed': {
        const p=await api.getPost(user,b.id);
        if(b.version!==p.version) {const e=new Error('La ficha cambió. Vuelve a abrirla.');e.status=409;throw e;}
        if(!/^\d{4}-\d{2}-\d{2}$/.test(b.reviewAt||'')) {const e=new Error('Selecciona la próxima fecha de revisión.');e.status=400;throw e;}
        await admin.firestore().doc(`editor_posts/${b.id}`).update({reviewAt:b.reviewAt,lastReviewedAt:Date.now()});result={ok:true};break;
      }
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
