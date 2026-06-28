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
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from './firebase';

/** Snapshot des Erstellers — eingebettet im Task-Dokument */
export interface UserSnapshot {
  userId: string;
  displayName: string;
  emoji: string;
}

/** Prioritätsstufen */
export type Priority = 'low' | 'medium' | 'high';

/** Subtask — abhakbarer Unterpunkt einer Aufgabe */
export interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

/** Erzeugt eine einfache lokale ID (keine Dependency nötig) */
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Task-Dokument aus Firestore */
export interface Task {
  id: string;
  title: string;
  description: string;
  done: boolean;
  groupId: string | null;
  createdBy: UserSnapshot;
  completedBy: UserSnapshot | null;
  assignedTo: UserSnapshot | null;
  priority: Priority | null;
  labels: string[];
  effortEstimate: number | null; // Minuten
  deadline: unknown | null; // Firestore Timestamp
  subtasks: Subtask[];
  createdAt: unknown; // Firestore Timestamp
  updatedAt: unknown;
  completedAt: unknown | null;
}

/** Input für createTask — nur die Felder die der Nutzer eingibt */
export interface CreateTaskInput {
  title: string;
  description: string;
  groupId: string;
  priority?: Priority | null;
  labels?: string[];
  effortEstimate?: number | null;
  deadline?: Date | null;
  subtasks?: Subtask[];
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
    groupId: input.groupId,
    createdBy: {
      userId: currentUser.userId,
      displayName: currentUser.displayName,
      emoji: currentUser.emoji,
    },
    completedBy: null,
    assignedTo: assignedTo
      ? { userId: assignedTo.userId, displayName: assignedTo.displayName, emoji: assignedTo.emoji }
      : null,
    priority: input.priority ?? null,
    labels: input.labels ?? [],
    effortEstimate: input.effortEstimate ?? null,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    subtasks: (input.subtasks ?? []).map((s) => ({ id: s.id, title: s.title, done: s.done })),
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
 * Aktualisiert Titel, Beschreibung und Metadaten eines Tasks.
 */
export async function updateTask(
  taskId: string,
  input: CreateTaskInput,
): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  await updateDoc(taskRef, {
    title: input.title,
    description: input.description,
    priority: input.priority ?? null,
    labels: input.labels ?? [],
    effortEstimate: input.effortEstimate ?? null,
    deadline: input.deadline ? Timestamp.fromDate(input.deadline) : null,
    ...(input.subtasks !== undefined && {
      subtasks: input.subtasks.map((s) => ({ id: s.id, title: s.title, done: s.done })),
    }),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Schaltet den done-Status eines Subtasks um.
 * Liest die aktuelle subtasks-Liste, ändert den Eintrag und schreibt zurück.
 */
export async function toggleSubtask(
  taskId: string,
  subtaskId: string,
  nextDone: boolean,
  currentSubtasks: Subtask[],
): Promise<void> {
  const taskRef = doc(db, 'tasks', taskId);
  const updated = currentSubtasks.map((s) =>
    s.id === subtaskId ? { ...s, done: nextDone } : s,
  );
  await updateDoc(taskRef, {
    subtasks: updated.map((s) => ({ id: s.id, title: s.title, done: s.done })),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Abonniert einen einzelnen Task in Echtzeit.
 * Gibt eine unsubscribe-Funktion zurück.
 */
export function subscribeToTask(
  taskId: string,
  onTask: (task: Task | null) => void,
  onError: (error: string) => void,
): Unsubscribe {
  const taskRef = doc(db, 'tasks', taskId);

  return onSnapshot(
    taskRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        onTask(null);
        return;
      }
      onTask({ id: snapshot.id, ...snapshot.data() } as Task);
    },
    (error) => {
      onError(error.message);
    },
  );
}

/**
 * Abonniert Tasks in Echtzeit.
 *
 * Wenn groupId angegeben wird, werden nur Tasks dieser Gruppe geladen.
 * Sortierung erfolgt clientseitig (neueste zuerst), um einen Firestore
 * Composite Index auf (groupId, createdAt) zu vermeiden.
 *
 * Gibt eine unsubscribe-Funktion zurück — im useEffect-Cleanup aufrufen.
 */
export function subscribeToTasks(
  onTasks: (tasks: Task[]) => void,
  onError: (error: string) => void,
  groupId?: string,
): Unsubscribe {
  const q = groupId
    ? query(tasksCollection, where('groupId', '==', groupId))
    : query(tasksCollection, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const tasks: Task[] = snapshot.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Task[];

      // Clientseitige Sortierung wenn groupId-Filter aktiv (kein orderBy im Query)
      if (groupId) {
        tasks.sort((a, b) => {
          const dateA = toTimestamp(a.createdAt);
          const dateB = toTimestamp(b.createdAt);
          return dateB - dateA;
        });
      }

      onTasks(tasks);
    },
    (error) => {
      onError(error.message);
    },
  );
}

/** Hilfsfunktion: Firestore Timestamp zu Millisekunden */
function toTimestamp(value: unknown): number {
  if (value == null) return 0;
  if (typeof (value as { toMillis?: unknown }).toMillis === 'function') {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (value instanceof Date) return value.getTime();
  return 0;
}
