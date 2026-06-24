/**
 * Firestore-Verbindungstest.
 * Schreibt ausschließlich in die Collection "dev_checks" — NICHT in Produktionsdaten.
 * Nur für Phase 1 / Entwicklung.
 */

import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export async function runConnectionTest(): Promise<{ success: boolean; docId?: string; error?: string }> {
  try {
    const testCollection = collection(db, 'dev_checks');
    const docRef = await addDoc(testCollection, {
      message: 'Verbindungstest erfolgreich',
      timestamp: serverTimestamp(),
      source: 'Phase1-Setup',
    });
    return { success: true, docId: docRef.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
    return { success: false, error: message };
  }
}
