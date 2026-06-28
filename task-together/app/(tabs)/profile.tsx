/**
 * Profil-Screen: Aktuelles Demo-Profil anzeigen + Profil-Reset.
 *
 * Der Reset löscht zuerst das Firestore-Dokument users/{userId},
 * dann die lokalen AsyncStorage-Daten, und leitet zum Onboarding.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedProfile, getCachedGroup, clearUserData, clearGroupCache, type CachedProfile, type CachedGroup } from '../../lib/storage';
import { deleteUserProfile } from '../../lib/user-service';
import { leaveGroup, deleteGroup, subscribeToGroup, type Group } from '../../lib/group-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [cachedGroup, setCachedGroup] = useState<CachedGroup | null>(null);
  const [groupDetail, setGroupDetail] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getCachedProfile(), getCachedGroup()]).then(([p, g]) => {
      setProfile(p);
      setCachedGroup(g);
      setLoading(false);
    });
  }, []);

  // Echtzeit-Listener für Gruppendetails (Mitgliederanzahl etc.)
  useEffect(() => {
    if (!cachedGroup) return;
    const unsubscribe = subscribeToGroup(
      cachedGroup.groupId,
      (g) => setGroupDetail(g),
      () => {}, // Fehler still ignorieren
    );
    return () => unsubscribe();
  }, [cachedGroup]);

  function handleReset() {
    const doReset = async () => {
      setResetting(true);
      setResetError(null);

      try {
        // Zuerst aus Gruppe austreten, damit memberIds sauber bleibt
        if (cachedGroup && profile?.userId) {
          try {
            await leaveGroup(cachedGroup.groupId, profile.userId);
          } catch {
            // Gruppe existiert evtl. nicht mehr — weitermachen
          }
        }
        // Dann Firestore-Profil löschen
        if (profile?.userId) {
          await deleteUserProfile(profile.userId);
        }
        // Lokale Daten löschen
        await clearUserData();
        router.replace('/onboarding');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        setResetError(`Profil konnte nicht gelöscht werden: ${message}`);
        setResetting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Profil wirklich zurücksetzen? Dein Profil wird auch aus der Datenbank gelöscht.')) {
        doReset();
      }
    } else {
      Alert.alert(
        'Profil zurücksetzen',
        'Dein Profil wird aus der Datenbank und vom Gerät gelöscht. Du kannst danach ein neues anlegen.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Zurücksetzen', style: 'destructive', onPress: doReset },
        ],
      );
    }
  }

  function handleLeaveGroup() {
    const doLeave = async () => {
      if (!cachedGroup || !profile) return;
      setLeaving(true);
      setResetError(null);

      try {
        await leaveGroup(cachedGroup.groupId, profile.userId);
        await clearGroupCache();
        setCachedGroup(null);
        setGroupDetail(null);
        setLeaving(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        setResetError(`Gruppe konnte nicht verlassen werden: ${message}`);
        setLeaving(false);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Gruppe wirklich verlassen? Du kannst danach einer neuen Gruppe beitreten.')) {
        doLeave();
      }
    } else {
      Alert.alert(
        'Gruppe verlassen',
        'Du kannst danach einer neuen Gruppe beitreten oder eine neue erstellen.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Verlassen', style: 'destructive', onPress: doLeave },
        ],
      );
    }
  }

  const isGroupCreator = !!(groupDetail && profile && groupDetail.createdBy.userId === profile.userId);

  function handleDeleteGroup() {
    const doDelete = async () => {
      if (!cachedGroup || !groupDetail) return;
      setDeleting(true);
      setResetError(null);

      try {
        await deleteGroup(cachedGroup.groupId, groupDetail.memberIds);
        await clearGroupCache();
        setCachedGroup(null);
        setGroupDetail(null);
        setDeleting(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        setResetError(`Gruppe konnte nicht gelöscht werden: ${message}`);
        setDeleting(false);
      }
    };

    if (Platform.OS === 'web') {
      if (confirm('Gruppe wirklich löschen? Alle Mitglieder werden entfernt. Aufgaben bleiben erhalten.')) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Gruppe löschen',
        'Alle Mitglieder werden entfernt. Aufgaben bleiben erhalten.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Löschen', style: 'destructive', onPress: doDelete },
        ],
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Profil-Karte */}
      <View style={styles.profileCard}>
        <Text style={styles.profileEmoji}>{profile?.emoji ?? '👤'}</Text>
        <Text style={styles.profileName}>{profile?.displayName ?? 'Unbekannt'}</Text>

        {/* userId (gekürzt) */}
        <View style={styles.idBadge}>
          <Text style={styles.idLabel}>Geräte-ID</Text>
          <Text style={styles.idValue}>
            {profile?.userId ? `${profile.userId.slice(0, 8)}…` : '–'}
          </Text>
        </View>
      </View>

      {/* Gruppen-Karte — ohne Gruppe: Erstellen/Beitreten */}
      {!cachedGroup && (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>Keine Gruppe</Text>
          <Text style={styles.noGroupHint}>
            Du nutzt die App privat. Erstelle oder tritt einer Gruppe bei, um Aufgaben mit anderen zu teilen.
          </Text>
          <TouchableOpacity
            style={styles.groupActionButton}
            onPress={() => router.push('/group-setup')}
          >
            <Text style={styles.groupActionButtonText}>Gruppe erstellen oder beitreten</Text>
          </TouchableOpacity>
        </View>
      )}

      {cachedGroup && (
        <View style={styles.groupCard}>
          <Text style={styles.groupTitle}>{cachedGroup.name}</Text>

          <View style={styles.groupInfoRow}>
            <Text style={styles.groupInfoLabel}>Join-Code</Text>
            <Text style={styles.groupInfoCode}>{cachedGroup.joinCode}</Text>
          </View>

          {groupDetail && (
            <View style={styles.groupInfoRow}>
              <Text style={styles.groupInfoLabel}>Mitglieder</Text>
              <Text style={styles.groupInfoValue}>{groupDetail.memberIds.length}</Text>
            </View>
          )}

          {isGroupCreator ? (
            <TouchableOpacity
              style={[styles.leaveButton, deleting && styles.leaveButtonDisabled]}
              onPress={handleDeleteGroup}
              disabled={deleting}
              accessibilityLabel="Gruppe löschen"
            >
              {deleting ? (
                <ActivityIndicator color={Colors.danger} />
              ) : (
                <Text style={styles.leaveButtonText}>Gruppe löschen</Text>
              )}
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.leaveButton, leaving && styles.leaveButtonDisabled]}
              onPress={handleLeaveGroup}
              disabled={leaving}
              accessibilityLabel="Gruppe verlassen"
            >
              {leaving ? (
                <ActivityIndicator color={Colors.danger} />
              ) : (
                <Text style={styles.leaveButtonText}>Gruppe verlassen</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Fehler */}
      {resetError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{resetError}</Text>
        </View>
      )}

      {/* Reset-Button */}
      <TouchableOpacity
        style={[styles.resetButton, resetting && styles.resetButtonDisabled]}
        onPress={handleReset}
        disabled={resetting}
        accessibilityLabel="Profil zurücksetzen"
      >
        {resetting ? (
          <ActivityIndicator color={Colors.textOnPrimary} />
        ) : (
          <Text style={styles.resetButtonText}>Profil zurücksetzen</Text>
        )}
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.backgroundPrimary,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  container: {
    padding: Spacing.lg,
    paddingTop: Spacing.xxl,
    paddingBottom: Spacing.xxl,
    alignItems: 'center',
  },
  profileCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    width: '100%',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  profileEmoji: {
    fontSize: 72,
    marginBottom: Spacing.md,
  },
  profileName: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  idBadge: {
    backgroundColor: Colors.backgroundPrimary,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  idLabel: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  idValue: {
    fontSize: Typography.sizeSM,
    color: Colors.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  // --- Gruppe ---
  groupCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  groupTitle: {
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  groupInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separatorOpaque,
  },
  groupInfoLabel: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
  },
  groupInfoCode: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
    color: Colors.primary,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  groupInfoValue: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textPrimary,
  },
  noGroupHint: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  groupActionButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  groupActionButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
  },
  leaveButton: {
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.danger,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  leaveButtonDisabled: {
    opacity: 0.6,
  },
  leaveButtonText: {
    color: Colors.danger,
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
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
  resetButton: {
    backgroundColor: Colors.danger,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    width: '100%',
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  resetButtonDisabled: {
    opacity: 0.6,
  },
  resetButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
  },
});
