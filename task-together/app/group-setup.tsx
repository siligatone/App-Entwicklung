/**
 * Group Setup Screen: Gruppe erstellen oder per Join-Code beitreten.
 *
 * Wird angezeigt, wenn der Nutzer ein Profil hat, aber noch keiner Gruppe angehört.
 * Nach Erfolg wird die Gruppe lokal gecacht und zur Hauptansicht navigiert.
 */

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
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedProfile, cacheGroup } from '../lib/storage';
import { createGroup, joinGroup } from '../lib/group-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../constants/design';

type Mode = 'create' | 'join';

export default function GroupSetupScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('create');

  // Create-Modus
  const [groupName, setGroupName] = useState('');

  // Join-Modus
  const [joinCode, setJoinCode] = useState('');

  // Shared State
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedName = groupName.trim();
  const trimmedCode = joinCode.trim().toUpperCase();

  const canCreate = trimmedName.length > 0 && !saving;
  const canJoin = trimmedCode.length === 6 && !saving;

  async function handleCreate() {
    if (!canCreate) return;

    setSaving(true);
    setError(null);

    try {
      const profile = await getCachedProfile();
      if (!profile) {
        setError('Kein Profil gefunden. Bitte starte die App neu.');
        setSaving(false);
        return;
      }

      const group = await createGroup(trimmedName, {
        userId: profile.userId,
        displayName: profile.displayName,
        emoji: profile.emoji,
      });

      await cacheGroup({
        groupId: group.groupId,
        name: group.name,
        joinCode: group.joinCode,
      });

      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Gruppe konnte nicht erstellt werden: ${message}`);
      setSaving(false);
    }
  }

  async function handleJoin() {
    if (!canJoin) return;

    setSaving(true);
    setError(null);

    try {
      const profile = await getCachedProfile();
      if (!profile) {
        setError('Kein Profil gefunden. Bitte starte die App neu.');
        setSaving(false);
        return;
      }

      const group = await joinGroup(trimmedCode, {
        userId: profile.userId,
        displayName: profile.displayName,
        emoji: profile.emoji,
      });

      if (!group) {
        setError('Ungültiger Join-Code. Bitte überprüfe den Code und versuche es erneut.');
        setSaving(false);
        return;
      }

      await cacheGroup({
        groupId: group.groupId,
        name: group.name,
        joinCode: group.joinCode,
      });

      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Beitritt fehlgeschlagen: ${message}`);
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
        <Text style={styles.headerEmoji}>👥</Text>
        <Text style={styles.title}>Gruppe wählen</Text>
        <Text style={styles.subtitle}>
          Erstelle eine neue Gruppe oder tritt einer bestehenden bei.
        </Text>

        {/* Mode Toggle */}
        <View style={styles.toggleRow}>
          <TouchableOpacity
            style={[styles.toggleButton, mode === 'create' && styles.toggleActive]}
            onPress={() => { setMode('create'); setError(null); }}
            accessibilityLabel="Gruppe erstellen"
          >
            <Text style={[styles.toggleText, mode === 'create' && styles.toggleTextActive]}>
              Erstellen
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleButton, mode === 'join' && styles.toggleActive]}
            onPress={() => { setMode('join'); setError(null); }}
            accessibilityLabel="Gruppe beitreten"
          >
            <Text style={[styles.toggleText, mode === 'join' && styles.toggleTextActive]}>
              Beitreten
            </Text>
          </TouchableOpacity>
        </View>

        {/* Create Mode */}
        {mode === 'create' && (
          <View style={styles.card}>
            <Text style={styles.label}>Gruppenname</Text>
            <TextInput
              style={styles.input}
              placeholder="z. B. Team Alpha"
              placeholderTextColor={Colors.textTertiary}
              value={groupName}
              onChangeText={setGroupName}
              autoCapitalize="words"
              autoCorrect={false}
              maxLength={30}
              returnKeyType="done"
            />
            <Text style={styles.hint}>
              Nach dem Erstellen erhältst du einen Join-Code, den du mit anderen teilen kannst.
            </Text>
          </View>
        )}

        {/* Join Mode */}
        {mode === 'join' && (
          <View style={styles.card}>
            <Text style={styles.label}>Join-Code</Text>
            <TextInput
              style={[styles.input, styles.codeInput]}
              placeholder="z. B. ABC123"
              placeholderTextColor={Colors.textTertiary}
              value={joinCode}
              onChangeText={(text) => setJoinCode(text.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={6}
              returnKeyType="done"
            />
            <Text style={styles.hint}>
              Frage ein Gruppenmitglied nach dem 6-stelligen Code.
            </Text>
          </View>
        )}

        {/* Fehler */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Action Button */}
        {mode === 'create' ? (
          <TouchableOpacity
            style={[styles.actionButton, !canCreate && styles.actionButtonDisabled]}
            onPress={handleCreate}
            disabled={!canCreate}
            accessibilityLabel="Gruppe erstellen"
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>Gruppe erstellen</Text>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.actionButton, !canJoin && styles.actionButtonDisabled]}
            onPress={handleJoin}
            disabled={!canJoin}
            accessibilityLabel="Gruppe beitreten"
          >
            {saving ? (
              <ActivityIndicator color={Colors.textOnPrimary} />
            ) : (
              <Text style={styles.actionButtonText}>Beitreten</Text>
            )}
          </TouchableOpacity>
        )}
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
    paddingTop: Spacing.xxl + Spacing.xl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },
  headerEmoji: {
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
  toggleRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
    width: '100%',
    ...Shadows.sm,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleText: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  toggleTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightSemiBold,
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
  codeInput: {
    textAlign: 'center',
    letterSpacing: 4,
    fontSize: Typography.sizeXL,
    fontWeight: Typography.weightSemiBold,
  },
  hint: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    marginTop: Spacing.sm,
    lineHeight: 16,
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
  actionButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
  },
});
