// Only read data attributes. Pasted scripts/HTML are never inserted or executed.
export function readInFeedCode(source){
  if(typeof source!=='string'||source.length>20000)throw Error('Pega el código de un solo bloque in-feed de AdSense.');
  const tags=source.match(/<ins\b[^>]*>/gi)||[];
  const ads=tags.map(tag=>{
    const attributes={};
    for(const match of tag.matchAll(/\s([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g))attributes[match[1].toLowerCase()]=match[2]??match[3];
    return attributes;
  }).filter(a=>(a.class||'').split(/\s+/).includes('adsbygoogle'));
  if(ads.length!==1)throw Error('Pega el código de un solo bloque in-feed de AdSense.');
  const a=ads[0];
  if(a['data-ad-format']!=='fluid'||!a['data-ad-layout-key'])throw Error('Este código no incluye el diseño in-feed. En AdSense crea un bloque In-feed y copia su código completo.');
  const result={publisherId:a['data-ad-client']||'',feedSlot:a['data-ad-slot']||'',feedLayoutKey:a['data-ad-layout-key'],feedLayout:a['data-ad-layout']||''};
  if(!/^ca-pub-\d{16}$/.test(result.publisherId)||!/^\d{6,20}$/.test(result.feedSlot)||!/^[a-zA-Z0-9_+-]{1,200}$/.test(result.feedLayoutKey)||result.feedLayout&&!/^[a-zA-Z0-9_-]{1,80}$/.test(result.feedLayout))throw Error('El código contiene identificadores no válidos. Vuelve a copiarlo desde AdSense.');
  return result;
}
