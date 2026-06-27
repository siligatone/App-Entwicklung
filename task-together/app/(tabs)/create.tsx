/**
 * Aufgabe erstellen — Titel (Pflicht) + Beschreibung (optional).
 * Optional: Aufgabe einem anderen Demo-User zuweisen.
 */

import { useEffect, useState } from 'react';
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
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedProfile, type CachedProfile } from '../../lib/storage';
import { createTask, type UserSnapshot } from '../../lib/task-service';
import { subscribeToUsers, type UserProfile } from '../../lib/user-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

export default function CreateScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [assignedTo, setAssignedTo] = useState<UserSnapshot | null>(null);

  useEffect(() => {
    getCachedProfile().then(setProfile);
  }, []);

  // Echtzeit-Listener für alle Demo-User
  useEffect(() => {
    const unsubscribe = subscribeToUsers(
      (users) => setAllUsers(users),
      () => {}, // Fehler still ignorieren — Picker ist optional
    );
    return () => unsubscribe();
  }, []);

  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0 && !saving && profile !== null;

  async function handleCreate() {
    if (!canSave || !profile) return;

    setSaving(true);
    setError(null);

    try {
      await createTask(
        { title: trimmedTitle, description: description.trim() },
        {
          userId: profile.userId,
          displayName: profile.displayName,
          emoji: profile.emoji,
        },
        assignedTo,
      );
      setTitle('');
      setDescription('');
      setAssignedTo(null);
      setSaving(false);
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Aufgabe konnte nicht erstellt werden: ${message}`);
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
        <Text style={styles.screenTitle}>Neue Aufgabe</Text>

        {/* Titel */}
        <View style={styles.card}>
          <Text style={styles.label}>Titel *</Text>
          <TextInput
            style={styles.input}
            placeholder="Was ist zu tun?"
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            autoCorrect
            maxLength={100}
            returnKeyType="next"
          />
        </View>

        {/* Beschreibung */}
        <View style={styles.card}>
          <Text style={styles.label}>Beschreibung (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Details, Notizen…"
            placeholderTextColor={Colors.textTertiary}
            value={description}
            onChangeText={setDescription}
            autoCapitalize="sentences"
            autoCorrect
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Zuweisen an (optional) */}
        <View style={styles.card}>
          <Text style={styles.label}>Zuweisen an (optional)</Text>
          {(() => {
            const otherUsers = allUsers.filter((u) => u.userId !== profile?.userId);
            if (otherUsers.length === 0) {
              return (
                <Text style={styles.noUsersHint}>
                  Noch keine anderen Nutzer verfügbar
                </Text>
              );
            }
            return (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.userChips}
              >
                <TouchableOpacity
                  style={[styles.userChip, assignedTo === null && styles.userChipSelected]}
                  onPress={() => setAssignedTo(null)}
                >
                  <Text style={[styles.userChipText, assignedTo === null && styles.userChipTextSelected]}>
                    Niemand
                  </Text>
                </TouchableOpacity>
                {otherUsers.map((user) => (
                  <TouchableOpacity
                    key={user.userId}
                    style={[styles.userChip, assignedTo?.userId === user.userId && styles.userChipSelected]}
                    onPress={() => setAssignedTo({
                      userId: user.userId,
                      displayName: user.displayName,
                      emoji: user.emoji,
                    })}
                  >
                    <Text style={[styles.userChipText, assignedTo?.userId === user.userId && styles.userChipTextSelected]}>
                      {user.displayName} {user.emoji}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            );
          })()}
        </View>

        {/* Ersteller-Info */}
        {profile && (
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorText}>
              Erstellt von {profile.displayName} {profile.emoji}
            </Text>
          </View>
        )}

        {/* Fehler */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.createButton, !canSave && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canSave}
          accessibilityLabel="Aufgabe erstellen"
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.createButtonText}>Aufgabe erstellen</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.replace('/(tabs)')}
          accessibilityLabel="Abbrechen"
        >
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
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
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  screenTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  label: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  input: {
    fontSize: Typography.sizeMD,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.separatorOpaque,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET,
  },
  textArea: {
    minHeight: 100,
    paddingTop: Spacing.md,
  },
  noUsersHint: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  userChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  userChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundPrimary,
    borderWidth: 1.5,
    borderColor: Colors.separatorOpaque,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  userChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  userChipText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  userChipTextSelected: {
    color: Colors.textOnPrimary,
  },
  creatorInfo: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  creatorText: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
  },
  errorBox: {
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
  },
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
  },
  cancelButton: {
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textTertiary,
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
  },
});
