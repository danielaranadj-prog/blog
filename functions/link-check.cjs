const https=require('node:https');
const dns=require('node:dns/promises');
const net=require('node:net');
function isPublic(address){
  if(net.isIP(address)===4){const [a,b]=address.split('.').map(Number);return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&(b===168||b===0)||a===100&&b>=64&&b<=127||a===198&&(b===18||b===19)||a===192&&b===2||a===198&&b===51||a===203&&b===0);}
  if(net.isIP(address)===6)return /^2[0-9a-f]{3}:/i.test(address)&&!/^2001:(db8|0:)/i.test(address);
  return false;
}
async function checkLink(raw,depth=0){
  try{
    const u=new URL(raw,'https://www.instantetrips.com');
    if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return {url:raw,status:'invalid',message:'Solo se verifican enlaces https sin credenciales.'};
    const host=u.hostname.replace(/^\[|\]$/g,'');
    const records=await dns.lookup(host,{all:true});
    if(!records.length||records.some(r=>!isPublic(r.address)))return {url:raw,status:'blocked',message:'Dirección privada o reservada.'};
    const record=records[0];
    const result=await new Promise((resolve,reject)=>{
      const req=https.request(u,{method:'HEAD',headers:{'User-Agent':'InstanteTrips-LinkChecker/1.0'},lookup:(name,options,cb)=>options.all?cb(null,[{address:record.address,family:record.family}]):cb(null,record.address,record.family),timeout:6000},res=>{res.resume();resolve({code:res.statusCode,location:res.headers.location});});
      req.on('timeout',()=>req.destroy(Error('timeout')));req.on('error',reject);req.end();
    });
    if(result.code>=300&&result.code<400&&result.location&&depth<2){const target=new URL(result.location,u);const next=await checkLink(target.href,depth+1);return {...next,url:raw};}
    return {url:raw,code:result.code,status:result.code>=200&&result.code<400?'ok':[404,410].includes(result.code)?'broken':'review',message:result.code>=200&&result.code<400?'Disponible':[404,410].includes(result.code)?'No encontrado':'El sitio no permite confirmar el enlace; revísalo manualmente.'};
  }catch{return {url:raw,status:'review',message:'No se pudo confirmar. Abre el enlace para revisarlo.'};}
}
module.exports={checkLink,isPublic};
