import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap'; 

export default defineConfig({
  // 1. Pon el subdominio completo aquí
  site: 'https://blog.instantetrips.com',
  
  // 2. BORRA o comenta la línea 'base'. 
  // Al estar en un subdominio, la raíz es '/', no '/blog'
  // base: '/blog', 
  
  integrations: [
    // sitemap()
  ],
});