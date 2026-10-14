# Astro Blog Starter with Decap CMS

This example is based on the official [Astro Starter Kit: Blog][starter],
and adds the [Astro Decap CMS integration][integration].

## Quick deploy

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)][deploy]

☝️ Click this button to copy this project to your own GitHub (or GitLab)
account and set up continuous deployment with Netlify as if by magic. ✨

Once you’ve got the project set up, you do need to
[activate Netlify Identity in the Netlify UI][identity] and then enable
[“Git Gateway”][gateway] to allow e-mail/password authentication.

## Commands

All commands are run from the root of the project, from a terminal:

| Command            | Action                                           |
| :----------------- | :----------------------------------------------- |
| `pnpm install`     | Installs dependencies                            |
| `pnpm run dev`     | Starts local dev & Decap CMS proxy servers       |
| `pnpm run build`   | Build your production site to `./dist/`          |
| `pnpm run preview` | Serve `./dist/` & run the Decap CMS proxy server |

> **Note**
> These commands are using [`pnpm`][pnpm], a fast and efficient package manager.
> You can choose to use `npm` or `yarn` instead if you prefer, but remember to update the config in [`netlify.toml`](netlify.toml) to match.

[starter]: https://astro.new/blog?on=github
[integration]: https://github.com/advanced-astro/astro-decap-cms
[deploy]: https://app.netlify.com/start/deploy?repository=https://github.com/advanced-astro/astro-decap-cms-starter
[identity]: https://docs.netlify.com/visitor-access/identity/
[gateway]: https://docs.netlify.com/visitor-access/git-gateway/
[pnpm]: https://pnpm.io/

## Aknowledgement

- [astro-netlify-cms-starter](https://github.com/delucis/astro-netlify-cms-starter)


## Producción de Instante Trips

- Sitio principal: https://www.instantetrips.com
- Editor de artículos: https://www.instantetrips.com/editor
- Herramientas de administración: https://www.instantetrips.com/admin
- Repositorio productivo: `danielaranadj-prog/blog`, rama `main`.
- Vercel: proyecto `blog-al95`, equipo `danielaranadj-progs-projects`.
- Astro 1.9.2; publicaciones en `src/pages/posts/`.
- Compilar con `ASTRO_TELEMETRY_DISABLED=1 npm run build`.

El código activo de las herramientas está en `public/editor/` y `public/admin/`.
Se importó del repositorio `danielaranadj-prog/danielaranadj-prog.github.io`,
commit `16ab48b`. Ese repositorio queda como respaldo; sus cambios futuros no
se publican en el nuevo sitio automáticamente. Modificar estas copias activas
para actualizar las herramientas.

Se mantienen Firebase Authentication y la configuración de publicación de
Firestore (`config/main`): no se cambian usuarios, contraseñas ni tokens.
Las herramientas siguen publicando mediante la API de GitHub. La política de
recursos específica de ambas rutas está en `vercel.json`; la política del blog
público se conserva.

El dominio `instantetrips.com` redirige a `www.instantetrips.com`. El antiguo
`blog.instantetrips.com` debe redirigir permanentemente al dominio principal
conservando cada ruta. Los dominios se administran en Vercel y el DNS en Namecheap.
