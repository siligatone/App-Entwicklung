/**
 * Aufgabenliste — Phase 1 Placeholder.
 * Firestore-Listener + echte Aufgaben kommen in Phase 2.
 * Der Verbindungstest läuft hier zur Verifikation.
 */

import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { runConnectionTest } from '../lib/firestore-test';
import { Colors, Spacing, Typography, BorderRadius, Shadows } from '../constants/design';

type ConnectionState = 'idle' | 'loading' | 'success' | 'error';

export default function TasksScreen() {
  const router = useRouter();
  const [connectionState, setConnectionState] = useState<ConnectionState>('idle');
  const [testDocId, setTestDocId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
      {/* Header */}
      <View style={styles.headerRow}>
        <Text style={styles.headerTitle}>Aufgaben</Text>
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
        <Text style={styles.cardLabel}>Phase 1 — Placeholder</Text>
        <Text style={styles.cardText}>
          Hier erscheinen in Phase 2 die echten Aufgaben aus Firestore.
        </Text>
      </View>

      {/* Firestore-Verbindungstest */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Firestore-Verbindungstest</Text>
        <Text style={styles.cardSubtext}>
          Schreibt ein Testdokument in "dev_checks" — keine Produktionsdaten.
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
            <Text style={styles.resultSuccessText}>
              Verbindung erfolgreich
            </Text>
            <Text style={styles.resultDocId}>Doc-ID: {testDocId}</Text>
          </View>
        )}

        {connectionState === 'error' && (
          <View style={styles.resultError}>
            <Text style={styles.resultErrorText}>Fehler: {errorMessage}</Text>
            {errorMessage?.includes('Missing or insufficient permissions') && (
              <Text style={styles.resultHint}>
                Tipp: Firestore-Regeln noch nicht auf "allow write: if true" gesetzt.
              </Text>
            )}
            {errorMessage?.includes('projectId') && (
              <Text style={styles.resultHint}>
                Tipp: .env-Datei prüfen — EXPO_PUBLIC_FIREBASE_PROJECT_ID fehlt.
              </Text>
            )}
          </View>
        )}
      </View>

      {/* Navigation zu anderen Screens */}
      <View style={styles.card}>
        <Text style={styles.cardLabel}>Navigation (Placeholder)</Text>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/profile')}
        >
          <Text style={styles.navButtonText}>→ Profil-Screen</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => router.push('/onboarding')}
        >
          <Text style={styles.navButtonText}>→ Onboarding-Screen</Text>
        </TouchableOpacity>
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
    alignItems: 'center',
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  headerTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
  },
  addButton: {
    width: 44,
    height: 44,
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
  resultHint: {
    color: Colors.textSecondary,
    fontSize: Typography.sizeXS,
    marginTop: Spacing.xs,
  },
  navButton: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.separatorOpaque,
  },
  navButtonText: {
    color: Colors.primary,
    fontSize: Typography.sizeMD,
  },
});
