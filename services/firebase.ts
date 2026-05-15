
import { getApp, getApps, initializeApp, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { browserLocalPersistence, getAuth, Auth, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Typed exports to prevent implicit 'any'
let app: FirebaseApp | undefined;
let db: Firestore | undefined;
let storage: FirebaseStorage | undefined;
let auth: Auth | undefined;
let isConfigured = false;

try {
  const hasConfig = Object.values(firebaseConfig).every((value) => String(value || '').trim().length > 0);
  if (hasConfig) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    db = getFirestore(app);
    storage = getStorage(app);
    auth = getAuth(app);
    void setPersistence(auth, browserLocalPersistence).catch((error) => {
      console.warn('Firebase auth persistence could not be enabled.', error);
    });
    isConfigured = true;
  }
} catch (e) {
  console.error("Firebase initialization error:", e);
}

export { db, storage, auth, isConfigured };
