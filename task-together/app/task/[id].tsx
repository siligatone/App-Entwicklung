/**
 * Task Details + Bearbeiten — Echtzeit-Sync via onSnapshot.
 * Zeigt alle Infos zu einem Task. Titel und Beschreibung sind bearbeitbar.
 */

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { subscribeToTask, updateTask, type Task } from '../../lib/task-service';
import { suggestSubtasksAI } from '../../lib/task-assistant';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

/** Firestore Timestamp zu Date — gibt null zurück wenn nicht verfügbar. */
function toDate(timestamp: unknown): Date | null {
  if (timestamp == null) return null;
  if (typeof (timestamp as { toDate?: unknown }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (timestamp instanceof Date) return timestamp;
  return null;
}

/** Deutsches Zeitformat: "Heute, 14:30" / "Gestern, 09:15" / "25.06., 10:15" */
function formatTimestamp(timestamp: unknown): string {
  const date = toDate(timestamp);
  if (!date) return '–';

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const taskDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  const time = date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });

  if (taskDay.getTime() === today.getTime()) return `Heute, ${time}`;
  if (taskDay.getTime() === yesterday.getTime()) return `Gestern, ${time}`;

  const day = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return `${day}, ${time}`;
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit-Modus
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestSource, setSuggestSource] = useState<'ai' | 'local' | null>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = subscribeToTask(
      id,
      (t) => {
        if (t === null) {
          setError('Aufgabe nicht gefunden oder gelöscht.');
          setTask(null);
        } else {
          setTask(t);
          setError(null);
        }
        setLoading(false);
      },
      (msg) => {
        setError(msg);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [id]);

  function startEditing() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description);
    setSaveError(null);
    setSuggestions([]);
    setAddedSuggestions(new Set());
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
    setSaveError(null);
    setSuggestions([]);
    setAddedSuggestions(new Set());
  }

  async function handleSave() {
    if (!task || editTitle.trim().length === 0) return;

    setSaving(true);
    setSaveError(null);

    try {
      await updateTask(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim(),
      });
      setEditing(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setSaveError(`Änderung konnte nicht gespeichert werden: ${message}`);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !task) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorTitle}>{error ?? 'Aufgabe nicht gefunden'}</Text>
        <TouchableOpacity style={styles.backLink} onPress={() => router.back()}>
          <Text style={styles.backLinkText}>← Zurück</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Edit-Modus
  if (editing) {
    return (
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.sectionTitle}>Aufgabe bearbeiten</Text>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Titel *</Text>
          <TextInput
            style={styles.input}
            value={editTitle}
            onChangeText={setEditTitle}
            placeholder="Was ist zu tun?"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="sentences"
            autoCorrect
            maxLength={100}
          />
        </View>

        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Beschreibung (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={editDescription}
            onChangeText={setEditDescription}
            placeholder="Details, Notizen…"
            placeholderTextColor={Colors.textTertiary}
            autoCapitalize="sentences"
            autoCorrect
            maxLength={500}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Assistent — Unteraufgaben vorschlagen */}
        <TouchableOpacity
          style={[styles.suggestButton, (editTitle.trim().length === 0 || suggestLoading) && styles.suggestButtonDisabled]}
          onPress={async () => {
            setSuggestLoading(true);
            setSuggestions([]);
            setAddedSuggestions(new Set());
            const result = await suggestSubtasksAI(editTitle.trim(), editDescription.trim() || undefined);
            setSuggestions(result.suggestions);
            setSuggestSource(result.source);
            setSuggestLoading(false);
          }}
          disabled={editTitle.trim().length === 0 || suggestLoading}
        >
          {suggestLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.suggestButtonText, editTitle.trim().length === 0 && styles.suggestButtonTextDisabled]}>
              💡 KI-Unteraufgaben vorschlagen
            </Text>
          )}
        </TouchableOpacity>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsLabel}>
              {suggestSource === 'ai' ? 'KI-Vorschläge' : 'Lokale Vorschläge'} — antippen zum Hinzufügen:
            </Text>
            {suggestions.map((s) => {
              const isAdded = addedSuggestions.has(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestionChip, isAdded && styles.suggestionChipAdded]}
                  onPress={() => {
                    if (isAdded) return;
                    setEditDescription((prev) => {
                      const prefix = prev.trim().length > 0 ? `${prev.trim()}\n` : '';
                      return `${prefix}• ${s}`;
                    });
                    setAddedSuggestions((prev) => new Set(prev).add(s));
                  }}
                  disabled={isAdded}
                >
                  <Text style={[styles.suggestionText, isAdded && styles.suggestionTextAdded]}>
                    {isAdded ? '✓ ' : '+ '}{s}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {saveError && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{saveError}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[styles.saveButton, (editTitle.trim().length === 0 || saving) && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={editTitle.trim().length === 0 || saving}
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.saveButtonText}>Speichern</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelEditButton} onPress={cancelEditing}>
          <Text style={styles.cancelEditText}>Abbrechen</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  }

  // Detail-Ansicht
  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Status */}
      <View style={[styles.statusBadge, task.done ? styles.statusDone : styles.statusOpen]}>
        <Text style={[styles.statusText, task.done ? styles.statusTextDone : styles.statusTextOpen]}>
          {task.done ? '✓ Erledigt' : '○ Offen'}
        </Text>
      </View>

      {/* Titel */}
      <Text style={styles.detailTitle}>{task.title}</Text>

      {/* Beschreibung */}
      {task.description !== '' && (
        <Text style={styles.detailDescription}>{task.description}</Text>
      )}

      {/* Zugewiesen an */}
      {task.assignedTo && (
        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>Zugewiesen an</Text>
          <Text style={styles.infoValue}>
            {task.assignedTo.displayName} {task.assignedTo.emoji}
          </Text>
        </View>
      )}

      {/* Meta-Informationen */}
      <View style={styles.metaCard}>
        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Erstellt von</Text>
          <Text style={styles.metaValue}>
            {task.createdBy.displayName} {task.createdBy.emoji}
          </Text>
        </View>

        <View style={styles.metaSeparator} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Erstellt am</Text>
          <Text style={styles.metaValue}>{formatTimestamp(task.createdAt)}</Text>
        </View>

        <View style={styles.metaSeparator} />

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Aktualisiert am</Text>
          <Text style={styles.metaValue}>{formatTimestamp(task.updatedAt)}</Text>
        </View>

        {task.done && task.completedBy && (
          <>
            <View style={styles.metaSeparator} />
            <View style={styles.metaRow}>
              <Text style={styles.metaLabel}>Erledigt von</Text>
              <Text style={[styles.metaValue, styles.metaValueSuccess]}>
                {task.completedBy.displayName} {task.completedBy.emoji}
              </Text>
            </View>
          </>
        )}
      </View>

      {/* Bearbeiten-Button */}
      <TouchableOpacity style={styles.editButton} onPress={startEditing}>
        <Text style={styles.editButtonText}>Bearbeiten</Text>
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
    padding: Spacing.lg,
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  container: {
    padding: Spacing.lg,
    paddingBottom: Spacing.xxl,
  },
  // --- Error State ---
  errorEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  errorTitle: {
    fontSize: Typography.sizeMD,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  backLink: {
    padding: Spacing.md,
  },
  backLinkText: {
    color: Colors.primary,
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
  },
  // --- Status Badge ---
  statusBadge: {
    alignSelf: 'flex-start',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.md,
  },
  statusOpen: {
    backgroundColor: Colors.primary + '15',
  },
  statusDone: {
    backgroundColor: Colors.success + '15',
  },
  statusText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
  },
  statusTextOpen: {
    color: Colors.primary,
  },
  statusTextDone: {
    color: Colors.success,
  },
  // --- Detail Content ---
  detailTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    lineHeight: 32,
  },
  detailDescription: {
    fontSize: Typography.sizeMD,
    color: Colors.textSecondary,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  // --- Assigned Info ---
  infoCard: {
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  infoLabel: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  infoValue: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
    color: Colors.primary,
  },
  // --- Meta Card ---
  metaCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  metaLabel: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
  },
  metaValue: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textPrimary,
  },
  metaValueSuccess: {
    color: Colors.success,
  },
  metaSeparator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Colors.separatorOpaque,
  },
  // --- Edit Button ---
  editButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadows.md,
  },
  editButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
  },
  // --- Assistent ---
  suggestButton: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primary + '40',
    borderStyle: 'dashed',
  },
  suggestButtonDisabled: {
    opacity: 0.4,
    borderColor: Colors.separatorOpaque,
  },
  suggestButtonText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.primary,
  },
  suggestButtonTextDisabled: {
    color: Colors.textTertiary,
  },
  suggestionsCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  suggestionsLabel: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    marginBottom: Spacing.sm,
  },
  suggestionChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundPrimary,
    marginBottom: Spacing.xs,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  suggestionChipAdded: {
    backgroundColor: Colors.success + '15',
  },
  suggestionText: {
    fontSize: Typography.sizeSM,
    color: Colors.primary,
    fontWeight: Typography.weightMedium,
  },
  suggestionTextAdded: {
    color: Colors.success,
  },
  // --- Edit Mode ---
  sectionTitle: {
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
  fieldLabel: {
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
  saveButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
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
  cancelEditButton: {
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelEditText: {
    color: Colors.textTertiary,
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
  },
});
