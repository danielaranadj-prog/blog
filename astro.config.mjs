import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { remarkVideo } from './src/plugins/remark-video.mjs';

export default defineConfig({
  // 1. Tu dominio está perfecto
  site: 'https://blog.instantetrips.com',

  // 2. Base comentada (Correcto para subdominio)
  // base: '/blog', 

  markdown: {
    remarkPlugins: [remarkVideo],
  },

  integrations: [
    sitemap()  // <--- ¡LISTO! Sin las barras //
  ],
});