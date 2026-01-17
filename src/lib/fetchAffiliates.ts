/**
 * fetchAffiliates.ts
 * Helper para leer configuración de affiliates desde Firestore en build time
 * Usado por todos los sitios Astro (destinos_argentina, blog, etc.)
 */

import { initializeApp, getApps, deleteApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyBdsu65Voj8en9u_7eL5q0YRFuCC7fUYWA",
    authDomain: "instantetrips-editor.firebaseapp.com",
    projectId: "instantetrips-editor",
};

export interface AffiliateConfig {
    booking: {
        affiliateId: string;
        enabled: boolean;
    };
    skyscanner: {
        affiliateTag: string;
        enabled: boolean;
    };
    civitatis: {
        affiliateId: string;
        enabled: boolean;
    };
    adsense: {
        publisherId: string;
        slots: {
            sidebar: string;
            inline: string;
        };
        enabled: boolean;
    };
}

// Valores por defecto en caso de que no exista el documento
const DEFAULT_CONFIG: AffiliateConfig = {
    booking: { affiliateId: '1234567', enabled: true },
    skyscanner: { affiliateTag: 'instante_trips', enabled: true },
    civitatis: { affiliateId: '12345', enabled: true },
    adsense: { publisherId: '', slots: { sidebar: '', inline: '' }, enabled: false },
};

// Cache para evitar múltiples llamadas a Firestore durante el build
let cachedConfig: AffiliateConfig | null = null;

export async function fetchAffiliates(): Promise<AffiliateConfig> {
    // Retornar cache si existe
    if (cachedConfig) {
        return cachedConfig;
    }

    try {
        // Limpiar apps existentes para evitar conflictos durante el build
        const existingApps = getApps();
        const appName = 'affiliate-fetch';
        let app = existingApps.find(a => a.name === appName);

        if (!app) {
            app = initializeApp(firebaseConfig, appName);
        }

        const db = getFirestore(app);
        const docRef = doc(db, 'config', 'affiliates');
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            cachedConfig = {
                booking: {
                    affiliateId: data.booking?.affiliateId || DEFAULT_CONFIG.booking.affiliateId,
                    enabled: data.booking?.enabled ?? DEFAULT_CONFIG.booking.enabled,
                },
                skyscanner: {
                    affiliateTag: data.skyscanner?.affiliateTag || DEFAULT_CONFIG.skyscanner.affiliateTag,
                    enabled: data.skyscanner?.enabled ?? DEFAULT_CONFIG.skyscanner.enabled,
                },
                civitatis: {
                    affiliateId: data.civitatis?.affiliateId || DEFAULT_CONFIG.civitatis.affiliateId,
                    enabled: data.civitatis?.enabled ?? DEFAULT_CONFIG.civitatis.enabled,
                },
                adsense: {
                    publisherId: data.adsense?.publisherId || DEFAULT_CONFIG.adsense.publisherId,
                    slots: {
                        sidebar: data.adsense?.slots?.sidebar || DEFAULT_CONFIG.adsense.slots.sidebar,
                        inline: data.adsense?.slots?.inline || DEFAULT_CONFIG.adsense.slots.inline,
                    },
                    enabled: data.adsense?.enabled ?? DEFAULT_CONFIG.adsense.enabled,
                },
            };
            return cachedConfig;
        }

        console.warn('[fetchAffiliates] Documento config/affiliates no encontrado, usando valores por defecto');
        cachedConfig = DEFAULT_CONFIG;
        return cachedConfig;

    } catch (error) {
        console.error('[fetchAffiliates] Error:', error);
        // En caso de error, usar valores por defecto
        return DEFAULT_CONFIG;
    }
}

// Helper para obtener solo un servicio específico
export async function getBookingConfig() {
    const config = await fetchAffiliates();
    return config.booking;
}

export async function getSkyscannerConfig() {
    const config = await fetchAffiliates();
    return config.skyscanner;
}

export async function getCivitatisConfig() {
    const config = await fetchAffiliates();
    return config.civitatis;
}

export async function getAdsenseConfig() {
    const config = await fetchAffiliates();
    return config.adsense;
}
