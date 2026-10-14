// Auto-Save functionality
export class AutoSave {
    constructor(formId, saveFunction, options = {}) {
        this.form = document.getElementById(formId);
        if (!this.form) return;

        this.saveFunction = saveFunction;
        this.interval = options.interval || 30000; // 30 seconds default
        this.timer = null;
        this.isDirty = false;
        this.isSaving = false;
        this.indicator = null;

        this.createIndicator();
        this.setupListeners();
    }

    createIndicator() {
        // Create auto-save indicator
        this.indicator = document.createElement('div');
        this.indicator.id = 'autosave-indicator';
        this.indicator.className = 'fixed top-20 right-6 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 opacity-0 pointer-events-none z-50';
        document.body.appendChild(this.indicator);
    }

    setupListeners() {
        // Listen to all input changes
        this.form.addEventListener('input', () => {
            this.isDirty = true;
            this.resetTimer();
            this.showIndicator('Cambios sin guardar', 'text-yellow-600');
        });

        // Listen to form submit to cancel auto-save
        this.form.addEventListener('submit', () => {
            this.cancelAutoSave();
        });
    }

    resetTimer() {
        clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            if (this.isDirty && !this.isSaving) {
                this.save();
            }
        }, this.interval);
    }

    async save() {
        if (this.isSaving) return;

        this.isSaving = true;
        this.showIndicator('Guardando...', 'text-blue-600');

        try {
            await this.saveFunction();
            this.isDirty = false;
            this.showIndicator('✓ Guardado automáticamente', 'text-green-600');

            // Hide after 2 seconds
            setTimeout(() => {
                this.hideIndicator();
            }, 2000);

        } catch (error) {
            console.error('Auto-save error:', error);
            this.showIndicator('✗ Error al guardar', 'text-red-600');

            // Hide after 3 seconds
            setTimeout(() => {
                this.hideIndicator();
            }, 3000);
        } finally {
            this.isSaving = false;
        }
    }

    showIndicator(text, colorClass) {
        if (!this.indicator) return;

        this.indicator.textContent = text;
        this.indicator.className = `fixed top-20 right-6 bg-white dark:bg-slate-800 px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 z-50 ${colorClass}`;
        this.indicator.style.opacity = '1';
        this.indicator.style.pointerEvents = 'auto';
    }

    hideIndicator() {
        if (!this.indicator) return;
        this.indicator.style.opacity = '0';
        this.indicator.style.pointerEvents = 'none';
    }

    cancelAutoSave() {
        clearTimeout(this.timer);
        this.isDirty = false;
        this.hideIndicator();
    }

    destroy() {
        this.cancelAutoSave();
        if (this.indicator) {
            this.indicator.remove();
        }
    }
}

// Expose globally
window.AutoSave = AutoSave;
