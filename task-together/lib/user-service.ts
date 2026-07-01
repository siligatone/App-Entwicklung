// Firestore CRUD für Nutzerprofile

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
  createdAt: unknown;
  updatedAt: unknown;
}

// Profil anlegen
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

// Profil laden
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const userRef = doc(db, 'users', userId);
  const snapshot = await getDoc(userRef);

  if (!snapshot.exists()) return null;

  return snapshot.data() as UserProfile;
}

// Profil löschen
export async function deleteUserProfile(userId: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await deleteDoc(userRef);
}

// eigenes Profil live beobachten
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

// neues Label zum Profil hinzufügen
export async function addUserLabel(userId: string, label: string): Promise<void> {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    labels: arrayUnion(label),
    updatedAt: serverTimestamp(),
  });
}

// Gruppenmitglieder live laden
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
