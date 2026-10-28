/**
 * Sistema de Acortador de Links y Generador de Slugs Cortos (Instante Trips)
 * 1. Genera slugs cortos eliminando palabras vacías en español (máx 4-5 palabras clave).
 * 2. Genera enlaces ultracortos (/ir/alias) para compartir en TikTok, Instagram, WhatsApp y YouTube,
 *    incluso para artículos antiguos que se publicaron con URLs largas.
 */

export const SPANISH_STOPWORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'al', 'a', 'en', 'con', 'sin', 'por', 'para',
  'como', 'que', 'cual', 'cuales', 'mi', 'mis', 'tu', 'tus', 'su', 'sus',
  'este', 'esta', 'esto', 'estos', 'estas', 'ese', 'esa', 'esos', 'esas',
  'muy', 'mas', 'pero', 'si', 'no', 'ya', 'casi', 'me', 'te', 'se', 'lo', 'le', 'les', 'nos',
  'fue', 'son', 'es', 'era', 'o', 'u', 'y', 'e', 'ni', 'sobre', 'entre', 'hasta', 'desde',
  'hacia', 'donde', 'cuando', 'quien', 'porque', 'todo', 'toda', 'todos', 'todas',
  'otro', 'otra', 'otros', 'otras', 'mismo', 'misma', 'tan', 'tanto', 'tanta',
  'algo', 'nada', 'poco', 'mucho', 'mucha', 'hacer', 'hice', 'hacerlo', 'ir', 'ver', 'usar'
]);

/**
 * Alias cortos oficiales para los artículos existentes con URLs largas.
 */
export const LEGACY_SHORT_ALIASES = {
  '2026-01-23--misi-n-imposible-c-mo-consegu-mi-entrada-para-ver-al-real-madrid-y-por-qu-madrugar-vali-la-pena-': 'real-madrid',
  '2026-02-01--viaj-por-7-mi-secreto-para-usar-la-alta-velocidad-en-espa-a': 'trenes-7e',
  '2026-02-03--tren-o-avi-n-a-barcelona-este-error-casi-me-cuesta-muy-caro': 'tren-barcelona',
  '2026-01-17-el-vuelo-barato-existe-nom-s-hay-que-saber-buscarle-': 'vuelos-baratos',
  'barcelona-10-minutos-de-terror-y-lo-único-que-me-salvó': 'barcelona-seguro',
  'barcelona-10-minutos-de-terror-y-lo-unico-que-me-salvo': 'barcelona-seguro',
  '2026-01-17-buenos-aires-5-dias-guia-real': 'buenos-aires',
  '2026-01-17-ushuaia-guia-fin-del-mundo': 'ushuaia',
  'madrid-traslados': 'barajas-madrid',
  'bruselas-brujas': 'bruselas-brujas',
  'segovia': 'segovia',
};

/**
 * Genera un slug corto e inteligente quitando palabras de relleno en español.
 */
export function smartShortSlug(value, { maxWords = 5, maxLength = 42 } = {}) {
  const normalized = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  // Quitar prefijo de fecha si viene de un nombre de archivo antiguo (ej. 2026-01-23-)
  const withoutDate = normalized.replace(/^\d{4}-\d{2}-\d{2}-+/, '');
  const tokens = withoutDate.match(/[a-z0-9]+/g) || [];
  if (!tokens.length) return 'historia';

  // Si ya es corto (<= 3 palabras y <= 30 caracteres), mantener íntegro
  const rawJoined = tokens.join('-');
  if (tokens.length <= maxWords && rawJoined.length <= maxLength) {
    return rawJoined;
  }

  const meaningful = tokens.filter((w) => !SPANISH_STOPWORDS.has(w) && (w.length > 1 || /\d/.test(w)));
  const pool = meaningful.length >= 2 ? meaningful : tokens;

  const selected = [];
  let currentLen = 0;
  for (const word of pool) {
    if (selected.length >= maxWords) break;
    const nextLen = currentLen === 0 ? word.length : currentLen + 1 + word.length;
    if (nextLen > maxLength && selected.length >= 2) break;
    selected.push(word);
    currentLen = nextLen;
  }

  return selected.join('-').slice(0,maxLength).replace(/^-|-$/g, '') || 'historia';
}

/**
 * Devuelve el alias corto (/ir/<alias>) para cualquier artículo (nuevo o antiguo).
 */
export function getShortAlias({ filename = '', urlSlug = '', title = '' } = {}) {
  const cleanFile = String(filename || '')
    .replace(/\.md$/i, '')
    .replace(/^\/+|\/+$/g, '')
    .replace(/^posts\//, '');

  const decodedFile = (() => {
    try {
      return decodeURIComponent(cleanFile);
    } catch {
      return cleanFile;
    }
  })();

  if (LEGACY_SHORT_ALIASES[decodedFile]) return LEGACY_SHORT_ALIASES[decodedFile];
  if (LEGACY_SHORT_ALIASES[cleanFile]) return LEGACY_SHORT_ALIASES[cleanFile];

  const stableSource = decodedFile || urlSlug || title;
  if (stableSource) return smartShortSlug(stableSource, { maxWords: 3, maxLength: 26 });

  return 'guia';
}

export function getShortUrl(info, siteOrigin = 'https://www.instantetrips.com') {
  const alias = getShortAlias(info);
  return `${siteOrigin.replace(/\/$/, '')}/ir/${alias}`;
}
