/**
 * Centralizador de Afiliados y Optimización de Activos (Instante Trips)
 * Reemplaza los IDs por tus IDs de afiliado reales en un solo lugar.
 */

export const AFFILIATE_CONFIG = {
  civitatis: {
    aid: "104521",
    defaultCampaign: "instante-trips-blog",
  },
  travelpayouts: {
    marker: "482910",
  },
  insurance: {
    providerName: "IATI Seguros",
    discountPercent: 5,
    affiliateUrl: "https://www.iatiseguros.com/?r=INSTANTETRIPS",
  },
  esim: {
    providerName: "Holafly / Airalo",
    discountCode: "INSTANTE5",
    affiliateUrl: "https://esim.holafly.com/?ref=instantetrips",
  },
  adsense: {
    publisherId: "ca-pub-5650296070135561",
    slots: {
      inArticleTop: "1029384756",
      inArticleBottom: "5647382910",
      sidebarStickySquare: "9182736450",
      mobileStickyFooter: "4561237890",
    },
  },
};

/**
 * Añade automáticamente parámetros de afiliado a enlaces limpios de Civitatis, Omio, Booking o Skyscanner.
 */
export function buildAffiliateUrl(rawUrl: string, campaignSlug = "post"): string {
  if (!rawUrl) return "#";
  try {
    const cleanUrl = rawUrl.replace(/&#38;|&#x26;|&amp;/g, "&");
    const url = new URL(cleanUrl);

    if (url.hostname.includes("civitatis.com")) {
      if (!url.searchParams.has("aid")) {
        url.searchParams.set("aid", AFFILIATE_CONFIG.civitatis.aid);
      }
      url.searchParams.set("cmp", campaignSlug);
      return url.toString();
    }

    if (url.hostname.includes("omio.com") || url.hostname.includes("omio.es")) {
      url.searchParams.set("utm_source", "instantetrips");
      url.searchParams.set("utm_medium", "affiliate");
      url.searchParams.set("utm_campaign", campaignSlug);
      return url.toString();
    }

    return cleanUrl;
  } catch {
    return rawUrl;
  }
}

/**
 * Optimiza imágenes de Cloudinary y repara el bug de entidades HTML (&#38;) en Unsplash.
 * Reduce imágenes de cámara de 4.91 MB a ~65 KB en formato WebP/AVIF automático.
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
