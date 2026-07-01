// Entry Point — Weiterleitung zu Onboarding oder App

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getExistingUserId, getCachedProfile, cacheProfile, getCachedGroup, cacheGroup, clearGroupCache } from '../lib/storage';
import { getUserProfile } from '../lib/user-service';
import { getGroup } from '../lib/group-service';
import { Colors } from '../constants/design';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      // userId vorhanden?
      const userId = await getExistingUserId();
      if (!userId) {
        router.replace('/onboarding');
        return;
      }

      // Profil vorhanden? Cache oder Firestore
      let profile = await getCachedProfile();
      if (!profile) {
        try {
          const firestoreProfile = await getUserProfile(userId);
          if (firestoreProfile) {
            await cacheProfile({
              userId: firestoreProfile.userId,
              displayName: firestoreProfile.displayName,
              emoji: firestoreProfile.emoji,
            });
            profile = { userId: firestoreProfile.userId, displayName: firestoreProfile.displayName, emoji: firestoreProfile.emoji };
          } else {
            router.replace('/onboarding');
            return;
          }
        } catch {
          router.replace('/onboarding');
          return;
        }
      }

      // Gruppe optional — Cache wiederherstellen falls vorhanden
      const cachedGroup = await getCachedGroup();
      if (cachedGroup) {
        try {
          const firestoreGroup = await getGroup(cachedGroup.groupId);
          if (!firestoreGroup) {
            await clearGroupCache();
          }
        } catch {
          // Netzwerkfehler, Cache behalten
        }
      } else {
        // Kein Cache — prüfe ob Firestore-Profil eine groupId hat
        try {
          const firestoreProfile = await getUserProfile(profile.userId);
          if (firestoreProfile?.groupId) {
            const group = await getGroup(firestoreProfile.groupId);
            if (group) {
              await cacheGroup({
                groupId: group.groupId,
                name: group.name,
                joinCode: group.joinCode,
              });
            }
          }
        } catch {
          // Netzwerkfehler, weiter ohne Gruppe
        }
      }

      // Gruppe ist optional, immer zu Tabs
      router.replace('/(tabs)');
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
