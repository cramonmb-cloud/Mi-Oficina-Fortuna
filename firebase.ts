import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import { getStorage } from "firebase/storage";

import firebaseAppletConfig from "./firebase-applet-config.json";

// Helper to check and retrieve the configuration
export const getFirebaseConfig = () => {
  // 1. Try to load from Vite environment variables (Vercel/Production setup)
  if (
    import.meta.env.VITE_FIREBASE_API_KEY &&
    import.meta.env.VITE_FIREBASE_PROJECT_ID
  ) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID,
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
    };
  }

  // 2. Try to load from static JSON configuration (if configured)
  if (firebaseAppletConfig && firebaseAppletConfig.apiKey && firebaseAppletConfig.apiKey.trim() !== "") {
    return {
      apiKey: firebaseAppletConfig.apiKey,
      authDomain: firebaseAppletConfig.authDomain,
      projectId: firebaseAppletConfig.projectId,
      storageBucket: firebaseAppletConfig.storageBucket,
      messagingSenderId: firebaseAppletConfig.messagingSenderId,
      appId: firebaseAppletConfig.appId,
      measurementId: firebaseAppletConfig.measurementId || "",
    };
  }

  // 3. Try to load from localStorage (Dynamic local setup)
  try {
    const saved = localStorage.getItem('firebase_config');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error("Error reading firebase_config from localStorage", e);
  }

  return null;
};

const config = getFirebaseConfig();
const hasConfig = !!config;

// Fallback placeholder credentials to prevent app crash on load
const activeConfig = config || {
  apiKey: "PLACEHOLDER_KEY",
  authDomain: "placeholder.firebaseapp.com",
  projectId: "placeholder-project",
  storageBucket: "placeholder-project.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:0000000000000000000000",
  measurementId: "G-PLACEHOLDER"
};

const app = getApps().length === 0 ? initializeApp(activeConfig) : getApp();
const db = getFirestore(app);
const storage = getStorage(app);

let analytics = null;
if (hasConfig && typeof window !== 'undefined') {
  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Analytics failed to initialize:", e);
  }
}

export { db, storage, analytics, hasConfig };

