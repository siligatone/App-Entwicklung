/**
 * Entry Point — Redirect-Logik.
 *
 * Prüft:
 * 1. Existiert eine lokale userId in AsyncStorage?
 * 2. Existiert ein Firestore-Profil für diese userId?
 *
 * Wenn beides ja → /tasks
 * Wenn userId fehlt oder Firestore-Profil fehlt → /onboarding
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getExistingUserId, getCachedProfile, cacheProfile } from '../lib/storage';
import { getUserProfile } from '../lib/user-service';
import { Colors } from '../constants/design';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const userId = await getExistingUserId();

      if (!userId) {
        router.replace('/onboarding');
        return;
      }

      // userId vorhanden — prüfe ob lokaler Cache existiert
      const cached = await getCachedProfile();
      if (cached) {
        router.replace('/(tabs)');
        return;
      }

      // Kein lokaler Cache — prüfe Firestore
      try {
        const firestoreProfile = await getUserProfile(userId);
        if (firestoreProfile) {
          // Profil in Firestore gefunden — Cache aktualisieren
          await cacheProfile({
            userId: firestoreProfile.userId,
            displayName: firestoreProfile.displayName,
            emoji: firestoreProfile.emoji,
          });
          router.replace('/(tabs)');
        } else {
          // userId existiert lokal, aber kein Firestore-Profil → Onboarding
          router.replace('/onboarding');
        }
      } catch {
        // Netzwerkfehler → mit lokalem Cache versuchen, sonst Onboarding
        router.replace('/onboarding');
      }
    }
    redirect();
  }, []);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundPrimary,
  },
});
