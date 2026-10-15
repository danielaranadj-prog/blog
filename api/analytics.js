const admin=require('firebase-admin');
const {record}=require('../functions/analytics-core.cjs');
module.exports=async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method!=='POST')return res.status(405).json({error:'Utiliza POST.'});
 if(req.headers.origin!=='https://www.instantetrips.com')return res.status(403).json({error:'Origen no permitido.'});
 if(!String(req.headers['content-type']||'').startsWith('application/json'))return res.status(415).json({error:'Utiliza JSON.'});
 if(Number(req.headers['content-length']||0)>1600)return res.status(413).json({error:'Evento demasiado grande.'});
 if(/bot|crawler|spider|headless/i.test(req.headers['user-agent']||''))return res.status(204).end();
 try{
  const body=typeof req.body==='string'?JSON.parse(req.body):req.body;if(Buffer.byteLength(JSON.stringify(body||{}))>1600)return res.status(413).json({error:'Evento demasiado grande.'});
  if(!process.env.FIREBASE_SERVICE_ACCOUNT)return res.status(503).json({error:'Medición no disponible.'});
  const account=JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  if(!admin.apps.length)admin.initializeApp({credential:admin.credential.cert(account)});
  const ip=String(req.headers['x-vercel-forwarded-for']||req.headers['x-forwarded-for']||req.socket?.remoteAddress||'unknown').split(',')[0].trim();
  const result=await record({db:admin.firestore(),event:body,ip,secret:account.private_key});return res.status(200).json(result);
 }catch(e){const status=e.status|| (e instanceof SyntaxError?400:500);console.error('analytics',status);return res.status(status).json({error:status===500?'Medición no disponible.':e.message});}
};
