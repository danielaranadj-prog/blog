// Main entry point for the admin panel
import { initTheme } from './ui/theme.js';
import { initKeyboardShortcuts } from './ui/helpers.js';
import './config/firebase.js';
import './ui/toast.js';
import './core/auth.js';
import { github } from './services/github.js';
import './modules/blog.js';
import './utils/autosave.js';
import './ui/skeleton.js';
import './ui/button-states.js';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initKeyboardShortcuts();
    console.log('✅ Admin Panel modules loaded');
    console.log('💡 Tip: Press Ctrl+S to save, Esc to close modals');
    console.log('⚡ Auto-save enabled for forms');
});

// Initialize GitHub service when config is available
window.addEventListener('load', () => {
    if (window.githubConfig) {
        github.setConfig(window.githubConfig);
    }
});
