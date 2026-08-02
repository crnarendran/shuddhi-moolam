import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAFQYB6YHp_qVRSsStYmlCiGyfW6vm0S5k",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "sai-shuddhi-moolam.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "sai-shuddhi-moolam",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "sai-shuddhi-moolam.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "834855301873",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:834855301873:web:c2e6bc7427785680942f50",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-FPBT2XCNBF"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);
