export type Author = {
  slug: string;
  name: string;
  role: string;
  bio: string;
  image: string;
  email?: string;
};

export const AUTHORS: Record<string, Author> = {
  'daniel-arana': {
    slug: 'daniel-arana',
    name: 'Daniel Arana',
    role: 'Founder & Creative Director',
    bio: 'Director Creativo y fundador de InstanteTrips.',
    image: '/assets/autores/daniel-arana-1768646139740.jpg',
    email: 'danielaranadj@gmail.com',
  },

  'edgar-arana': {
    slug: 'edgar-arana',
    name: 'Edgar Arana',
    role: 'Logistics & Planning',
    bio: 'Amante de las rutas largas, la logística y los viajes bien planeados.',
    image: '/assets/autores/edgar-arana.jpg',
  },

  'jonathan-arana': {
    slug: 'jonathan-arana',
    name: 'Jonathan Arana',
    role: 'Lead Photographer',
    bio: 'Fotógrafo de viajes. Buscando historias en cada encuadre.',
    image: '/assets/autores/jonathan-arana.jpg',
  },

};

export const DEFAULT_AUTHOR = AUTHORS['daniel-arana'] || Object.values(AUTHORS)[0];