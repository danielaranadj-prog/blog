const PRESET_HUBS = [
  {
    slug: 'espana',
    name: 'España',
    flag: '🇪🇸',
    region: 'Europa',
    eyebrow: 'HUB DE DESTINO · EUROPA',
    tagline: 'Alta velocidad low-cost, rutas gastronómicas sin trampas y escapadas históricas a menos de 1 hora.',
    description:
      'Guías prácticas de España probadas en persona: cómo moverte entre Madrid, Barcelona, Segovia y Valladolid en tren de alta velocidad desde 7€, cómo salir del aeropuerto sin pagar taxis abusivos y dónde comer como un local.',
    heroImage: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?auto=format&fit=crop&w=1200&q=80',
    matchKeywords: [
      'españa',
      'espana',
      'madrid',
      'barcelona',
      'segovia',
      'valladolid',
      'toledo',
      'sevilla',
      'valencia',
      'barajas',
      'atocha',
      'chamartin',
      'sants',
      'bernabeu',
      'ouigo',
      'iryo',
      'renfe',
      'ave',
    ],
    recommendationTags: ['españa', 'madrid', 'barcelona', 'tren', 'alta velocidad'],
    facts: [
      { label: 'Moneda y Pagos', value: 'Euro (€) · Tarjeta y Contactless aceptados en el 99% de locales' },
      { label: 'Transporte Estrella', value: 'Alta Velocidad (OUIGO, Iryo y AVE) + Cercanías al aeropuerto' },
      { label: 'Enchufes', value: 'Tipo C y F (230V) · Estándar europeo' },
      { label: 'Regla de Oro', value: 'Pide siempre "Menú del Día" al mediodía (14€–16€) y reserva trenes con antelación' },
    ],
  },
  {
    slug: 'argentina',
    name: 'Argentina',
    flag: '🇦🇷',
    region: 'Sudamérica',
    eyebrow: 'HUB DE DESTINO · SUDAMÉRICA',
    tagline: 'De los barrios históricos de Buenos Aires a los glaciares de El Chaltén, la Pampa y el Fin del Mundo en Ushuaia.',
    description:
      'Todo lo que necesitas para viajar por Argentina hoy: rutas a pie por Buenos Aires, trekking en la Patagonia (El Chaltén y Tierra del Fuego), estancias en la Pampa y consejos reales sobre cambio de moneda y transporte local.',
    heroImage: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?auto=format&fit=crop&w=1200&q=80',
    matchKeywords: [
      'argentina',
      'buenos aires',
      'patagonia',
      'ushuaia',
      'chalten',
      'el chalten',
      'calafate',
      'pampa',
      'tierra del fuego',
      'beagle',
      'recoleta',
      'palermo',
      'san telmo',
      'fitz roy',
    ],
    recommendationTags: ['argentina', 'buenos aires', 'patagonia', 'ushuaia'],
    facts: [
      { label: 'Moneda y Pagos', value: 'Peso Argentino (ARS) · Tarjetas extranjeras aplican tipo de cambio MEP' },
      { label: 'Transporte Local', value: 'Tarjeta SUBE (Subte y Colectivos), Uber/Cabify y vuelos domésticos' },
      { label: 'Enchufes', value: 'Tipo I (tres patitas planas en V) y Tipo C (220V)' },
      { label: 'Regla de Oro', value: 'En Patagonia reserva alojamiento y excursiones con meses de anticipación' },
    ],
  },
  {
    slug: 'belgica',
    name: 'Bélgica',
    flag: '🇧🇪',
    region: 'Europa',
    eyebrow: 'HUB DE DESTINO · EUROPA',
    tagline: 'Ciudades medievales de cuento, canales en Brujas y Gante, y la red ferroviaria más fácil de Europa.',
    description:
      'Guías prácticas para recorrer Bruselas, Brujas y Gante sin pagar tours inflados: cómo aprovechar el Weekend Ticket de tren al 50% de descuento y qué ver en 1, 2 o 3 días.',
    heroImage: 'https://images.unsplash.com/photo-1491557345352-5929e343eb89?auto=format&fit=crop&w=1200&q=80',
    matchKeywords: ['belgica', 'bélgica', 'bruselas', 'brujas', 'gante', 'amberes', 'flandes'],
    recommendationTags: ['bélgica', 'bruselas', 'brujas', 'europa'],
    facts: [
      { label: 'Moneda y Pagos', value: 'Euro (€) · Pago con tarjeta o móvil incluso en puestos callejeros' },
      { label: 'Transporte Estrella', value: 'Trenes nacionales SNCB (sin reserva de asiento y 50% dto en fin de semana)' },
      { label: 'Enchufes', value: 'Tipo C y E (230V) · Estándar europeo' },
      { label: 'Regla de Oro', value: 'Viaja entre Bruselas, Brujas y Gante en sábado o domingo con el Weekend Ticket' },
    ],
  },
];

function normalizeText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function slugifyCountry(value = '') {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildCountryHubs(allPosts = []) {
  const hubsMap = new Map(
    PRESET_HUBS.map((hub) => [
      hub.slug,
      {
        ...hub,
        posts: [],
      },
    ])
  );

  for (const post of allPosts) {
    const fm = post.frontmatter || {};
    const rawTags = [...(Array.isArray(fm.tags) ? fm.tags : []), ...(fm.destination ? [fm.destination] : [])];
    const searchBlob = normalizeText(`${fm.title || ''} ${fm.description || ''} ${rawTags.join(' ')}`);

    let matchedAny = false;
    for (const preset of PRESET_HUBS) {
      const matches = preset.matchKeywords.some((kw) => searchBlob.includes(normalizeText(kw)));
      if (matches) {
        hubsMap.get(preset.slug).posts.push(post);
        matchedAny = true;
      }
    }

    // Si en el futuro el autor crea un artículo con un campo `destination` de un país nuevo desde /editor,
    // se genera su Hub automáticamente sin tocar código.
    if (!matchedAny && fm.destination) {
      const customSlug = slugifyCountry(fm.destination);
      if (customSlug) {
        if (!hubsMap.has(customSlug)) {
          hubsMap.set(customSlug, {
            slug: customSlug,
            name: String(fm.destination).trim(),
            flag: '🌍',
            region: 'Destino Internacional',
            eyebrow: 'HUB DE DESTINO',
            tagline: `Guías reales, rutas y presupuestos actualizados para viajar a ${fm.destination}.`,
            description: `Todos nuestros artículos, consejos prácticos y recomendaciones verificadas para organizar tu viaje a ${fm.destination}.`,
            heroImage: fm.heroImage || fm.heroImageLink || '/hero-bg.jpg',
            matchKeywords: [customSlug],
            recommendationTags: [String(fm.destination).trim()],
            facts: [
              { label: 'Destino', value: String(fm.destination).trim() },
              { label: 'Contenido', value: 'Guías verificadas en terreno por Instante Trips' },
            ],
            posts: [],
          });
        }
        hubsMap.get(customSlug).posts.push(post);
      }
    }
  }

  const hubs = Array.from(hubsMap.values()).map((hub) => {
    const sortedPosts = [...hub.posts].sort(
      (a, b) => new Date(b.frontmatter?.publishDate || 0).valueOf() - new Date(a.frontmatter?.publishDate || 0).valueOf()
    );
    return {
      ...hub,
      posts: sortedPosts,
      count: sortedPosts.length,
    };
  });

  return hubs.filter((h) => h.count > 0);
}

export { PRESET_HUBS, buildCountryHubs, normalizeText, slugifyCountry };
