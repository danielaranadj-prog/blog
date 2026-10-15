const admin=require('firebase-admin');
const {service}=require('../functions/editor-core.cjs');
const {adminService}=require('../functions/site-admin.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Utiliza POST.'});
 if(req.headers.origin&&req.headers.origin!==`https://${req.headers.host}`&&!/^http:\/\/localhost(:\d+)?$/.test(req.headers.origin))return res.status(403).json({error:'Origen no permitido.'});
 try{
  const token=(req.headers.authorization||'').replace(/^Bearer /,'');if(!token)return res.status(401).json({error:'Inicia sesión.'});
  if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT))});
  const db=admin.firestore(),editor=service({admin,db}),user=await editor.authorized(await admin.auth().verifyIdToken(token,true));
  if(!user.admin)return res.status(403).json({error:'Solo los administradores pueden modificar el sitio.'});
  const b=typeof req.body==='string'?JSON.parse(req.body):req.body||{},api=adminService({db,repository:editor.repository});let result;
  switch(b.action){
   case 'load':await editor.repository.secureConfig();result=await api.load();break;
   case 'saveDraft':result=await api.saveDraft(b);break;
   case 'resetDraft':result=await api.resetDraft(b);break;
   case 'prepareAsset':result=await api.prepareAsset(user,b);break;
   case 'previewAsset':if(!/^[\w-]{1,100}$/.test(b.id||''))throw Error('Imagen inválida.');result=await api.previewAsset(b.id);break;
   case 'publish':result=await api.publish(b);break;
   case 'status':result=await api.releaseStatus();break;
   case 'authors':result=await api.authors();break;
   case 'saveAuthor':result=await api.saveAuthor(b);break;
   case 'stats':result=await editor.stats(user);break;
   default:return res.status(400).json({error:'Acción desconocida.'});
  }
  return res.status(200).json(result);
 }catch(e){console.error('site-admin',e.code||e.status||'error');const status=e.status||(/^auth\//.test(e.code||'')?401:500);return res.status(status).json({error:status===500?'No se pudo completar la operación. Los cambios siguen en el panel.':e.message});}
};
