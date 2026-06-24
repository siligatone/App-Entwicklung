/**
 * Entry Point.
 * Prüft ob eine userId in AsyncStorage existiert.
 * Leitet weiter zu Onboarding (neu) oder Tasks (bekannt).
 */

import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getExistingUserId } from '../lib/storage';
import { Colors } from '../constants/design';

export default function Index() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const userId = await getExistingUserId();
      if (userId) {
        router.replace('/tasks');
      } else {
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
