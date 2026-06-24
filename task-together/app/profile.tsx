/**
 * Profil-Screen — Phase 1 Placeholder.
 * Profil anzeigen/bearbeiten kommt später.
 */

import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Typography } from '../constants/design';

export default function ProfileScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👤</Text>
      <Text style={styles.title}>Profil</Text>
      <Text style={styles.subtitle}>
        Hier wird in Phase 2 das Nutzer-Profil angezeigt:{'\n'}
        Name, Emoji, userId.
      </Text>

      <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
        <Text style={styles.backButtonText}>← Zurück</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundPrimary,
    padding: Spacing.xl,
  },
  emoji: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  title: {
    fontSize: Typography.sizeXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: Typography.sizeMD,
    color: Colors.textTertiary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: Spacing.xl,
  },
  backButton: {
    padding: Spacing.md,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
  },
});
