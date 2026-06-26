/**
 * Aufgabenliste — Phase 2A: User-Header + Verbindungstest.
 * Echte Aufgabenliste kommt in Phase 2B.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedProfile, type CachedProfile } from '../lib/storage';
import { runConnectionTest } from '../lib/firestore-test';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../constants/design';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export default function TasksScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [testDocId, setTestDocId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    getCachedProfile().then(setProfile);
  }, []);

  async function handleConnectionTest() {
    setConnectionState('loading');
    setTestDocId(null);
    setErrorMessage(null);

    const result = await runConnectionTest();

    if (result.success && result.docId) {
      setConnectionState('success');
      setTestDocId(result.docId);
    } else {
      setConnectionState('error');
      setErrorMessage(result.error ?? 'Unbekannter Fehler');
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {/* Header mit User-Info */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Aufgaben</Text>
          {profile && (
            <TouchableOpacity
              style={styles.userBadge}
              onPress={() => router.push('/profile')}
              accessibilityLabel="Profil anzeigen"
            >
              <Text style={styles.userEmoji}>{profile.emoji}</Text>
              <Text style={styles.userName}>{profile.displayName}</Text>
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => router.push('/create')}
          accessibilityLabel="Neue Aufgabe erstellen"
        >
          <Text style={styles.addButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Placeholder-Hinweis */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Phase 2A — Profil aktiv</Text>
        <Text style={styles.cardText}>
          Aufgabenliste kommt in Phase 2B.{'\n'}
          Profil-System und Verbindungstest funktionieren.
        </Text>
      </View>

      {/* Firestore-Verbindungstest */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Firestore-Verbindungstest</Text>
        <Text style={styles.cardSubtext}>
          Schreibt in "dev_checks" — keine Produktionsdaten.
        </Text>

        <TouchableOpacity
          style={[
            styles.testButton,
            connectionState === 'loading' && styles.testButtonDisabled,
          ]}
          onPress={handleConnectionTest}
          disabled={connectionState === 'loading'}
        >
          <Text style={styles.testButtonText}>
            {connectionState === 'loading' ? 'Verbinde...' : 'Verbindung testen'}
          </Text>
        </TouchableOpacity>

        {connectionState === 'success' && (
          <View style={styles.resultSuccess}>
            <Text style={styles.resultSuccessText}>Verbindung erfolgreich</Text>
            <Text style={styles.resultDocId}>Doc-ID: {testDocId}</Text>
          </View>
        )}

        {connectionState === 'error' && (
          <View style={styles.resultError}>
            <Text style={styles.resultErrorText}>Fehler: {errorMessage}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.md,
  },
  headerTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    ...Shadows.sm,
  },
  userEmoji: {
    fontSize: 18,
    marginRight: Spacing.xs,
  },
  userName: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  addButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  addButtonText: {
    color: Colors.textOnPrimary,
    fontSize: 28,
    fontWeight: Typography.weightRegular,
    lineHeight: 32,
    marginTop: -2,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardLabel: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  cardText: {
    fontSize: Typography.sizeMD,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  cardSubtext: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  testButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    alignItems: 'center',
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  testButtonDisabled: {
    opacity: 0.6,
  },
  testButtonText: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightSemiBold,
    fontSize: Typography.sizeMD,
  },
  resultSuccess: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#F0FFF4',
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.success,
  },
  resultSuccessText: {
    color: Colors.success,
    fontWeight: Typography.weightSemiBold,
    fontSize: Typography.sizeSM,
  },
  resultDocId: {
    color: Colors.textTertiary,
    fontSize: Typography.sizeXS,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  resultError: {
    marginTop: Spacing.sm,
    padding: Spacing.sm,
    backgroundColor: '#FFF5F5',
    borderRadius: BorderRadius.sm,
    borderLeftWidth: 3,
    borderLeftColor: Colors.danger,
  },
  resultErrorText: {
    color: Colors.danger,
    fontWeight: Typography.weightSemiBold,
    fontSize: Typography.sizeSM,
  },
});
