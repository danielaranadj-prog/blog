// Authentication Manager
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { auth, db, ADMIN_EMAIL } from '../config/firebase.js';
import { showToast } from '../ui/toast.js';

export class AuthManager {
    constructor() {
        this.githubConfig = null;
        this.setupLoginForm();
        this.setupAuthListener();
    }

    setupLoginForm() {
        const form = document.getElementById('login-form');
        if (!form) return;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;

            if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
                this.showError("ACCESO DENEGADO: No tienes permisos.");
                return;
            }

            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                this.showError("Credenciales incorrectas.");
            }
        });
    }

    setupAuthListener() {
        onAuthStateChanged(auth, async (user) => {
            if (user && user.email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
                await this.onLogin(user);
            } else {
                this.onLogout();
                if (user) signOut(auth);
            }
        });
    }

    async onLogin(user) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('dashboard-section').classList.remove('hidden');
        document.getElementById('admin-user-display').textContent = user.email;

        // Load GitHub config from Firestore
        try {
            const docSnap = await getDoc(doc(db, "config", "main"));
            if (docSnap.exists()) {
                this.githubConfig = docSnap.data();
                if (!this.githubConfig.postsPath.endsWith('/')) {
                    this.githubConfig.postsPath += '/';
                }

                // Expose globally for other modules
                window.githubConfig = this.githubConfig;
            }
        } catch (error) {
            console.error('Error loading GitHub config:', error);
            showToast('Error cargando configuración', 'error');
        }
    }

    onLogout() {
        document.getElementById('login-section').classList.remove('hidden');
        document.getElementById('dashboard-section').classList.add('hidden');
    }

    showError(msg) {
        const err = document.getElementById('login-error');
        if (err) {
            err.classList.remove('hidden');
            err.textContent = msg;
        }
    }

    logout() {
        signOut(auth);
    }
}

// Create singleton instance
export const authManager = new AuthManager();

// Expose logout globally for onclick handlers
window.logout = () => authManager.logout();
