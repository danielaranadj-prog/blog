/**
 * V3 Admin Editor Functions
 * Handles: checklist, barrios, experiencias, premiumGuide, gastronomia
 */

// ========== CHECKLIST V3 ==========
const CHECKLIST_EMOJIS = ['💸', '🚌', '📡', '🛡️', '🌡️', '📅', '💰', '🏨', '⚕️', '🎒'];

function renderChecklistEditor(checklist = []) {
    const container = document.getElementById('dest-checklist');
    if (!container) return;
    container.innerHTML = checklist.map((item, idx) => createChecklistHTML(item, idx)).join('');
}

function createChecklistHTML(item, idx) {
    return `
        <div class="bg-emerald-50 dark:bg-emerald-900/20 rounded-xl p-4 border border-emerald-200 dark:border-emerald-800" data-checklist-idx="${idx}">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-emerald-600">Item ${idx + 1}</span>
                <button onclick="removeChecklist(${idx})" class="text-red-400 hover:text-red-600">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
            <div class="grid grid-cols-4 gap-3 mb-3">
                <div>
                    <label class="text-[10px] text-gray-400">Emoji</label>
                    <select class="checklist-emoji w-full px-2 py-2 rounded-lg border dark:bg-slate-700 text-center text-lg">
                        ${CHECKLIST_EMOJIS.map(e => `<option value="${e}" ${e === item.emoji ? 'selected' : ''}>${e}</option>`).join('')}
                    </select>
                </div>
                <div class="col-span-3">
                    <label class="text-[10px] text-gray-400">Título</label>
                    <input type="text" class="checklist-titulo w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${item.titulo || ''}" placeholder="Dinero y Cambio">
                </div>
            </div>
            <div class="mb-3">
                <label class="text-[10px] text-gray-400">Detalle (**texto** para negrita)</label>
                <textarea class="checklist-detalle w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm resize-none" rows="2" 
                    placeholder="**Tip Pro:** Trae billetes de $100 USD...">${item.detalle || ''}</textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-[10px] text-gray-400">CTA (opcional)</label>
                    <input type="text" class="checklist-cta w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${item.cta || ''}" placeholder="⚡ Compra tu eSIM aquí">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400">Link CTA</label>
                    <input type="url" class="checklist-ctaLink w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${item.ctaLink || ''}" placeholder="https://airalo.com/?ref=...">
                </div>
            </div>
            <div class="mt-2">
                <label class="flex items-center gap-2 text-xs text-gray-500">
                    <input type="checkbox" class="checklist-recomendado rounded" ${item.ctaRecomendado ? 'checked' : ''}>
                    Marcar como "Recomendado" (verde destacado)
                </label>
            </div>
        </div>
    `;
}

window.addChecklist = () => {
    const container = document.getElementById('dest-checklist');
    const idx = container.children.length;
    container.insertAdjacentHTML('beforeend', createChecklistHTML({ emoji: '💸', titulo: '', detalle: '' }, idx));
};

window.removeChecklist = (idx) => {
    const items = document.querySelectorAll('#dest-checklist > div');
    if (items[idx]) items[idx].remove();
    reindexItems('#dest-checklist', 'Item');
};

// ========== BARRIOS V3 ==========
const BARRIO_COLORS = ['#a855f7', '#3b82f6', '#f97316', '#10b981', '#eab308', '#ef4444'];

function renderBarriosEditor(barrios = []) {
    const container = document.getElementById('dest-barrios');
    if (!container) return;
    container.innerHTML = barrios.map((b, idx) => createBarrioHTML(b, idx)).join('');
}

function createBarrioHTML(barrio, idx) {
    return `
        <div class="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800" data-barrio-idx="${idx}">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-purple-600">Barrio ${idx + 1}</span>
                <button onclick="removeBarrio(${idx})" class="text-red-400 hover:text-red-600">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
            <div class="grid grid-cols-2 gap-3 mb-3">
                <div>
                    <label class="text-[10px] text-gray-400">Nombre</label>
                    <input type="text" class="barrio-nombre w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${barrio.nombre || ''}" placeholder="Palermo">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400">Color Tag</label>
                    <select class="barrio-color w-full px-2 py-2 rounded-lg border dark:bg-slate-700 text-sm">
                        ${BARRIO_COLORS.map(c => `<option value="${c}" ${c === barrio.colorTag ? 'selected' : ''} style="background:${c};color:white">${c}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="mb-3">
                <label class="text-[10px] text-gray-400">Vibra (ej: 🍸 Trendy, Diseño, Vida Nocturna)</label>
                <input type="text" class="barrio-vibra w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                    value="${barrio.vibra || ''}" placeholder="🍸 Trendy, Diseño, Vida Nocturna">
            </div>
            <div class="mb-3">
                <label class="text-[10px] text-gray-400">Ideal para</label>
                <input type="text" class="barrio-ideal w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                    value="${barrio.idealPara || ''}" placeholder="Salir a comer, bares y compras">
            </div>
            <div>
                <label class="text-[10px] text-gray-400">Imagen URL</label>
                <input type="url" class="barrio-imagen w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                    value="${barrio.imagen || ''}" placeholder="https://images.unsplash.com/...">
            </div>
        </div>
    `;
}

window.addBarrio = () => {
    const container = document.getElementById('dest-barrios');
    const idx = container.children.length;
    container.insertAdjacentHTML('beforeend', createBarrioHTML({ colorTag: '#a855f7' }, idx));
};

window.removeBarrio = (idx) => {
    const items = document.querySelectorAll('#dest-barrios > div');
    if (items[idx]) items[idx].remove();
    reindexItems('#dest-barrios', 'Barrio');
};

// ========== EXPERIENCIAS V3 ==========
const EXP_TAGS = [
    { tag: 'GRATIS', color: '#10b981' },
    { tag: 'PREMIUM', color: '#d97706' },
    { tag: 'ICONO', color: '#3b82f6' },
    { tag: 'CULTURA', color: '#8b5cf6' },
    { tag: 'ESCAPADA', color: '#06b6d4' },
    { tag: 'GRATIS / TOUR', color: '#10b981' }
];

function renderExperienciasEditor(experiencias = []) {
    const container = document.getElementById('dest-experiencias');
    if (!container) return;
    container.innerHTML = experiencias.map((e, idx) => createExperienciaHTML(e, idx)).join('');
}

function createExperienciaHTML(exp, idx) {
    return `
        <div class="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800" data-exp-idx="${idx}">
            <div class="flex items-center justify-between mb-3">
                <span class="text-xs font-bold text-amber-600">Experiencia ${idx + 1}</span>
                <button onclick="removeExperiencia(${idx})" class="text-red-400 hover:text-red-600">
                    <ion-icon name="trash-outline"></ion-icon>
                </button>
            </div>
            <div class="grid grid-cols-4 gap-3 mb-3">
                <div>
                    <label class="text-[10px] text-gray-400">Icono</label>
                    <input type="text" class="exp-icono w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-center text-lg" 
                        value="${exp.icono || '🎯'}" placeholder="🏛️">
                </div>
                <div class="col-span-2">
                    <label class="text-[10px] text-gray-400">Título</label>
                    <input type="text" class="exp-titulo w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${exp.titulo || ''}" placeholder="Plaza de Mayo y Casa Rosada">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400">Tag</label>
                    <select class="exp-tag w-full px-2 py-2 rounded-lg border dark:bg-slate-700 text-sm">
                        ${EXP_TAGS.map(t => `<option value="${t.tag}" data-color="${t.color}" ${t.tag === exp.tag ? 'selected' : ''}>${t.tag}</option>`).join('')}
                    </select>
                </div>
            </div>
            <div class="mb-3">
                <label class="text-[10px] text-gray-400">Descripción</label>
                <textarea class="exp-descripcion w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm resize-none" rows="2" 
                    placeholder="El corazón político del país...">${exp.descripcion || ''}</textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div>
                    <label class="text-[10px] text-gray-400">CTA (opcional)</label>
                    <input type="text" class="exp-cta w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${exp.cta || ''}" placeholder="🎟️ Reservar Show con Cena">
                </div>
                <div>
                    <label class="text-[10px] text-gray-400">Link Afiliado</label>
                    <input type="url" class="exp-ctaLink w-full px-3 py-2 rounded-lg border dark:bg-slate-700 text-sm" 
                        value="${exp.ctaLink || ''}" placeholder="https://civitatis.com/...">
                </div>
            </div>
        </div>
    `;
}

window.addExperiencia = () => {
    const container = document.getElementById('dest-experiencias');
    const idx = container.children.length;
    container.insertAdjacentHTML('beforeend', createExperienciaHTML({ icono: '🎯', tag: 'GRATIS' }, idx));
};

window.removeExperiencia = (idx) => {
    const items = document.querySelectorAll('#dest-experiencias > div');
    if (items[idx]) items[idx].remove();
    reindexItems('#dest-experiencias', 'Experiencia');
};

// ========== PREMIUM GUIDE V3 ==========
function loadPremiumGuide(pg = {}) {
    document.getElementById('dest-premium-titulo').value = pg.titulo || '';
    document.getElementById('dest-premium-subtitulo').value = pg.subtitulo || '';
    document.getElementById('dest-premium-beneficios').value = (pg.beneficios || []).join('\n');
    document.getElementById('dest-premium-precioOriginal').value = pg.precioOriginal || '29.99';
    document.getElementById('dest-premium-precioOferta').value = pg.precioOferta || '9.99';
    document.getElementById('dest-premium-link').value = pg.link || '';
}

function collectPremiumGuide() {
    const titulo = document.getElementById('dest-premium-titulo').value.trim();
    if (!titulo) return null;

    return {
        titulo,
        subtitulo: document.getElementById('dest-premium-subtitulo').value.trim(),
        beneficios: document.getElementById('dest-premium-beneficios').value.split('\n').filter(b => b.trim()),
        precioOriginal: document.getElementById('dest-premium-precioOriginal').value.trim(),
        precioOferta: document.getElementById('dest-premium-precioOferta').value.trim(),
        moneda: 'USD',
        link: document.getElementById('dest-premium-link').value.trim() || '/planifica/'
    };
}

// ========== HELPER FUNCTIONS ==========
function reindexItems(selector, label) {
    document.querySelectorAll(`${selector} > div`).forEach((el, i) => {
        el.querySelector('span').textContent = `${label} ${i + 1}`;
        const idxAttr = Object.keys(el.dataset).find(k => k.endsWith('Idx'));
        if (idxAttr) el.dataset[idxAttr] = i;
    });
}

function collectChecklist() {
    const items = [];
    document.querySelectorAll('#dest-checklist > div').forEach(el => {
        const titulo = el.querySelector('.checklist-titulo').value.trim();
        if (titulo) {
            items.push({
                icono: 'fa-' + (el.querySelector('.checklist-emoji').value === '💸' ? 'money-bill-wave' : 'check'),
                titulo,
                emoji: el.querySelector('.checklist-emoji').value,
                detalle: el.querySelector('.checklist-detalle').value.trim(),
                cta: el.querySelector('.checklist-cta').value.trim() || undefined,
                ctaLink: el.querySelector('.checklist-ctaLink').value.trim() || undefined,
                ctaRecomendado: el.querySelector('.checklist-recomendado').checked || undefined
            });
        }
    });
    return items;
}

function collectBarrios() {
    const items = [];
    document.querySelectorAll('#dest-barrios > div').forEach(el => {
        const nombre = el.querySelector('.barrio-nombre').value.trim();
        if (nombre) {
            items.push({
                nombre,
                vibra: el.querySelector('.barrio-vibra').value.trim(),
                idealPara: el.querySelector('.barrio-ideal').value.trim(),
                imagen: el.querySelector('.barrio-imagen').value.trim() || undefined,
                colorTag: el.querySelector('.barrio-color').value
            });
        }
    });
    return items;
}

function collectExperiencias() {
    const items = [];
    document.querySelectorAll('#dest-experiencias > div').forEach(el => {
        const titulo = el.querySelector('.exp-titulo').value.trim();
        if (titulo) {
            const tagSelect = el.querySelector('.exp-tag');
            const selectedOption = tagSelect.options[tagSelect.selectedIndex];
            items.push({
                titulo,
                icono: el.querySelector('.exp-icono').value.trim(),
                tag: tagSelect.value,
                tagColor: selectedOption.dataset.color || '#10b981',
                descripcion: el.querySelector('.exp-descripcion').value.trim(),
                cta: el.querySelector('.exp-cta').value.trim() || undefined,
                ctaLink: el.querySelector('.exp-ctaLink').value.trim() || undefined
            });
        }
    });
    return items;
}

// Export to window for access
window.renderChecklistEditor = renderChecklistEditor;
window.renderBarriosEditor = renderBarriosEditor;
window.renderExperienciasEditor = renderExperienciasEditor;
window.loadPremiumGuide = loadPremiumGuide;
window.collectChecklist = collectChecklist;
window.collectBarrios = collectBarrios;
window.collectExperiencias = collectExperiencias;
window.collectPremiumGuide = collectPremiumGuide;
