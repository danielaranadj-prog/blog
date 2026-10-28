import fs from 'node:fs';

export function restorePublicTools(publicDir,outDir){
  // Astro 1's server cleanup can remove public folders containing .mjs files.
  // Restore only the public tools after that cleanup; never copy server sources.
  for(const name of ['admin','editor']){
    const source=new URL(`${name}/`,publicDir),target=new URL(`${name}/`,outDir);
    fs.cpSync(source,target,{recursive:true});
    for(const required of ['index.html']){
      if(!fs.existsSync(new URL(required,target)))throw new Error(`Falta ${name}/${required} en el sitio compilado.`);
    }
  }
}

export default function publicTools(){
  let publicDir;
  return {name:'instante-public-tools',hooks:{
    'astro:config:done':({config})=>{publicDir=config.publicDir;},
    'astro:build:done':({dir})=>restorePublicTools(publicDir,dir)
  }};
}
