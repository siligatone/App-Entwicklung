/**
 * Task-Service: Firestore CRUD für Aufgaben.
 *
 * Alle Tasks liegen in der Collection "tasks".
 * Echtzeit-Updates via onSnapshot-Listener.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

/** Snapshot des Erstellers — eingebettet im Task-Dokument */
export interface UserSnapshot {
  userId: string;
  displayName: string;
  emoji: string;
}

/** Task-Dokument aus Firestore */
export interface Task {
  id: string;
  title: string;
  description: string;
  done: boolean;
  createdBy: UserSnapshot;
  completedBy: UserSnapshot | null;
  assignedTo: UserSnapshot | null;
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
  completedAt: unknown | null;
}

/** Input für createTask — nur die Felder die der Nutzer eingibt */
export interface CreateTaskInput {
  title: string;
  description: string;
}

const tasksCollection = collection(db, 'tasks');

/**
 * Erstellt einen neuen Task in Firestore.
 * assignedTo ist optional — wenn nicht angegeben, wird null gespeichert.
 */
export async function createTask(
  input: CreateTaskInput,
  currentUser: UserSnapshot,
  assignedTo?: UserSnapshot | null,
): Promise<string> {
  const docRef = await addDoc(tasksCollection, {
    title: input.title,
    description: input.description,
    done: false,
    createdBy: {
      userId: currentUser.userId,
      displayName: currentUser.displayName,
      emoji: currentUser.emoji,
    },
    completedBy: null,
    assignedTo: assignedTo
      ? { userId: assignedTo.userId, displayName: assignedTo.displayName, emoji: assignedTo.emoji }
      : null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    completedAt: null,
  });
  return docRef.id;
}

/**
 * Markiert einen Task als erledigt.
 * Setzt done=true, completedBy und completedAt.
 */
export async function completeTask(
  taskId: string,
  currentUser: UserSnapshot,
): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, {
    done: true,
    completedBy: {
      userId: currentUser.userId,
      displayName: currentUser.displayName,
      emoji: currentUser.emoji,
    },
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Setzt einen erledigten Task wieder auf offen.
 * Löscht completedBy und completedAt.
 */
export async function reopenTask(taskId: string): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, {
    done: false,
    completedBy: null,
    completedAt: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Löscht ein Task-Dokument aus Firestore.
 * Löscht ausschließlich tasks/{taskId} — keine anderen Collections.
 */
export async function deleteTask(taskId: string): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  await deleteDoc(taskRef);
}

/**
 * Abonniert alle Tasks in Echtzeit (neueste zuerst).
 *
 * Gibt eine unsubscribe-Funktion zurück — im useEffect-Cleanup aufrufen.
 */
export function subscribeToTasks(
  onTasks: (tasks: Task[]) => void,
  onError: (error: string) => void,
): Unsubscribe {
  const q = query(tasksCollection, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Task[];
      onTasks(tasks);
    },
    (error) => {
      onError(error.message);
    },
  );
}
