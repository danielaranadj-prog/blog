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
    sitemap()  // <--- ¡LISTO! Sin las barras //
  ],
});