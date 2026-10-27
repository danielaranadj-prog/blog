import fs from 'node:fs';
import matter from 'gray-matter';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkCatalog } from './src/plugins/remark-catalog.mjs';
import { remarkVideo } from './src/plugins/remark-video.mjs';

export default defineConfig({
  // 1. Tu dominio está perfecto
  site: 'https://www.instantetrips.com',

  // 2. Base comentada (Correcto para subdominio)
  // base: '/blog', 

  markdown: {
    remarkPlugins: [remarkVideo,remarkCatalog],
  },

  integrations: [
    sitemap({
      filter: url => {
        const p = new URL(url).pathname.replace(/\/$/, '');
        return !['/buscar', '/404', '/mi-ruta'].includes(p) && !p.startsWith('/ir/');
      },
      serialize: item => {
        const pathname=decodeURIComponent(new URL(item.url).pathname).replace(/\/$/,'');
        if(pathname.startsWith('/posts/')){
          const filename=pathname.slice('/posts/'.length);
          if(!filename.includes('/')){
            const file=new URL(`./src/pages/posts/${filename}.md`,import.meta.url);
            if(fs.existsSync(file)){const data=matter(fs.readFileSync(file,'utf8')).data;const date=new Date(data.modifiedDate||data.publishDate);if(!Number.isNaN(date.valueOf()))item.lastmod=date.toISOString();}
          }
        }
        return item;
      }
    })  // <--- ¡LISTO! Sin las barras //
  ],
});