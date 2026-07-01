// Onboarding: Name + Emoji wählen, Profil anlegen

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getUserId, cacheProfile } from '../lib/storage';
import { createUserProfile } from '../lib/user-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../constants/design';

const EMOJI_OPTIONS = [
  '🦊', '🚀', '🌟', '🎯', '🐻', '🦋', '🌈', '🔥',
  '🍀', '💎', '🎨', '🦁', '🐱', '🌻', '⚡', '🎵',
  '🏄', '🎲', '🦄', '🐧', '🍕', '🍚', '🎸', '🌊',
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState<string>(EMOJI_OPTIONS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = name.trim();
  const canSave = trimmedName.length > 0 && !saving;

  async function handleSave() {
    if (!canSave) return;

    setSaving(true);
    setError(null);

    try {
      const userId = await getUserId();

      await createUserProfile(userId, trimmedName, selectedEmoji);

      await cacheProfile({ userId, displayName: trimmedName, emoji: selectedEmoji });

      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Profil konnte nicht gespeichert werden: ${message}`);
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <Text style={styles.welcomeEmoji}>👋</Text>
        <Text style={styles.title}>Willkommen bei TaskTogether</Text>
        <Text style={styles.subtitle}>
          Erstelle dein Profil, um loszulegen.
        </Text>

        {/* Name */}
        <View style={styles.card}>
          <Text style={styles.label}>Dein Name</Text>
          <TextInput
            style={styles.input}
            placeholder="z. B. Max"
            placeholderTextColor={Colors.textTertiary}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={20}
            returnKeyType="done"
          />
        </View>

        {/* Emoji-Auswahl — horizontales Carousel */}
        <View style={styles.card}>
          <Text style={styles.label}>Wähle dein Emoji</Text>
          <FlatList
            data={EMOJI_OPTIONS}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.emojiCarousel}
            renderItem={({ item: emoji }) => (
              <TouchableOpacity
                style={[
                  styles.emojiButton,
                  selectedEmoji === emoji && styles.emojiButtonSelected,
                ]}
                onPress={() => setSelectedEmoji(emoji)}
                accessibilityLabel={`Emoji ${emoji} auswählen`}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            )}
          />
        </View>

        {/* Vorschau */}
        <View style={styles.previewCard}>
          <Text style={styles.previewEmoji}>{selectedEmoji}</Text>
          <Text style={styles.previewName}>
            {trimmedName || 'Dein Name'}
          </Text>
        </View>

        {/* Fehler */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Save-Button */}
        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={!canSave}
          accessibilityLabel="Profil speichern und loslegen"
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Loslegen</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardView: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },
  welcomeEmoji: {
    fontSize: 56,
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontSize: Typography.sizeMD,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
    ...Shadows.sm,
  },
  label: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.sizeLG,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.separatorOpaque,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  emojiCarousel: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  emojiButton: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundPrimary,
  },
  emojiButtonSelected: {
    backgroundColor: Colors.primaryLight,
    ...Shadows.sm,
  },
  emojiText: {
    fontSize: 24,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    width: '100%',
    ...Shadows.sm,
  },
  previewEmoji: {
    fontSize: 36,
    marginRight: Spacing.md,
  },
  previewName: {
    fontSize: Typography.sizeXL,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textPrimary,
  },
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    width: '100%',
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
  },
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
  },
});
