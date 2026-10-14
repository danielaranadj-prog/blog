/**
 * Tours Manager - Multi-Country Support
 * Manages tours for Argentina, España, México
 */

// Available countries
const COUNTRIES = [
    { id: 'argentina', name: 'Argentina', flag: '🇦🇷', cities: ['buenos-aires', 'el-calafate', 'el-chalten', 'iguazu', 'mendoza', 'ushuaia', 'rosario'] },
    { id: 'espana', name: 'España', flag: '🇪🇸', cities: ['madrid', 'barcelona', 'sevilla', 'granada', 'valencia', 'bilbao'] },
    { id: 'mexico', name: 'México', flag: '🇲🇽', cities: ['cdmx', 'cancun', 'oaxaca', 'guadalajara', 'merida', 'san-miguel'] }
];

let currentCountry = 'argentina';
let allTours = { argentina: [], espana: [], mexico: [] };

// Render country tabs
function renderCountryTabs() {
    const container = document.getElementById('tours-country-tabs');
    if (!container) return;

    container.innerHTML = COUNTRIES.map(c => `
        <button class="country-tab ${c.id === currentCountry ? 'active' : ''}" data-country="${c.id}">
            <span class="flag">${c.flag}</span>
            <span class="name">${c.name}</span>
            <span class="count">(${(allTours[c.id] || []).length})</span>
        </button>
    `).join('');

    container.querySelectorAll('.country-tab').forEach(btn => {
        btn.addEventListener('click', () => {
            currentCountry = btn.dataset.country;
            renderCountryTabs();
            renderToursGrid();
        });
    });
}

// Render tours grid
function renderToursGrid() {
    const container = document.getElementById('tours-grid');
    if (!container) return;

    const tours = allTours[currentCountry] || [];
    const country = COUNTRIES.find(c => c.id === currentCountry);

    if (tours.length === 0) {
        const isArgentina = currentCountry === 'argentina';
        container.innerHTML = `
            <div class="empty-state">
                <span class="icon">🎟️</span>
                <p>No hay tours en ${country.name} aún</p>
                <div style="display: flex; gap: 10px; justify-content: center; flex-wrap: wrap;">
                    <button onclick="openTourModal()" class="btn-primary" style="padding: 10px 20px; border-radius: 10px;">+ Agregar Tour</button>
                    ${isArgentina ? '<button onclick="migrateDefaultTours()" style="padding: 10px 20px; border-radius: 10px; background: #10b981; color: white; border: none; cursor: pointer;">📥 Cargar 14 tours por defecto</button>' : ''}
                </div>
            </div>
        `;
        return;
    }

    container.innerHTML = tours.map((tour, idx) => `
        <div class="tour-card-admin" data-idx="${idx}">
            <div class="tour-img" style="background-image: url('${tour.imagen}')">
                <span class="tour-ciudad">${tour.ciudad}</span>
            </div>
            <div class="tour-info">
                <h4>${tour.titulo}</h4>
                <div class="tour-meta">
                    <span class="precio">${tour.precio}</span>
                    <span class="duracion">${tour.duracion}</span>
                </div>
            </div>
            <div class="tour-actions">
                <button onclick="editTour(${idx})" class="btn-edit" title="Editar">
                    <ion-icon name="create-outline"></ion-icon>
                </button>
                <button onclick="deleteTour(${idx})" class="btn-delete" title="Eliminar">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
        </div>
    `).join('');
}

// Open tour modal (create/edit)
let editingTourIdx = null;

window.openTourModal = (idx = null) => {
    editingTourIdx = idx;
    const modal = document.getElementById('tour-modal');
    const country = COUNTRIES.find(c => c.id === currentCountry);

    // Populate city dropdown
    const citySelect = document.getElementById('tour-ciudad');
    citySelect.innerHTML = country.cities.map(c =>
        `<option value="${c}">${c.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>`
    ).join('');

    if (idx !== null) {
        // Edit mode
        const tour = allTours[currentCountry][idx];
        document.getElementById('tour-modal-title').textContent = 'Editar Tour';
        document.getElementById('tour-titulo').value = tour.titulo;
        document.getElementById('tour-ciudad').value = tour.ciudad;
        document.getElementById('tour-precio').value = tour.precio;
        document.getElementById('tour-duracion').value = tour.duracion;
        document.getElementById('tour-imagen').value = tour.imagen;
        document.getElementById('tour-link').value = tour.linkAfiliado || tour.link || '';
    } else {
        // Create mode
        document.getElementById('tour-modal-title').textContent = 'Nuevo Tour';
        document.getElementById('tour-titulo').value = '';
        document.getElementById('tour-precio').value = 'US$ ';
        document.getElementById('tour-duracion').value = '';
        document.getElementById('tour-imagen').value = '';
        document.getElementById('tour-link').value = '';
    }

    modal.classList.add('open');
};

window.closeTourModal = () => {
    document.getElementById('tour-modal').classList.remove('open');
    editingTourIdx = null;
};

window.editTour = (idx) => openTourModal(idx);

window.deleteTour = async (idx) => {
    if (!confirm('¿Eliminar este tour?')) return;

    allTours[currentCountry].splice(idx, 1);
    await saveToursToFirestore();
    renderCountryTabs();
    renderToursGrid();
    showToast('Tour eliminado');
};

window.saveTour = async () => {
    const tour = {
        id: document.getElementById('tour-titulo').value.toLowerCase().replace(/\s+/g, '-').substring(0, 20),
        pais: currentCountry,
        ciudad: document.getElementById('tour-ciudad').value,
        titulo: document.getElementById('tour-titulo').value.trim(),
        precio: document.getElementById('tour-precio').value.trim(),
        duracion: document.getElementById('tour-duracion').value.trim(),
        imagen: document.getElementById('tour-imagen').value.trim(),
        linkAfiliado: document.getElementById('tour-link').value.trim(),
        activo: true
    };

    if (!tour.titulo || !tour.ciudad) {
        showToast('Título y ciudad son requeridos', 'error');
        return;
    }

    if (editingTourIdx !== null) {
        allTours[currentCountry][editingTourIdx] = tour;
    } else {
        allTours[currentCountry].push(tour);
    }

    await saveToursToFirestore();
    closeTourModal();
    renderCountryTabs();
    renderToursGrid();
    showToast(editingTourIdx !== null ? 'Tour actualizado' : 'Tour creado');
};

// Firestore integration
async function loadToursFromFirestore() {
    try {
        const docRef = window.firestoreDoc(window.firestoreDB, 'config', 'tours');
        const docSnap = await window.firestoreGetDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            allTours = {
                argentina: data.argentina || [],
                espana: data.espana || [],
                mexico: data.mexico || []
            };
        }
    } catch (error) {
        console.error('Error loading tours:', error);
    }
}

async function saveToursToFirestore() {
    try {
        const docRef = window.firestoreDoc(window.firestoreDB, 'config', 'tours');
        await window.firestoreSetDoc(docRef, allTours, { merge: true });
    } catch (error) {
        console.error('Error saving tours:', error);
        showToast('Error al guardar', 'error');
    }
}

// Initialize Tours Manager
window.initToursManager = async () => {
    await loadToursFromFirestore();
    renderCountryTabs();
    renderToursGrid();
};

// Toast helper
function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Default tours for Argentina (for migration)
const DEFAULT_ARGENTINA_TOURS = [
    { id: "tango-cena", pais: "argentina", ciudad: "buenos-aires", titulo: "Tour de Tango & Cena Show", precio: "US$ 80", duracion: "4 horas", imagen: "https://images.unsplash.com/photo-1543167822-04c9955767f4?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/buenos-aires/cena-tango-buenos-aires/?aid=12345", activo: true },
    { id: "delta-tigre", pais: "argentina", ciudad: "buenos-aires", titulo: "Navegación Delta del Tigre", precio: "US$ 45", duracion: "Medio día", imagen: "https://images.unsplash.com/photo-1534234828563-0aa7cbed99b9?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/buenos-aires/excursion-tigre-delta/?aid=12345", activo: true },
    { id: "boca-juniors", pais: "argentina", ciudad: "buenos-aires", titulo: "Experiencia Boca Juniors", precio: "US$ 50", duracion: "3 horas", imagen: "https://images.unsplash.com/photo-1626025437642-0b05076ca301?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/buenos-aires/tour-la-boca-san-telmo/?aid=12345", activo: true },
    { id: "minitrekking", pais: "argentina", ciudad: "el-calafate", titulo: "Minitrekking Perito Moreno", precio: "US$ 250", duracion: "Día completo", imagen: "https://images.unsplash.com/photo-1518182170546-0766ce6fec56?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/el-calafate/minitrekking-glaciar-perito-moreno/?aid=12345", activo: true },
    { id: "todo-glaciares", pais: "argentina", ciudad: "el-calafate", titulo: "Navegación Todo Glaciares", precio: "US$ 180", duracion: "Día completo", imagen: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/el-calafate/paseo-barco-glaciares/?aid=12345", activo: true },
    { id: "estancia-cristina", pais: "argentina", ciudad: "el-calafate", titulo: "Estancia Cristina 4x4", precio: "US$ 150", duracion: "Día completo", imagen: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/el-calafate/excursion-estancia-cristina/?aid=12345", activo: true },
    { id: "fitz-roy", pais: "argentina", ciudad: "el-chalten", titulo: "Trekking Guiado Fitz Roy", precio: "US$ 90", duracion: "10 horas", imagen: "https://images.unsplash.com/photo-1589553416260-f586c8f1514f?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/el-chalten/trekking-fitz-roy/?aid=12345", activo: true },
    { id: "rafting-vueltas", pais: "argentina", ciudad: "el-chalten", titulo: "Rafting Río de las Vueltas", precio: "US$ 60", duracion: "4 horas", imagen: "https://images.unsplash.com/photo-1530866495561-507c9faab2ed?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/el-chalten/rafting-rio-vueltas/?aid=12345", activo: true },
    { id: "gran-aventura", pais: "argentina", ciudad: "iguazu", titulo: "Gran Aventura (Gomón)", precio: "US$ 70", duracion: "2 horas", imagen: "https://images.unsplash.com/photo-1582234032483-29479b18752c?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/cataratas-iguazu/cataratas-argentina/?aid=12345", activo: true },
    { id: "lado-brasileno", pais: "argentina", ciudad: "iguazu", titulo: "Tour Lado Brasileño", precio: "US$ 45", duracion: "Medio día", imagen: "https://images.unsplash.com/photo-1534069873406-80512803b9b0?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/cataratas-iguazu/cataratas-brasil/?aid=12345", activo: true },
    { id: "bodegas-lujan", pais: "argentina", ciudad: "mendoza", titulo: "Tour Bodegas Luján", precio: "US$ 110", duracion: "Día completo", imagen: "https://images.unsplash.com/photo-1516594915697-87eb3b1c14ea?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/mendoza/tour-bodega-mendoza/?aid=12345", activo: true },
    { id: "alta-montana", pais: "argentina", ciudad: "mendoza", titulo: "Alta Montaña", precio: "US$ 65", duracion: "Día completo", imagen: "https://images.unsplash.com/photo-1621257492476-c4d370150993?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/mendoza/excursion-alta-montana/?aid=12345", activo: true },
    { id: "canal-beagle", pais: "argentina", ciudad: "ushuaia", titulo: "Navegación Canal Beagle", precio: "US$ 70", duracion: "3 horas", imagen: "https://images.unsplash.com/photo-1548291673-30541797c552?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/ushuaia/paseo-barco-canal-beagle/?aid=12345", activo: true },
    { id: "laguna-esmeralda", pais: "argentina", ciudad: "ushuaia", titulo: "Trekking Laguna Esmeralda", precio: "US$ 80", duracion: "6 horas", imagen: "https://images.unsplash.com/photo-1478131143081-80f7f84ca84d?auto=format&fit=crop&w=600&q=80", linkAfiliado: "https://www.civitatis.com/es/ushuaia/trekking-laguna-esmeralda/?aid=12345", activo: true },
];

// Migrate default tours to Firestore
window.migrateDefaultTours = async () => {
    if (allTours.argentina.length > 0) {
        if (!confirm('Ya existen tours en Argentina. ¿Reemplazar con los tours por defecto?')) return;
    }

    allTours.argentina = [...DEFAULT_ARGENTINA_TOURS];
    await saveToursToFirestore();
    renderCountryTabs();
    renderToursGrid();
    showToast('14 tours de Argentina migrados a Firestore');
};

// Export
window.COUNTRIES = COUNTRIES;
window.allTours = allTours;
window.currentCountry = currentCountry;
window.DEFAULT_ARGENTINA_TOURS = DEFAULT_ARGENTINA_TOURS;
