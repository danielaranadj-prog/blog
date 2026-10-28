export function getNewsletterUrl(raw='') {
  try {
    const url=new URL(raw);
    if(url.protocol!=='https:'||url.username||url.password)return '';
    if(['instantetrips.com','www.instantetrips.com'].includes(url.hostname)&&['/','/recursos','/recursos/'].includes(url.pathname))return '';
    return url.href;
  }catch{return '';}
}
