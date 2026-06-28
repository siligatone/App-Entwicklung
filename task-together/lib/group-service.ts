/**
 * Group-Service: Firestore CRUD für Demo-Gruppen.
 *
 * HINWEIS: Gruppen sind eine rein clientseitige Demo-Trennung.
 * - Kein Firebase Auth — jeder mit dem Join-Code kann beitreten.
 * - Join-Codes sind 6 Zeichen, nicht kryptografisch sicher.
 * - Für Produktion: Firebase Auth + Firestore Security Rules verwenden.
 */

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';
import type { UserProfile } from './user-service';

// --- Typen ---

export interface UserSnapshot {
  userId: string;
  displayName: string;
  emoji: string;
}

export interface Group {
  groupId: string;
  name: string;
  joinCode: string;
  createdBy: UserSnapshot;
  memberIds: string[];
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
}

// --- Hilfsfunktionen ---

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne I/O/0/1 zur Vermeidung von Verwechslungen

/**
 * Erzeugt einen 6-stelligen, zufälligen Join-Code (uppercase alphanumerisch).
 */
export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

const groupsCollection = collection(db, 'groups');

// --- CRUD ---

/**
 * Erstellt eine neue Gruppe in Firestore.
 * - Generiert einen einzigartigen Join-Code
 * - Fügt den Creator als erstes Mitglied hinzu
 * - Setzt groupId auf dem User-Profil
 *
 * @returns Die erstellte Gruppe
 */
export async function createGroup(
  name: string,
  creator: UserSnapshot,
): Promise<Group> {
  // Join-Code generieren und Eindeutigkeit prüfen (Demo-Skala: Kollision extrem unwahrscheinlich)
  let joinCode = generateJoinCode();
  const existing = await getGroupByJoinCode(joinCode);
  if (existing) {
    joinCode = generateJoinCode(); // Einmal Retry reicht bei Demo-Skala
  }

  const groupRef = doc(groupsCollection);
  const groupId = groupRef.id;

  const groupData = {
    groupId,
    name,
    joinCode,
    createdBy: {
      userId: creator.userId,
      displayName: creator.displayName,
      emoji: creator.emoji,
    },
    memberIds: [creator.userId],
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  await setDoc(groupRef, groupData);

  // groupId auf User-Profil setzen
  const userRef = doc(db, 'users', creator.userId);
  await updateDoc(userRef, { groupId, updatedAt: serverTimestamp() });

  return { ...groupData, createdAt: null, updatedAt: null } as unknown as Group;
}

/**
 * Tritt einer bestehenden Gruppe per Join-Code bei.
 * - Normalisiert den Code auf Uppercase
 * - Fügt userId via arrayUnion in memberIds hinzu
 * - Setzt groupId auf dem User-Profil
 *
 * @returns Die Gruppe, oder null falls der Code ungültig ist
 */
export async function joinGroup(
  joinCode: string,
  userProfile: UserSnapshot,
): Promise<Group | null> {
  const normalizedCode = joinCode.trim().toUpperCase();
  const group = await getGroupByJoinCode(normalizedCode);

  if (!group) return null;

  // User zur Gruppe hinzufügen (idempotent dank arrayUnion)
  const groupRef = doc(db, 'groups', group.groupId);
  await updateDoc(groupRef, {
    memberIds: arrayUnion(userProfile.userId),
    updatedAt: serverTimestamp(),
  });

  // groupId auf User-Profil setzen
  const userRef = doc(db, 'users', userProfile.userId);
  await updateDoc(userRef, { groupId: group.groupId, updatedAt: serverTimestamp() });

  return { ...group, memberIds: [...group.memberIds, userProfile.userId] };
}

/**
 * Verlässt eine Gruppe.
 * - Entfernt userId aus memberIds via arrayRemove
 * - Setzt users/{userId}.groupId auf null
 *
 * Gruppe wird NICHT gelöscht, auch wenn letztes Mitglied geht.
 * Tasks bleiben unberührt.
 */
export async function leaveGroup(
  groupId: string,
  userId: string,
): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    memberIds: arrayRemove(userId),
    updatedAt: serverTimestamp(),
  });

  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { groupId: null, updatedAt: serverTimestamp() });
}

/**
 * Lädt eine Gruppe per groupId aus Firestore.
 */
export async function getGroup(groupId: string): Promise<Group | null> {
  const groupRef = doc(db, 'groups', groupId);
  const snapshot = await getDoc(groupRef);

  if (!snapshot.exists()) return null;

  return snapshot.data() as Group;
}

/**
 * Sucht eine Gruppe anhand des Join-Codes.
 */
export async function getGroupByJoinCode(joinCode: string): Promise<Group | null> {
  const q = query(groupsCollection, where('joinCode', '==', joinCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as Group;
}

/**
 * Echtzeit-Listener für Gruppenänderungen (z. B. neue Mitglieder).
 */
export function subscribeToGroup(
  groupId: string,
  onGroup: (group: Group | null) => void,
  onError: (error: string) => void,
): Unsubscribe {
  const groupRef = doc(db, 'groups', groupId);

  return onSnapshot(
    groupRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onGroup(null);
        return;
      }
      onGroup(snapshot.data() as Group);
    },
    (error) => {
      onError(error.message);
    },
  );
}
