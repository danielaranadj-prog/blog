export const typeLabels={experiencia:'Experiencia',opinion:'Opinión',guia:'Guía práctica',comparativa:'Comparativa',seleccion:'Listas y recomendaciones',entrevista:'Entrevista'};
export const budgetLabels={gratis:'Gratis',economico:'Económico',intermedio:'Intermedio',premium:'Premium',mixto:'Mixto'};
export function absoluteUrl(value,site){try{const url=new URL(value,site);return /^https?:$/.test(url.protocol)?url.href:undefined;}catch{return undefined;}}
export function isoDate(value){if(!value)return undefined;const date=new Date(value);return Number.isNaN(date.valueOf())?undefined:date.toISOString();}
export function articleSchema({post,author,permalink,settings}){
 const site='https://www.instantetrips.com';
 const published=isoDate(post.publishDate),modified=isoDate(post.modifiedDate);
 return {'@context':'https://schema.org','@graph':[
  {'@type':'BlogPosting','@id':`${permalink}#article`,isPartOf:{'@type':'WebSite','@id':`${site}/#website`,name:settings.name,url:site+'/'},headline:post.title,description:post.description,image:post.heroImage?[absoluteUrl(post.heroImage,site)]:undefined,datePublished:published,dateModified:modified&&(!published||modified>=published)?modified:published,inLanguage:'es',mainEntityOfPage:permalink,genre:typeLabels[post.editorialType],articleSection:post.destination||post.tags?.[0]||undefined,keywords:post.tags?.length?post.tags:undefined,author:{'@type':'Person',name:author.name,url:permalink+'#autor'},publisher:{'@type':'Organization',name:settings.name,logo:{'@type':'ImageObject',url:absoluteUrl(settings.assets.logo||settings.assets.favicon,site)}}},
  {'@type':'BreadcrumbList','@id':`${permalink}#breadcrumb`,itemListElement:[{'@type':'ListItem',position:1,name:'Inicio',item:site+'/'},{'@type':'ListItem',position:2,name:post.title,item:permalink}]}
 ]};
}
export const jsonLd=value=>JSON.stringify(value).replace(/</g,'\\u003c');
