// UI Helper functions
export async function confirm(message) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'fixed inset-0 bg-black/50 flex items-center justify-center z-[100]';
        modal.innerHTML = `
            <div class="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-sm mx-4 shadow-2xl">
                <p class="text-gray-800 dark:text-white mb-6">${message}</p>
                <div class="flex gap-3">
                    <button id="confirm-yes" class="flex-1 bg-red-500 hover:bg-red-600 text-white py-3 rounded-lg font-bold transition-colors">
                        Sí, continuar
                    </button>
                    <button id="confirm-no" class="flex-1 bg-gray-300 dark:bg-slate-700 hover:bg-gray-400 dark:hover:bg-slate-600 py-3 rounded-lg font-bold transition-colors">
                        Cancelar
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        modal.querySelector('#confirm-yes').onclick = () => {
            modal.remove();
            resolve(true);
        };

        modal.querySelector('#confirm-no').onclick = () => {
            modal.remove();
            resolve(false);
        };
    });
}

export function showLoader(elementId) {
    const loader = document.getElementById(elementId);
    if (loader) loader.classList.remove('hidden');
}

export function hideLoader(elementId) {
    const loader = document.getElementById(elementId);
    if (loader) loader.classList.add('hidden');
}

export function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + S = Save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            const saveBtn = document.querySelector('form:not(.hidden) button[type="submit"]');
            if (saveBtn && !saveBtn.disabled) {
                saveBtn.click();
            }
        }

        // Esc = Close modal
        if (e.key === 'Escape') {
            const modal = document.querySelector('.modal-overlay:not(.hidden)');
            if (modal) {
                modal.classList.add('hidden');
            }
        }
    });
}

// Expose globally
window.confirm = confirm;
