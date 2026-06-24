/**
 * Onboarding-Screen — Phase 1 Placeholder.
 * Name + Emoji-Eingabe kommt in Phase 2.
 */

import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, Typography } from '../constants/design';

export default function OnboardingScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>👋</Text>
      <Text style={styles.title}>Willkommen bei TaskTogether</Text>
      <Text style={styles.subtitle}>
        Hier wird in Phase 2 das Profil-Setup eingebaut.{'\n'}
        Name + Emoji wählen.
      </Text>
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
  },
});
