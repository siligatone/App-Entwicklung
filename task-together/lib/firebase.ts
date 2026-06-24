/**
 * Firebase-Initialisierung für TaskTogether.
 *
 * Konfiguration kommt aus Umgebungsvariablen (.env-Datei).
 * EXPO_PUBLIC_* Variablen sind im Client-Code sicher zugänglich,
 * da der Firebase-API-Key by Design öffentlich ist —
 * echter Schutz läuft über Firestore Security Rules.
 *
 * Für Produktion: Security Rules auf authentifizierte Nutzer einschränken.
 */

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Verhindert doppelte Initialisierung (z. B. bei Hot Reload)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export default app;
