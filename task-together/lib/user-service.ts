/**
 * User-Service: Firestore CRUD für Demo-Profile.
 *
 * HINWEIS: Dies ist ein Demo-Profilsystem ohne echte Authentifizierung.
 * - Kein Login, kein Passwort, keine E-Mail.
 * - Nutzeridentifikation erfolgt über eine lokal generierte UUID.
 * - Für Produktion: Firebase Auth + restriktivere Firestore Security Rules verwenden.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

export interface UserProfile {
  userId: string;
  displayName: string;
  emoji: string;
  groupId?: string | null;
  labels?: string[];
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

/**
 * Abonniert Demo-Profile in Echtzeit.
 * Wenn groupId angegeben wird, werden nur Mitglieder dieser Gruppe geladen.
 * Gibt eine unsubscribe-Funktion zurück — im useEffect-Cleanup aufrufen.
 */
/**
 * Echtzeit-Listener für ein einzelnes User-Profil.
 */
export function subscribeToUserProfile(
  userId: string,
  onProfile: (profile: UserProfile | null) => void,
  onError: (error: string) => void,
): Unsubscribe {
  const userRef = doc(db, 'users', userId);
  return onSnapshot(
    userRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onProfile(null);
        return;
      }
      onProfile(snapshot.data() as UserProfile);
    },
    (error) => {
      onError(error.message);
    },
  );
}

/**
 * Fügt ein neues Label zum User-Profil hinzu (idempotent dank arrayUnion).
 */
export async function addUserLabel(userId: string, label: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    labels: arrayUnion(label),
    updatedAt: serverTimestamp(),
  });
}

export function subscribeToUsers(
  onUsers: (users: UserProfile[]) => void,
  onError: (error: string) => void,
  groupId?: string,
): Unsubscribe {
  const usersCollection = collection(db, 'users');
  const q = groupId
    ? query(usersCollection, where('groupId', '==', groupId))
    : usersCollection;

  return onSnapshot(
    q,
    (snapshot) => {
      const users: UserProfile[] = snapshot.docs.map((d) => ({
        ...d.data(),
        userId: d.id,
      })) as UserProfile[];
      onUsers(users);
    },
    (error) => {
      onError(error.message);
    },
  );
}
