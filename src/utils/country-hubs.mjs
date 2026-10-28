const PRESET_HUBS = [
  {
    slug: 'espana',
    name: 'España',
    flag: '🇪🇸',
    region: 'Europa',
    eyebrow: 'DESTINOS · EUROPA',
    tagline: 'Historias y rutas por Madrid, Barcelona y Segovia. Trenes, escapadas y decisiones de viaje.',
    description:
      'Nuestras historias de España: cómo moverte entre ciudades, preparar una escapada y aprovechar lo aprendido en cada viaje.',
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
    ],
    recommendationTags: ['españa', 'madrid', 'barcelona', 'tren', 'alta velocidad'],
    facts: [
      { label: 'Moneda y Pagos', value: 'Euro (€)' },
      { label: 'Transporte Estrella', value: 'Trenes y transporte urbano' },
      { label: 'Enchufes', value: 'Tipo C y F (230V) · Estándar europeo' },
      { label: 'Regla de Oro', value: 'Compara el coste completo del trayecto, incluido el equipaje' },
    ],
  },
  {
    slug: 'argentina',
    name: 'Argentina',
    flag: '🇦🇷',
    region: 'Sudamérica',
    eyebrow: 'DESTINOS · SUDAMÉRICA',
    tagline: 'De las calles de Buenos Aires al Fin del Mundo en Ushuaia. Dos formas de conocer Argentina.',
    description:
      'Las guías de Argentina que hemos publicado: recorridos por Buenos Aires, experiencias en Ushuaia y consejos para preparar tu ruta.',
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
      { label: 'Moneda y Pagos', value: 'Peso argentino (ARS)' },
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
    eyebrow: 'DESTINOS · EUROPA',
    tagline: 'Una escapada de Bruselas a Brujas, entre estaciones, plazas y canales.',
    description:
      'Nuestra guía para visitar Brujas desde Bruselas: el recorrido, los desplazamientos y las decisiones que tomamos durante el viaje.',
    heroImage: 'https://images.unsplash.com/photo-1769369117276-9a6d717c8363?auto=format&fit=crop&w=1200&q=80',
    matchKeywords: ['belgica', 'bélgica', 'bruselas', 'brujas', 'gante', 'amberes', 'flandes'],
    recommendationTags: ['bélgica', 'bruselas', 'brujas', 'europa'],
    facts: [
      { label: 'Moneda y Pagos', value: 'Euro (€)' },
      { label: 'Transporte Estrella', value: 'Trenes nacionales SNCB' },
      { label: 'Enchufes', value: 'Tipo C y E (230V) · Estándar europeo' },
      { label: 'Regla de Oro', value: 'Consulta las tarifas vigentes en belgiantrain.be antes de reservar' },
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

function containsPlace(value,keyword) {
  const words=` ${normalizeText(value).replace(/[^a-z0-9]+/g,' ')} `;
  return words.includes(` ${normalizeText(keyword).replace(/[^a-z0-9]+/g,' ')} `);
}
function buildCountryHubs(allPosts = []) {
  const hubsMap=new Map(PRESET_HUBS.map(hub=>[hub.slug,{...hub,posts:[]}]));
  for(const post of allPosts){
    const fm=post.frontmatter||{},destination=String(fm.destination||'').trim();
    const tags=Array.isArray(fm.tags)?fm.tags:[];
    const match=value=>PRESET_HUBS.filter(hub=>hub.matchKeywords.some(word=>containsPlace(value,word)));
    // An explicit destination takes priority over incidental mentions in a title or description.
    let matches=destination?match(destination):[];
    if(!destination){
      matches=PRESET_HUBS.filter(hub=>tags.some(tag=>hub.matchKeywords.some(word=>containsPlace(tag,word))));
      if(!matches.length)matches=match(fm.title||'');
    }
    for(const hub of matches)hubsMap.get(hub.slug).posts.push(post);
    if(destination&&!matches.length){
      const slug=slugifyCountry(destination);if(!slug)continue;
      if(!hubsMap.has(slug))hubsMap.set(slug,{slug,name:destination,flag:'',region:'Destino',eyebrow:'DESTINOS',tagline:`Historias y guías de ${destination}.`,description:`Las historias de ${destination} publicadas en Instante Trips, reunidas para preparar tu viaje.`,heroImage:fm.heroImage||fm.heroImageLink||'/hero-bg.jpg',recommendationTags:[destination],facts:[],posts:[]});
      hubsMap.get(slug).posts.push(post);
    }
  }
  return Array.from(hubsMap.values()).map(hub=>{
    const posts=[...hub.posts].sort((a,b)=>new Date(b.frontmatter?.publishDate||0)-new Date(a.frontmatter?.publishDate||0));
    return {...hub,posts,count:posts.length};
  }).filter(hub=>hub.count>0);
}
export { PRESET_HUBS, buildCountryHubs, normalizeText, slugifyCountry };
