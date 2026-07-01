// Aufgabenliste mit Filter und Echtzeit-Sync

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedProfile, getCachedGroup, type CachedProfile, type CachedGroup } from '../../lib/storage';
import { subscribeToTasks, completeTask, reopenTask, deleteTask, type Task, type Priority } from '../../lib/task-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

// Firestore Timestamp → Date
function toDate(timestamp: unknown): Date | null {
  if (timestamp == null) return null;
  if (typeof (timestamp as { toDate?: unknown }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (timestamp instanceof Date) return timestamp;
  return null;
}

// Zeitstempel auf Deutsch formatieren
function formatTimestamp(timestamp: unknown): string {
  const date = toDate(timestamp);
  if (!date) return '';

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

// offene zuerst, dann erledigte
function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;

    const dateA = toDate(a.createdAt)?.getTime() ?? 0;
    const dateB = toDate(b.createdAt)?.getTime() ?? 0;
    return dateB - dateA;
  });
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

function formatDeadline(timestamp: unknown): { text: string; overdue: boolean } | null {
  const date = toDate(timestamp);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((deadlineDay.getTime() - today.getTime()) / 86400000);

  if (diffDays < 0) return { text: 'Überfällig', overdue: true };
  if (diffDays === 0) return { text: 'Heute fällig', overdue: false };
  if (diffDays === 1) return { text: 'Morgen fällig', overdue: false };
  const formatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  return { text: `Fällig ${formatted}`, overdue: false };
}

export default function TasksScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [group, setGroup] = useState<CachedGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<'all' | 'personal' | 'group'>('all');

  const sortedTasks = useMemo(() => sortTasks(tasks), [tasks]);

  const filteredTasks = useMemo(() => {
    if (filter === 'personal') return sortedTasks.filter((t) => !t.groupId);
    if (filter === 'group') return sortedTasks.filter((t) => !!t.groupId);
    return sortedTasks;
  }, [sortedTasks, filter]);

  // Profil und Gruppe laden
  useEffect(() => {
    getCachedProfile().then(setProfile);
    getCachedGroup().then(setGroup);
  }, []);

  // Echtzeit-Listener für Tasks
  // Mit Gruppe: persönliche + Gruppen-Tasks. Ohne Gruppe: nur persönliche.
  useEffect(() => {
    if (!profile) return;

    // Alle Tasks laden, client-seitig filtern (vermeidet zwei Subscriptions)
    const unsubscribe = subscribeToTasks(
      (newTasks) => {
        const filtered = group
          ? newTasks.filter((t) =>
              (t.groupId === group.groupId) ||
              (!t.groupId && t.createdBy.userId === profile.userId),
            )
          : newTasks.filter((t) => !t.groupId && t.createdBy.userId === profile.userId);
        setTasks(filtered);
        setLoading(false);
        setError(null);
      },
      (errorMsg) => {
        setError(errorMsg);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [group, profile]);

  // darf dieser User die Aufgabe abhaken?
  function canToggle(task: Task): boolean {
    if (!profile) return false;
    if (!task.assignedTo) return true; // Keine Zuweisung → alle dürfen
    return task.assignedTo.userId === profile.userId;
  }

  // darf dieser User die Aufgabe löschen?
  function canDelete(task: Task): boolean {
    if (!profile) return false;
    return task.createdBy.userId === profile.userId;
  }

  async function handleToggle(task: Task) {
    if (!profile || togglingIds.has(task.id) || !canToggle(task)) return;

    setTogglingIds((prev) => new Set(prev).add(task.id));

    try {
      if (task.done) {
        await reopenTask(task.id);
      } else {
        await completeTask(task.id, {
          userId: profile.userId,
          displayName: profile.displayName,
          emoji: profile.emoji,
        });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      const action = task.done ? 'wieder geöffnet' : 'abgehakt';
      if (Platform.OS === 'web') {
        alert(`Aufgabe konnte nicht ${action} werden: ${message}`);
      } else {
        Alert.alert('Fehler', `Aufgabe konnte nicht ${action} werden: ${message}`);
      }
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }

  function handleDelete(task: Task) {
    const doDelete = async () => {
      setDeletingIds((prev) => new Set(prev).add(task.id));
      try {
        await deleteTask(task.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
        if (Platform.OS === 'web') {
          alert(`Aufgabe konnte nicht gelöscht werden: ${message}`);
        } else {
          Alert.alert('Fehler', `Aufgabe konnte nicht gelöscht werden: ${message}`);
        }
        setDeletingIds((prev) => {
          const next = new Set(prev);
          next.delete(task.id);
          return next;
        });
      }
    };

    if (Platform.OS === 'web') {
      if (confirm(`"${task.title}" löschen? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
        doDelete();
      }
    } else {
      Alert.alert(
        'Aufgabe löschen?',
        'Diese Aktion kann nicht rückgängig gemacht werden.',
        [
          { text: 'Abbrechen', style: 'cancel' },
          { text: 'Löschen', style: 'destructive', onPress: doDelete },
        ],
      );
    }
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
    >
      {/* Header */}
      <Text style={styles.headerTitle}>Aufgaben</Text>

      {/* Filter-Tabs — nur mit Gruppe */}
      {group && (
        <View style={styles.filterRow}>
          {([
            { key: 'all' as const, label: 'Alle' },
            { key: 'personal' as const, label: 'Persönlich' },
            { key: 'group' as const, label: group.name },
          ]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.filterTab, filter === tab.key && styles.filterTabActive]}
              onPress={() => setFilter(tab.key)}
            >
              <Text style={[styles.filterTabText, filter === tab.key && styles.filterTabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Ladezustand */}
      {loading && (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Aufgaben laden…</Text>
        </View>
      )}

      {/* Fehler */}
      {error && !loading && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>Fehler: {error}</Text>
        </View>
      )}

      {/* Leerer Zustand */}
      {!loading && !error && filteredTasks.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>
            {sortedTasks.length === 0 ? 'Noch keine Aufgaben' : 'Keine Aufgaben in diesem Bereich'}
          </Text>
          <Text style={styles.emptySubtitle}>
            {sortedTasks.length === 0
              ? 'Tippe auf + um die erste Aufgabe zu erstellen.'
              : 'Wechsle den Filter oder erstelle eine neue Aufgabe.'}
          </Text>
        </View>
      )}

      {/* Task-Liste */}
      {!loading && filteredTasks.map((task) => {
        const isToggling = togglingIds.has(task.id);

        return (
          <View
            key={task.id}
            style={[styles.taskCard, task.done && styles.taskCardDone]}
          >
            <View style={styles.taskRow}>
              {/* Check-Button — nur erlaubt wenn canToggle */}
              <TouchableOpacity
                style={styles.checkButton}
                onPress={() => handleToggle(task)}
                disabled={isToggling || !canToggle(task)}
                accessibilityLabel={
                  task.done
                    ? `Aufgabe "${task.title}" wieder öffnen`
                    : `Aufgabe "${task.title}" abhaken`
                }
              >
                {isToggling ? (
                  <ActivityIndicator size="small" color={task.done ? Colors.success : Colors.primary} />
                ) : task.done ? (
                  <View style={styles.checkCircleDone}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                ) : (
                  <View style={styles.checkCircle} />
                )}
              </TouchableOpacity>

              {/* Task-Inhalt — antippbar für Details */}
              <TouchableOpacity
                style={styles.taskContent}
                onPress={() => router.push(`/task/${task.id}`)}
                accessibilityLabel={`Details zu "${task.title}"`}
                activeOpacity={0.7}
              >
                <Text
                  style={[styles.taskTitle, task.done && styles.taskTitleDone]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>

                {task.description !== '' && (
                  <>
                    <Text
                      style={[styles.taskDescription, task.done && styles.taskDescriptionDone]}
                      numberOfLines={2}
                    >
                      {task.description}
                    </Text>
                    <Text style={styles.detailsHint}>Details ansehen</Text>
                  </>
                )}

                {/* Scope-Badge — nur in "Alle"-Ansicht */}
                {filter === 'all' && group && (
                  <View style={[
                    styles.scopeBadge,
                    task.groupId ? styles.scopeBadgeGroup : styles.scopeBadgePersonal,
                  ]}>
                    <Text style={[
                      styles.scopeBadgeText,
                      task.groupId ? styles.scopeBadgeTextGroup : styles.scopeBadgeTextPersonal,
                    ]}>
                      {task.groupId ? group.name : 'Persönlich'}
                    </Text>
                  </View>
                )}

                {task.assignedTo && (
                  <View style={styles.assignedBadge}>
                    <Text style={styles.assignedText}>
                      Für {task.assignedTo.displayName} {task.assignedTo.emoji}
                    </Text>
                  </View>
                )}

                {task.assignedTo && !canToggle(task) && (
                  <Text style={styles.permissionHint}>
                    Nur {task.assignedTo.displayName} kann diese Aufgabe abschließen.
                  </Text>
                )}

                {/* Metadata badges */}
                {!!(task.priority || (task.labels && task.labels.length > 0) || task.effortEstimate || task.deadline) && (
                  <View style={styles.metaRow}>
                    {task.priority && PRIORITY_CONFIG[task.priority] && (
                      <View style={[styles.metaBadge, { backgroundColor: PRIORITY_CONFIG[task.priority].color + '18' }]}>
                        <Text style={[styles.metaBadgeText, { color: PRIORITY_CONFIG[task.priority].color }]}>
                          {PRIORITY_CONFIG[task.priority].label}
                        </Text>
                      </View>
                    )}
                    {task.labels?.map((lbl) => (
                      <View key={lbl} style={[styles.metaBadge, { backgroundColor: Colors.primary + '15' }]}>
                        <Text style={[styles.metaBadgeText, { color: Colors.primary }]}>{lbl}</Text>
                      </View>
                    ))}
                    {formatEffort(task.effortEstimate) && (
                      <View style={[styles.metaBadge, { backgroundColor: Colors.textTertiary + '18' }]}>
                        <Text style={[styles.metaBadgeText, { color: Colors.textSecondary }]}>
                          ⏱ {formatEffort(task.effortEstimate)}
                        </Text>
                      </View>
                    )}
                    {formatDeadline(task.deadline) && (
                      <View style={[styles.metaBadge, {
                        backgroundColor: (formatDeadline(task.deadline)!.overdue && !task.done)
                          ? Colors.danger + '18' : Colors.warning + '18',
                      }]}>
                        <Text style={[styles.metaBadgeText, {
                          color: (formatDeadline(task.deadline)!.overdue && !task.done)
                            ? Colors.danger : Colors.warning,
                        }]}>
                          {formatDeadline(task.deadline)!.text}
                        </Text>
                      </View>
                    )}
                  </View>
                )}

                {/* Subtask-Fortschritt */}
                {(task.subtasks ?? []).length > 0 && (
                  <View style={styles.subtaskProgress}>
                    <Text style={styles.subtaskProgressText}>
                      {(task.subtasks ?? []).filter((s) => s.done).length}/{(task.subtasks ?? []).length} Unterpunkte
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* Footer */}
            <View style={styles.taskFooter}>
              <View style={styles.taskFooterLeft}>
                <Text style={styles.taskCreator}>
                  Erstellt von {task.createdBy.displayName} {task.createdBy.emoji}
                </Text>
                {formatTimestamp(task.createdAt) !== '' && (
                  <Text style={styles.taskTimestamp}>
                    {formatTimestamp(task.createdAt)}
                  </Text>
                )}
                {task.done && task.completedBy && (
                  <Text style={styles.taskCompletedBy}>
                    Erledigt von {task.completedBy.displayName} {task.completedBy.emoji}
                  </Text>
                )}
              </View>
              {canDelete(task) && (
                <TouchableOpacity
                  style={styles.deleteButton}
                  onPress={() => handleDelete(task)}
                  disabled={deletingIds.has(task.id)}
                  accessibilityLabel={`Aufgabe "${task.title}" löschen`}
                >
                  {deletingIds.has(task.id) ? (
                    <ActivityIndicator size="small" color={Colors.danger} />
                  ) : (
                    <Text style={styles.deleteButtonText}>Löschen</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
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
  // --- Header ---
  headerTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
  },
  // --- Filter ---
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  filterTab: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  filterTabActive: {
    backgroundColor: Colors.primary,
  },
  filterTabText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  filterTabTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightSemiBold,
  },
  // --- Zustände ---
  centerBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  loadingText: {
    marginTop: Spacing.md,
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
  emptyBox: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    textAlign: 'center',
  },
  // --- Task-Karten ---
  taskCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  taskCardDone: {
    opacity: 0.6,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // --- Check-Button ---
  checkButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  checkCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Colors.separator,
  },
  checkCircleDone: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkMark: {
    color: Colors.textOnPrimary,
    fontSize: 14,
    fontWeight: Typography.weightBold,
  },
  // --- Task-Inhalt ---
  taskContent: {
    flex: 1,
    paddingTop: Spacing.sm,
  },
  taskTitle: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  taskDescription: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    lineHeight: 20,
    marginTop: Spacing.xs,
  },
  taskDescriptionDone: {
    textDecorationLine: 'line-through',
  },
  detailsHint: {
    fontSize: Typography.sizeXS,
    color: Colors.primary,
    fontWeight: Typography.weightMedium,
    marginTop: 2,
  },
  scopeBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  scopeBadgePersonal: {
    backgroundColor: Colors.warning + '18',
  },
  scopeBadgeGroup: {
    backgroundColor: Colors.primary + '15',
  },
  scopeBadgeText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
  },
  scopeBadgeTextPersonal: {
    color: Colors.warning,
  },
  scopeBadgeTextGroup: {
    color: Colors.primary,
  },
  assignedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primaryLight + '20',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
  assignedText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
    color: Colors.primary,
  },
  permissionHint: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    marginTop: Spacing.xs,
  },
  // --- Metadata ---
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  metaBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  metaBadgeText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
  },
  // --- Subtask Progress ---
  subtaskProgress: {
    marginTop: Spacing.xs,
  },
  subtaskProgressText: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    fontWeight: Typography.weightMedium,
  },
  // --- Footer ---
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.separatorOpaque,
  },
  taskFooterLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  taskCreator: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
  },
  taskTimestamp: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  taskCompletedBy: {
    fontSize: Typography.sizeXS,
    color: Colors.success,
    fontWeight: Typography.weightMedium,
    marginTop: 2,
  },
  deleteButton: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    minHeight: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: Typography.sizeXS,
    color: Colors.danger,
    fontWeight: Typography.weightMedium,
  },
});
