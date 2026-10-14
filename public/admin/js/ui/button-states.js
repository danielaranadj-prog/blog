// Button state management
export function setButtonLoading(button, loadingText = 'Guardando...') {
    if (typeof button === 'string') {
        button = document.getElementById(button) || document.querySelector(button);
    }

    if (!button) return;

    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
        <svg class="animate-spin h-5 w-5 inline mr-2" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        ${loadingText}
    `;
}

export function setButtonSuccess(button, successText = null) {
    if (typeof button === 'string') {
        button = document.getElementById(button) || document.querySelector(button);
    }

    if (!button) return;

    const originalText = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
    button.innerHTML = `
        <svg class="h-5 w-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
        </svg>
        ${successText || 'Guardado'}
    `;

    // Revert after 2 seconds
    setTimeout(() => {
        button.innerHTML = originalText;
        delete button.dataset.originalText;
    }, 2000);
}

export function setButtonError(button, errorText = 'Error') {
    if (typeof button === 'string') {
        button = document.getElementById(button) || document.querySelector(button);
    }

    if (!button) return;

    const originalText = button.dataset.originalText || button.innerHTML;
    button.disabled = false;
    button.innerHTML = `
        <svg class="h-5 w-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
        ${errorText}
    `;

    // Revert after 3 seconds
    setTimeout(() => {
        button.innerHTML = originalText;
        delete button.dataset.originalText;
    }, 3000);
}

export function resetButton(button) {
    if (typeof button === 'string') {
        button = document.getElementById(button) || document.querySelector(button);
    }

    if (!button) return;

    if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
    }
    button.disabled = false;
}

// Expose globally
window.setButtonLoading = setButtonLoading;
window.setButtonSuccess = setButtonSuccess;
window.setButtonError = setButtonError;
window.resetButton = resetButton;
