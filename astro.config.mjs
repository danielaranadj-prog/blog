import { defineConfig } from 'astro/config';
// import sitemap from '@astrojs/sitemap';  // ← Comentado temporalmente

export default defineConfig({
  site: 'https://www.instantetrips.com',
  base: '/blog',
  
  integrations: [
    // sitemap()  // ← Comentado temporalmente
  ],
});