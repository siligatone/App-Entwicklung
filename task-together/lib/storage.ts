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
 * Löscht die gespeicherte userId. Nur für Testzwecke.
 */
export async function clearUserId(): Promise<void> {
  await AsyncStorage.removeItem(USER_ID_KEY);
}
