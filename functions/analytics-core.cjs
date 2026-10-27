const crypto=require('node:crypto');
const TYPES=new Set(['page_view','outbound_click','affiliate_click','download_click']);
function fail(message,status=400){const e=new Error(message);e.status=status;throw e;}
function validateEvent(input){
 if(!input||!TYPES.has(input.type))fail('Evento inválido.');
 let path=String(input.path||'');try{path=decodeURIComponent(path);}catch{fail('Ruta inválida.');}
 path=path.replace(/\/+$/,'')||'/';
 if(path.length>240||!/^\/(?:posts\/[^/?#\\\s]+|ir\/[^/?#\\\s]+|destinos(?:\/[^/?#\\\s]+)?|legal\/(?:privacidad|terminos)|(?:\d+|sobre-mi|manifiesto|cookies|recursos|mi-ruta|buscar))?$/.test(path))fail('Ruta inválida.');
 if(!/^[a-zA-Z0-9_-]{16,80}$/.test(input.id||''))fail('Identificador inválido.');
 const target=String(input.target||'');if(target&&!/^[a-zA-Z0-9._-]{1,100}$/.test(target))fail('Referencia inválida.');
 return {type:input.type,path,id:input.id,target};
}
async function record({db,event,ip,secret,now=Date.now()}){
 const e=validateEvent(event),day=new Date(now).toISOString().slice(0,10),minute=Math.floor(now/60000);
 const hash=s=>crypto.createHmac('sha256',secret).update(s).digest('hex');
 const rate=db.doc(`analytics_limits/${hash(day+'|'+ip)}`),total=db.doc(`analytics_limits/total-${day}`);
 const key=hash([day,e.path,e.type,e.target].join('|')),aggregate=db.doc(`analytics_daily/${key}`);
 const outcome=await db.runTransaction(async tx=>{
  const r=(await tx.get(rate)).data()||{},t=(await tx.get(total)).data()||{},a=(await tx.get(aggregate)).data()||{};
  if((r.ids||[]).includes(e.id))return {duplicate:true};
  if((r.dayCount||0)>=500||(r.minute===minute&&(r.minuteCount||0)>=40)||(t.count||0)>=50000)fail('Límite de medición alcanzado.',429);
  tx.set(rate,{minute,minuteCount:r.minute===minute?(r.minuteCount||0)+1:1,dayCount:(r.dayCount||0)+1,ids:[...(r.ids||[]).slice(-49),e.id],expiresAt:now+2*86400000});
  tx.set(total,{count:(t.count||0)+1,expiresAt:now+2*86400000});
  tx.set(aggregate,{day,path:e.path,type:e.type,target:e.target,count:(a.count||0)+1,expiresAt:now+90*86400000});
  return {ok:true,cleanup:(t.count||0)%20===0};
 });
 if(outcome.cleanup){for(const collection of ['analytics_limits','analytics_daily']){try{const old=await db.collection(collection).where('expiresAt','<',now).limit(20).get();await Promise.all(old.docs.map(d=>d.ref.delete()));}catch{}}}
 return {ok:true,duplicate:outcome.duplicate===true};
}
module.exports={validateEvent,record};
