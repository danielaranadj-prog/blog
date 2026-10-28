/**
 * Optimiza imágenes de Cloudinary y repara el bug de entidades HTML (&#38;) en Unsplash.
 * El tamaño final depende del origen y del contenido de la imagen.
 */
export function optimizeImageUrl(rawUrl: string, width = 800): string {
  if (!rawUrl) return "/hero-bg.jpg";

  // 1. Reparar entidades HTML escapadas por error (causa del HTTP 400 en Unsplash)
  const unescaped = rawUrl.replace(/&#38;|&#x26;|&amp;/g, "&");

  // 2. Inyectar transformaciones automáticas f_auto,q_auto en Cloudinary
  if (unescaped.includes("res.cloudinary.com") && unescaped.includes("/image/upload/")) {
    if (!unescaped.includes("f_auto")) {
      return unescaped.replace(
        "/image/upload/",
        `/image/upload/f_auto,q_auto:eco,w_${width},c_limit/`
      );
    }
  }

  // 3. Ajustar ancho y formato WebP en Unsplash
  if (unescaped.includes("images.unsplash.com")) {
    try {
      const u = new URL(unescaped);
      u.searchParams.set("auto", "format");
      u.searchParams.set("fit", "crop");
      u.searchParams.set("w", String(width));
      u.searchParams.set("q", "80");
      return u.toString();
    } catch {
      return unescaped;
    }
  }

  return unescaped;
}

/**
 * Normaliza títulos en español para generar slugs limpios sin cortar vocales con tilde ni añadir dobles guiones.
 */
export function generateCleanSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
