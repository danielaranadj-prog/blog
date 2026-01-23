
import { initializeApp, getApps, getApp } from "firebase/app";

const firebaseConfig = {
    apiKey: "AIzaSyBdsu65Voj8en9u_7eL5q0YRFuCC7fUYWA",
    authDomain: "instantetrips-editor.firebaseapp.com",
    projectId: "instantetrips-editor",
    storageBucket: "instantetrips-editor.firebasestorage.app",
    messagingSenderId: "281917140804",
    appId: "1:281917140804:web:ed712e65c9c4b77dd3b111"
};

let app;

if (!getApps().length) {
    app = initializeApp(firebaseConfig);
} else {
    app = getApp();
}

export { app };
