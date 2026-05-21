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
const storage = firebase.storage();

// Provedor Google para login social
const googleProvider = new firebase.auth.GoogleAuthProvider();
