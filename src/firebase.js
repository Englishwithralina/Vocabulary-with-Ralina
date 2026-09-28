import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Paste the real Firebase WEB configuration here, or fill .env.local.
// Public web configuration is not an admin credential. Security is enforced by rules.
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};
export const configured = Object.values(firebaseConfig).every(Boolean);
let app = null;
try { if (configured) app = initializeApp(firebaseConfig); } catch { /* Setup screen remains usable. */ }
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
