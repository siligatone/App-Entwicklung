/**
 * AsyncStorage-Helper für die lokale Nutzer-ID.
 *
 * Erzeugt beim ersten Aufruf eine zufällige UUID und speichert sie dauerhaft.
 * Keine echte Authentifizierung — dient der Geräteidentifikation für die Demo.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@tasktogether/userId';

/** Erzeugt eine einfache UUID v4 ohne externe Abhängigkeit */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Gibt die userId zurück. Erzeugt sie beim ersten Aufruf.
 */
export async function getUserId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(USER_ID_KEY);
    if (stored) return stored;

    const newId = generateUUID();
    await AsyncStorage.setItem(USER_ID_KEY, newId);
    return newId;
  } catch {
    // Fallback: temporäre ID (wird nicht gespeichert)
    return generateUUID();
  }
}

/**
 * Gibt die userId zurück, falls sie bereits existiert — sonst null.
 * Nützlich für die Redirect-Logik im Root-Index.
 */
export async function getExistingUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

/**
 * Löscht die gespeicherte userId und alle lokalen Profildaten.
 * Für Profil-Reset und Tests.
 */
export async function clearUserData(): Promise<void> {
  await AsyncStorage.multiRemove([USER_ID_KEY, PROFILE_CACHE_KEY, GROUP_CACHE_KEY]);
}

// --- Lokaler Gruppen-Cache ---

const GROUP_CACHE_KEY = '@tasktogether/groupCache';

export interface CachedGroup {
  groupId: string;
  name: string;
  joinCode: string;
}

/**
 * Speichert Gruppeninfo lokal, damit die App beim Start sofort weiß,
 * ob der Nutzer einer Gruppe angehört.
 */
export async function cacheGroup(group: CachedGroup): Promise<void> {
  await AsyncStorage.setItem(GROUP_CACHE_KEY, JSON.stringify(group));
}

/**
 * Lädt die lokal gecachte Gruppe. Gibt null zurück, wenn keine existiert.
 */
export async function getCachedGroup(): Promise<CachedGroup | null> {
  try {
    const data = await AsyncStorage.getItem(GROUP_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data) as CachedGroup;
  } catch {
    return null;
  }
}

/**
 * Löscht den lokalen Gruppen-Cache.
 */
export async function clearGroupCache(): Promise<void> {
  await AsyncStorage.removeItem(GROUP_CACHE_KEY);
}

// --- Lokaler Profil-Cache ---

const PROFILE_CACHE_KEY = '@tasktogether/profileCache';

export interface CachedProfile {
  userId: string;
  displayName: string;
  emoji: string;
}

/**
 * Speichert Profildaten lokal, damit der Header sofort angezeigt werden kann
 * ohne auf Firestore zu warten.
 */
export async function cacheProfile(profile: CachedProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

/**
 * Lädt das lokal gecachte Profil. Gibt null zurück, wenn keins existiert.
 */
export async function getCachedProfile(): Promise<CachedProfile | null> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data) as CachedProfile;
  } catch {
    return null;
  }
}
