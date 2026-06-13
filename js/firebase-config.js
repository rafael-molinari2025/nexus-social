// ============================================================
//  NEXUS — Firebase Configuration
//  Substitua os valores abaixo pelos do seu projeto Firebase
//  Firebase Console → Configurações do projeto → Seus apps
// ============================================================

const firebaseConfig = {
  apiKey:            "AIzaSyCPRFqmP5Zp7Bk1dpbnLeHyXoHAmt6TW6k",
  authDomain:        "rede-social-acf40.firebaseapp.com",
  projectId:         "rede-social-acf40",
  storageBucket:     "rede-social-acf40.firebasestorage.app",
  messagingSenderId: "930877572432",
  appId:             "1:930877572432:web:bdb6e937b5f4e747c89855",
  measurementId:     "G-GY0PSS3R38"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();

// Storage SDK só carregado em páginas que precisam (perfil, etc.)
let storage;
try { storage = firebase.storage(); } catch(e) { /* SDK não carregado nesta página */ }

// Provedor Google para login social
const googleProvider = new firebase.auth.GoogleAuthProvider();

// Firebase Messaging (push notifications)
// VAPID key: Firebase Console → Project Settings → Cloud Messaging → Web Push certificates → Generate key pair
const FCM_VAPID_KEY = 'BNo-TiznoJwvMsgJ2S9sOUYD_UO9XNu1T0s3JvDysh3crQBlLyMO355Utl0DxWYOcwV_pRGhUCic81dRuuHQoS4';
let messaging;
try { messaging = firebase.messaging(); } catch(e) { /* SDK não carregado */ }
