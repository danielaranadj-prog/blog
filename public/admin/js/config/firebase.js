// Firebase configuration and initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBdsu65Voj8en9u_7eL5q0YRFuCC7fUYWA",
    authDomain: "instantetrips-editor.firebaseapp.com",
    projectId: "instantetrips-editor",
    storageBucket: "instantetrips-editor.firebasestorage.app",
    messagingSenderId: "281917140804",
    appId: "1:281917140804:web:ed712e65c9c4b77dd3b111"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Expose globally for legacy code (tours-manager.js)
window.firestoreDB = db;
window.firestoreDoc = doc;
window.firestoreGetDoc = getDoc;
window.firestoreSetDoc = setDoc;

export const ADMIN_EMAIL = "danielaranadj@gmail.com";
