export type Author = {
  slug: string;
  name: string;
  bio: string;
  image: string;
};

export const AUTHORS: Record<string, Author> = {
  'daniel-arana': {
    slug: 'daniel-arana',
    name: 'Daniel Arana',
    bio: 'Director de arte y viajero obsesivo del detalle. Aquí comparto lo que las guías no te cuentan.',
    image: '/assets/autores/daniel-arana.jpg',
  },

  'betzy-miramontes': {
    slug: 'betzy-miramontes',
    name: 'Betzy Miramontes',
    bio: 'Exploradora gastronómica y storyteller. Viajar también se come.',
    image: '/assets/autores/betzy-miramontes.jpg',
  },

  'edgar-arana': {
    slug: 'edgar-arana',
    name: 'Edgar Arana',
    bio: 'Amante de las rutas largas, la logística y los viajes bien planeados.',
    image: '/assets/autores/edgar-arana.jpg',
  },

  'jonathan-arana': {
    slug: 'jonathan-arana',
    name: 'Jonathan Arana',
    bio: 'Fotógrafo de viajes. Buscando historias en cada encuadre.',
    image: '/assets/autores/jonathan-arana.jpg',
  },
};

// Fallback editorial
export const DEFAULT_AUTHOR = AUTHORS['daniel-arana'];