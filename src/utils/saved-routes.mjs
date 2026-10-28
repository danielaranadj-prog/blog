export const ROUTE_STORAGE_KEY='instante-saved-route-v1';
export function normalizeRoute(item) {
  if(!item||typeof item!=='object'||typeof item.url!=='string'||!/^\/posts\/[^/?#\\]+\/?$/.test(item.url))return null;
  return {url:item.url.replace(/\/$/,''),title:String(item.title||'Guía guardada').slice(0,300),category:String(item.category||'Viajes').slice(0,120),savedAt:Number(item.savedAt)||0};
}
export function readSavedRoutes(storage) {
  try {
    const items=JSON.parse(storage.getItem(ROUTE_STORAGE_KEY)||'[]');
    if(!Array.isArray(items))return [];
    const seen=new Set();
    return items.map(normalizeRoute).filter(item=>{
      if(!item||seen.has(item.url))return false;
      seen.add(item.url);return true;
    }).slice(0,200);
  }catch{return [];}
}
export function writeSavedRoutes(storage,items) {
  try{storage.setItem(ROUTE_STORAGE_KEY,JSON.stringify(items));return true;}catch{return false;}
}
