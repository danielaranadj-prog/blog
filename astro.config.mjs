import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; 

export default defineConfig({
  // 1. Tu dominio está perfecto
  site: 'https://blog.instantetrips.com',
  
  // 2. Base comentada (Correcto para subdominio)
  // base: '/blog', 
  
  integrations: [
    sitemap()  // <--- ¡LISTO! Sin las barras //
  ],
});