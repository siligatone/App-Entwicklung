// AsyncStorage-Wrapper für userId, Profil und Gruppe

import AsyncStorage from '@react-native-async-storage/async-storage';

const USER_ID_KEY = '@tasktogether/userId';

// UUID v4 ohne externe lib
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// userId holen oder neu anlegen
export async function getUserId(): Promise<string> {
  try {
    const stored = await AsyncStorage.getItem(USER_ID_KEY);
    if (stored) return stored;

    const newId = generateUUID();
    await AsyncStorage.setItem(USER_ID_KEY, newId);
    return newId;
  } catch {
    return generateUUID(); // temp ID als Fallback
  }
}

// userId nur lesen, nicht anlegen
export async function getExistingUserId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(USER_ID_KEY);
  } catch {
    return null;
  }
}

// alles löschen (Profil-Reset)
export async function clearUserData(): Promise<void> {
  await AsyncStorage.multiRemove([USER_ID_KEY, PROFILE_CACHE_KEY, GROUP_CACHE_KEY]);
}

// --- Gruppen-Cache ---

const GROUP_CACHE_KEY = '@tasktogether/groupCache';

export interface CachedGroup {
  groupId: string;
  name: string;
  joinCode: string;
}

// Gruppe lokal cachen
export async function cacheGroup(group: CachedGroup): Promise<void> {
  await AsyncStorage.setItem(GROUP_CACHE_KEY, JSON.stringify(group));
}

// gecachte Gruppe laden
export async function getCachedGroup(): Promise<CachedGroup | null> {
  try {
    const data = await AsyncStorage.getItem(GROUP_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data) as CachedGroup;
  } catch {
    return null;
  }
}

// Gruppen-Cache löschen
export async function clearGroupCache(): Promise<void> {
  await AsyncStorage.removeItem(GROUP_CACHE_KEY);
}

// --- Profil-Cache ---

const PROFILE_CACHE_KEY = '@tasktogether/profileCache';

export interface CachedProfile {
  userId: string;
  displayName: string;
  emoji: string;
}

// Profil lokal cachen
export async function cacheProfile(profile: CachedProfile): Promise<void> {
  await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
}

// gecachtes Profil laden
export async function getCachedProfile(): Promise<CachedProfile | null> {
  try {
    const data = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (!data) return null;
    return JSON.parse(data) as CachedProfile;
  } catch {
    return null;
  }
}
