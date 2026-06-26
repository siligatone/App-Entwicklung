/**
 * User-Service: Firestore CRUD für Demo-Profile.
 *
 * HINWEIS: Dies ist ein Demo-Profilsystem ohne echte Authentifizierung.
 * - Kein Login, kein Passwort, keine E-Mail.
 * - Nutzeridentifikation erfolgt über eine lokal generierte UUID.
 * - Für Produktion: Firebase Auth + restriktivere Firestore Security Rules verwenden.
 */

import {
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
  userId: string;
  displayName: string;
  emoji: string;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
}

/**
 * Speichert ein neues Profil in Firestore unter users/{userId}.
 */
export async function createUserProfile(
  userId: string,
  displayName: string,
  emoji: string,
): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await setDoc(userRef, {
    userId,
    displayName,
    emoji,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Lädt ein Profil aus Firestore. Gibt null zurück, wenn kein Profil existiert.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return null;

  return snapshot.data() as UserProfile;
}

/**
 * Löscht das Profil-Dokument users/{userId} aus Firestore.
 * Löscht ausschließlich dieses eine Dokument — keine anderen User oder Collections.
 */
export async function deleteUserProfile(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
}
