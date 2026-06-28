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
import { getCachedProfile, getCachedGroup, type CachedProfile, type CachedGroup } from '../../lib/storage';
import { subscribeToTask, updateTask, toggleSubtask, generateId, type Task, type Priority, type Subtask } from '../../lib/task-service';
import { subscribeToUserProfile, addUserLabel, type UserProfile } from '../../lib/user-service';
import { subscribeToGroup, addGroupLabel, type Group } from '../../lib/group-service';
import { suggestSubtasksAI } from '../../lib/task-assistant';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';
import DatePicker from '../../components/DatePicker';

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

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: Colors.success },
  medium: { label: 'Mittel', color: Colors.warning },
  high: { label: 'Hoch', color: Colors.danger },
};

function formatEffort(minutes: number | null | undefined): string | null {
  if (minutes == null) return null;
  if (minutes < 60) return `${minutes} Min`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
}

function formatDeadlineDetail(timestamp: unknown): { text: string; overdue: boolean } | null {
  const date = toDate(timestamp);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((deadlineDay.getTime() - today.getTime()) / 86400000);

  const formatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  if (diffDays < 0) return { text: `${formatted} (Überfällig)`, overdue: true };
  if (diffDays === 0) return { text: `${formatted} (Heute)`, overdue: false };
  if (diffDays === 1) return { text: `${formatted} (Morgen)`, overdue: false };
  return { text: formatted, overdue: false };
}

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [group, setGroup] = useState<CachedGroup | null>(null);
  const [task, setTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Edit-Modus
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPriority, setEditPriority] = useState<Priority | null>(null);
  const [editLabels, setEditLabels] = useState<Set<string>>(new Set());
  const [editEffort, setEditEffort] = useState<number | null>(null);
  const [editDeadline, setEditDeadline] = useState<Date | null>(null);
  const [editSubtasks, setEditSubtasks] = useState<Subtask[]>([]);
  const [saving, setSaving] = useState(false);
  const [togglingSubtaskIds, setTogglingSubtaskIds] = useState<Set<string>>(new Set());
  const [saveError, setSaveError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestSource, setSuggestSource] = useState<'ai' | 'local' | null>(null);
  const [newLabelText, setNewLabelText] = useState('');
  const [groupDetail, setGroupDetail] = useState<Group | null>(null);
  const [userDetail, setUserDetail] = useState<UserProfile | null>(null);

  const [cacheLoaded, setCacheLoaded] = useState(false);

  useEffect(() => {
    Promise.all([getCachedProfile(), getCachedGroup()]).then(([p, g]) => {
      setProfile(p);
      setGroup(g);
      setCacheLoaded(true);
    });
  }, []);

  // Labels: Echtzeit-Listener für Gruppe und User
  useEffect(() => {
    if (!group) return;
    const unsub = subscribeToGroup(group.groupId, (g) => setGroupDetail(g), () => {});
    return () => unsub();
  }, [group]);

  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToUserProfile(profile.userId, (p) => setUserDetail(p), () => {});
    return () => unsub();
  }, [profile]);

  useEffect(() => {
    if (!id || !cacheLoaded || !profile) return;

    const unsubscribe = subscribeToTask(
      id,
      (t) => {
        if (t === null) {
          setError('Aufgabe nicht gefunden oder gelöscht.');
          setTask(null);
        } else if (t.groupId != null && group && t.groupId !== group.groupId) {
          setError('Diese Aufgabe gehört nicht zu deiner Gruppe.');
          setTask(null);
        } else if (t.groupId != null && !group) {
          setError('Diese Aufgabe gehört zu einer Gruppe.');
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
  }, [id, cacheLoaded, profile, group]);

  // Verfügbare Labels je nach Task-Scope
  const availableLabels = task?.groupId && groupDetail
    ? (groupDetail.labels ?? [])
    : (userDetail?.labels ?? []);

  async function handleAddLabel() {
    const trimmed = newLabelText.trim();
    if (!trimmed || availableLabels.includes(trimmed)) {
      setNewLabelText('');
      return;
    }
    if (task?.groupId && group) {
      await addGroupLabel(group.groupId, trimmed);
    } else if (profile) {
      await addUserLabel(profile.userId, trimmed);
    }
    setEditLabels((prev) => new Set(prev).add(trimmed));
    setNewLabelText('');
  }

  function startEditing() {
    if (!task) return;
    setEditTitle(task.title);
    setEditDescription(task.description);
    setEditPriority(task.priority ?? null);
    setEditLabels(new Set(task.labels ?? []));
    setEditEffort(task.effortEstimate ?? null);
    setEditDeadline(toDate(task.deadline));
    setEditSubtasks(task.subtasks ?? []);
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
        groupId: task.groupId ?? group?.groupId ?? null,
        priority: editPriority,
        labels: [...editLabels],
        effortEstimate: editEffort,
        deadline: editDeadline,
        subtasks: editSubtasks,
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
                    setEditSubtasks((prev) => [...prev, { id: generateId(), title: s, done: false }]);
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

        {/* Unterpunkte im Edit-Modus */}
        {editSubtasks.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Unterpunkte ({editSubtasks.length})</Text>
            {editSubtasks.map((st) => (
              <View key={st.id} style={styles.editSubtaskRow}>
                <TouchableOpacity
                  style={styles.editSubtaskCheck}
                  onPress={() => setEditSubtasks((prev) =>
                    prev.map((s) => s.id === st.id ? { ...s, done: !s.done } : s),
                  )}
                >
                  {st.done ? (
                    <View style={styles.subtaskCheckDone}><Text style={styles.subtaskCheckMark}>✓</Text></View>
                  ) : (
                    <View style={styles.subtaskCheckEmpty} />
                  )}
                </TouchableOpacity>
                <Text style={[styles.editSubtaskTitle, st.done && styles.editSubtaskTitleDone]} numberOfLines={2}>
                  {st.title}
                </Text>
                <TouchableOpacity
                  style={styles.editSubtaskRemove}
                  onPress={() => setEditSubtasks((prev) => prev.filter((s) => s.id !== st.id))}
                >
                  <Text style={styles.editSubtaskRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Priorität */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Priorität</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {([
              { value: null, label: 'Keine' },
              { value: 'low' as Priority, label: 'Niedrig' },
              { value: 'medium' as Priority, label: 'Mittel' },
              { value: 'high' as Priority, label: 'Hoch' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.metaChip, editPriority === opt.value && styles.metaChipSelected]}
                onPress={() => setEditPriority(opt.value)}
              >
                <Text style={[styles.metaChipText, editPriority === opt.value && styles.metaChipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Labels */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Labels</Text>
          <View style={styles.chipWrap}>
            {availableLabels.map((lbl) => {
              const isSelected = editLabels.has(lbl);
              return (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.metaChip, isSelected && styles.metaChipSelected]}
                  onPress={() => setEditLabels((prev) => {
                    const next = new Set(prev);
                    if (next.has(lbl)) next.delete(lbl); else next.add(lbl);
                    return next;
                  })}
                >
                  <Text style={[styles.metaChipText, isSelected && styles.metaChipTextSelected]}>
                    {lbl}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
          {/* Neues Label erstellen */}
          <View style={styles.newLabelRow}>
            <TextInput
              style={styles.newLabelInput}
              placeholder="Neues Label…"
              placeholderTextColor={Colors.textTertiary}
              value={newLabelText}
              onChangeText={setNewLabelText}
              maxLength={20}
              returnKeyType="done"
              onSubmitEditing={handleAddLabel}
            />
            <TouchableOpacity
              style={[styles.newLabelButton, !newLabelText.trim() && styles.newLabelButtonDisabled]}
              onPress={handleAddLabel}
              disabled={!newLabelText.trim()}
            >
              <Text style={[styles.newLabelButtonText, !newLabelText.trim() && styles.newLabelButtonTextDisabled]}>
                + Hinzufügen
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Aufwand */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Geschätzter Aufwand</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {([
              { value: null, label: 'Keine' },
              { value: 15, label: '15 Min' },
              { value: 30, label: '30 Min' },
              { value: 60, label: '1h' },
              { value: 120, label: '2h' },
              { value: 240, label: '4h' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.metaChip, editEffort === opt.value && styles.metaChipSelected]}
                onPress={() => setEditEffort(opt.value)}
              >
                <Text style={[styles.metaChipText, editEffort === opt.value && styles.metaChipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Deadline */}
        <View style={styles.card}>
          <Text style={styles.fieldLabel}>Deadline</Text>
          <DatePicker value={editDeadline} onChange={setEditDeadline} />
        </View>

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

      {/* Subtasks */}
      {(task.subtasks ?? []).length > 0 && (
        <View style={styles.subtasksDetailCard}>
          <View style={styles.subtasksDetailHeader}>
            <Text style={styles.fieldLabel}>Unterpunkte</Text>
            <Text style={styles.subtasksProgress}>
              {(task.subtasks ?? []).filter((s) => s.done).length}/{(task.subtasks ?? []).length} erledigt
            </Text>
          </View>
          {(task.subtasks ?? []).map((st) => (
            <TouchableOpacity
              key={st.id}
              style={styles.subtaskDetailRow}
              onPress={async () => {
                if (togglingSubtaskIds.has(st.id)) return;
                setTogglingSubtaskIds((prev) => new Set(prev).add(st.id));
                try {
                  await toggleSubtask(task.id, st.id, !st.done, task.subtasks ?? []);
                } finally {
                  setTogglingSubtaskIds((prev) => {
                    const next = new Set(prev);
                    next.delete(st.id);
                    return next;
                  });
                }
              }}
              disabled={togglingSubtaskIds.has(st.id)}
              activeOpacity={0.7}
            >
              {togglingSubtaskIds.has(st.id) ? (
                <ActivityIndicator size="small" color={Colors.primary} style={styles.subtaskCheckArea} />
              ) : st.done ? (
                <View style={styles.subtaskCheckDone}><Text style={styles.subtaskCheckMark}>✓</Text></View>
              ) : (
                <View style={styles.subtaskCheckEmpty} />
              )}
              <Text style={[styles.subtaskDetailTitle, st.done && styles.subtaskDetailTitleDone]} numberOfLines={2}>
                {st.title}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Task-Metadaten */}
      {!!(task.priority || (task.labels && task.labels.length > 0) || task.effortEstimate || task.deadline) && (
        <View style={styles.metadataCard}>
          {task.priority && PRIORITY_CONFIG[task.priority] && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Priorität</Text>
              <View style={[styles.metadataBadge, { backgroundColor: PRIORITY_CONFIG[task.priority].color + '18' }]}>
                <Text style={[styles.metadataBadgeText, { color: PRIORITY_CONFIG[task.priority].color }]}>
                  {PRIORITY_CONFIG[task.priority].label}
                </Text>
              </View>
            </View>
          )}
          {task.labels && task.labels.length > 0 && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Labels</Text>
              <View style={styles.metadataChips}>
                {task.labels.map((lbl) => (
                  <View key={lbl} style={[styles.metadataBadge, { backgroundColor: Colors.primary + '15' }]}>
                    <Text style={[styles.metadataBadgeText, { color: Colors.primary }]}>{lbl}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
          {task.effortEstimate != null && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Aufwand</Text>
              <Text style={styles.metadataValue}>{formatEffort(task.effortEstimate)}</Text>
            </View>
          )}
          {!!task.deadline && formatDeadlineDetail(task.deadline) && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Deadline</Text>
              <Text style={[
                styles.metadataValue,
                formatDeadlineDetail(task.deadline)!.overdue && !task.done && { color: Colors.danger, fontWeight: Typography.weightSemiBold },
              ]}>
                {formatDeadlineDetail(task.deadline)!.text}
              </Text>
            </View>
          )}
        </View>
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

      {/* Bearbeiten-Button — nur für Ersteller (Demo-UI-Guard) */}
      {profile && task.createdBy.userId === profile.userId ? (
        <TouchableOpacity style={styles.editButton} onPress={startEditing}>
          <Text style={styles.editButtonText}>Bearbeiten</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.permissionNote}>
          <Text style={styles.permissionNoteText}>
            Nur {task.createdBy.displayName} {task.createdBy.emoji} kann diese Aufgabe bearbeiten.
          </Text>
        </View>
      )}
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
  // --- Metadata Detail ---
  metadataCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  metadataLabel: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    marginRight: Spacing.md,
  },
  metadataValue: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textPrimary,
  },
  metadataChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  metadataBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  metadataBadgeText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
  },
  // --- Edit Chips ---
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  newLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  newLabelInput: {
    flex: 1,
    fontSize: Typography.sizeSM,
    color: Colors.textPrimary,
    borderWidth: 1,
    borderColor: Colors.separatorOpaque,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
  },
  newLabelButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  newLabelButtonDisabled: {
    opacity: 0.4,
  },
  newLabelButtonText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.primary,
  },
  newLabelButtonTextDisabled: {
    color: Colors.textTertiary,
  },
  metaChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundPrimary,
    borderWidth: 1.5,
    borderColor: Colors.separatorOpaque,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  metaChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  metaChipText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  metaChipTextSelected: {
    color: Colors.textOnPrimary,
  },
  // --- Subtasks Detail ---
  subtasksDetailCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  subtasksDetailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  subtasksProgress: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    fontWeight: Typography.weightMedium,
  },
  subtaskDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separatorOpaque,
    minHeight: MIN_TOUCH_TARGET,
  },
  subtaskCheckArea: {
    width: 22,
    height: 22,
    marginRight: Spacing.sm,
  },
  subtaskCheckEmpty: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.separator,
    marginRight: Spacing.sm,
  },
  subtaskCheckDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  subtaskCheckMark: {
    color: Colors.textOnPrimary,
    fontSize: 12,
    fontWeight: Typography.weightBold,
  },
  subtaskDetailTitle: {
    flex: 1,
    fontSize: Typography.sizeSM,
    color: Colors.textPrimary,
  },
  subtaskDetailTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  // --- Edit Subtasks ---
  editSubtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separatorOpaque,
  },
  editSubtaskCheck: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  editSubtaskTitle: {
    flex: 1,
    fontSize: Typography.sizeSM,
    color: Colors.textPrimary,
    marginLeft: Spacing.xs,
  },
  editSubtaskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  editSubtaskRemove: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
  editSubtaskRemoveText: {
    fontSize: Typography.sizeLG,
    color: Colors.textTertiary,
    fontWeight: Typography.weightMedium,
  },
  // --- Permission Note ---
  permissionNote: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  permissionNoteText: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    textAlign: 'center',
    fontStyle: 'italic',
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
