// ============================================================
//  NEXUS — Firebase Configuration
//  Substitua os valores abaixo pelos do seu projeto Firebase
//  Firebase Console → Configurações do projeto → Seus apps
// ============================================================

const firebaseConfig = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJETO.firebaseapp.com",
  projectId:         "SEU_PROJETO",
  storageBucket:     "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};

firebase.initializeApp(firebaseConfig);

const auth = firebase.auth();
const db   = firebase.firestore();
const storage = firebase.storage();

// Provedor Google para login social
const googleProvider = new firebase.auth.GoogleAuthProvider();
