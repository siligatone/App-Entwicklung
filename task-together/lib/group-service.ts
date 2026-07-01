// Firestore CRUD für Gruppen

import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
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
  labels: string[];
  createdAt: unknown;
  updatedAt: unknown;
}

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // ohne verwechselbare Zeichen (I, O, 0, 1)

// 6-stelligen Join-Code erzeugen
export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
  }
  return code;
}

const groupsCollection = collection(db, 'groups');

// Gruppe anlegen
export async function createGroup(
  name: string,
  creator: UserSnapshot,
): Promise<Group> {
  let joinCode = generateJoinCode();
  const existing = await getGroupByJoinCode(joinCode);
  if (existing) {
    joinCode = generateJoinCode(); // einmal reichen
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

  // groupId beim User eintragen
  const userRef = doc(db, 'users', creator.userId);
  await updateDoc(userRef, { groupId, updatedAt: serverTimestamp() });

  return { ...groupData, createdAt: null, updatedAt: null } as unknown as Group;
}

// Gruppe per Join-Code beitreten
export async function joinGroup(
  joinCode: string,
  userProfile: UserSnapshot,
): Promise<Group | null> {
  const normalizedCode = joinCode.trim().toUpperCase();
  const group = await getGroupByJoinCode(normalizedCode);

  if (!group) return null;

  const groupRef = doc(db, 'groups', group.groupId);
  await updateDoc(groupRef, {
    memberIds: arrayUnion(userProfile.userId), // idempotent
    updatedAt: serverTimestamp(),
  });

  const userRef = doc(db, 'users', userProfile.userId);
  await updateDoc(userRef, { groupId: group.groupId, updatedAt: serverTimestamp() });

  return { ...group, memberIds: [...group.memberIds, userProfile.userId] };
}

// Gruppe verlassen
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

// Gruppe löschen — nur Ersteller sollte das aufrufen
export async function deleteGroup(
  groupId: string,
  memberIds: string[],
): Promise<void> {
  for (const userId of memberIds) {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, { groupId: null, updatedAt: serverTimestamp() });
  }

  const groupRef = doc(db, 'groups', groupId);
  await deleteDoc(groupRef);
}

// Gruppe laden
export async function getGroup(groupId: string): Promise<Group | null> {
  const groupRef = doc(db, 'groups', groupId);
  const snapshot = await getDoc(groupRef);

  if (!snapshot.exists()) return null;

  return snapshot.data() as Group;
}

// Gruppe per Join-Code suchen
export async function getGroupByJoinCode(joinCode: string): Promise<Group | null> {
  const q = query(groupsCollection, where('joinCode', '==', joinCode));
  const snapshot = await getDocs(q);

  if (snapshot.empty) return null;

  return snapshot.docs[0].data() as Group;
}

// neues Label zur Gruppe hinzufügen
export async function addGroupLabel(groupId: string, label: string): Promise<void> {
  const groupRef = doc(db, 'groups', groupId);
  await updateDoc(groupRef, {
    labels: arrayUnion(label),
    updatedAt: serverTimestamp(),
  });
}

// Gruppe live beobachten
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
