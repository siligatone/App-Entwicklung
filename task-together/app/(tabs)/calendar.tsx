/**
 * Kalender-Tab — Agenda-Ansicht für Aufgaben mit Deadlines.
 *
 * Zeigt Aufgaben gruppiert nach Zeitabschnitt:
 * Überfällig, Heute, Morgen, Diese Woche, Später.
 * Nur Aufgaben der aktiven Gruppe. Keine externe Kalenderintegration.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { getCachedGroup, type CachedGroup } from '../../lib/storage';
import { subscribeToTasks, type Task } from '../../lib/task-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

type FilterMode = 'open' | 'all';

interface AgendaSection {
  key: string;
  title: string;
  color: string;
  tasks: Task[];
}

// --- Hilfsfunktionen ---

function toDate(timestamp: unknown): Date | null {
  if (timestamp == null) return null;
  if (typeof (timestamp as { toDate?: unknown }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (timestamp instanceof Date) return timestamp;
  return null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDeadlineDate(date: Date): string {
  return date.toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
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
  return `${minutes / 60}h`;
}

// --- Komponente ---

export default function CalendarScreen() {
  const router = useRouter();
  const [group, setGroup] = useState<CachedGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>('open');

  useEffect(() => {
    getCachedGroup().then(setGroup);
  }, []);

  useEffect(() => {
    if (!group) return;

    const unsubscribe = subscribeToTasks(
      (newTasks) => {
        setTasks(newTasks);
        setLoading(false);
        setError(null);
      },
      (errorMsg) => {
        setError(errorMsg);
        setLoading(false);
      },
      group.groupId,
    );
    return () => unsubscribe();
  }, [group]);

  const sections = useMemo((): AgendaSection[] => {
    const now = new Date();
    const today = startOfDay(now);
    const tomorrow = new Date(today.getTime() + 86400000);
    const endOfWeek = new Date(today.getTime() + 7 * 86400000);

    // Nur Tasks mit Deadline
    let deadlineTasks = tasks.filter((t) => toDate(t.deadline) !== null);

    // Filter: nur offene oder alle
    if (filter === 'open') {
      deadlineTasks = deadlineTasks.filter((t) => !t.done);
    }

    // Nach Deadline sortieren
    deadlineTasks.sort((a, b) => {
      const dateA = toDate(a.deadline)!.getTime();
      const dateB = toDate(b.deadline)!.getTime();
      return dateA - dateB;
    });

    const overdue: Task[] = [];
    const todayTasks: Task[] = [];
    const tomorrowTasks: Task[] = [];
    const thisWeek: Task[] = [];
    const later: Task[] = [];

    for (const task of deadlineTasks) {
      const deadline = startOfDay(toDate(task.deadline)!);

      if (deadline.getTime() < today.getTime() && !task.done) {
        overdue.push(task);
      } else if (deadline.getTime() === today.getTime()) {
        todayTasks.push(task);
      } else if (deadline.getTime() === tomorrow.getTime()) {
        tomorrowTasks.push(task);
      } else if (deadline.getTime() < endOfWeek.getTime()) {
        thisWeek.push(task);
      } else {
        later.push(task);
      }

      // Erledigte überfällige Tasks → "Heute" statt "Überfällig"
      if (deadline.getTime() < today.getTime() && task.done) {
        todayTasks.push(task);
      }
    }

    const result: AgendaSection[] = [];

    if (overdue.length > 0) {
      result.push({ key: 'overdue', title: 'Überfällig', color: Colors.danger, tasks: overdue });
    }
    if (todayTasks.length > 0) {
      result.push({ key: 'today', title: 'Heute', color: Colors.primary, tasks: todayTasks });
    }
    if (tomorrowTasks.length > 0) {
      result.push({ key: 'tomorrow', title: 'Morgen', color: Colors.warning, tasks: tomorrowTasks });
    }
    if (thisWeek.length > 0) {
      result.push({ key: 'week', title: 'Diese Woche', color: Colors.success, tasks: thisWeek });
    }
    if (later.length > 0) {
      result.push({ key: 'later', title: 'Später', color: Colors.textTertiary, tasks: later });
    }

    return result;
  }, [tasks, filter]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Kalender laden...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={styles.errorEmoji}>😕</Text>
        <Text style={styles.errorText}>Fehler: {error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>Kalender</Text>

      {/* Filter-Toggle */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'open' && styles.filterActive]}
          onPress={() => setFilter('open')}
        >
          <Text style={[styles.filterText, filter === 'open' && styles.filterTextActive]}>
            Offen
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            Alle
          </Text>
        </TouchableOpacity>
      </View>

      {/* Leerer Zustand */}
      {sections.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📅</Text>
          <Text style={styles.emptyTitle}>Keine Deadlines geplant</Text>
          <Text style={styles.emptySubtitle}>
            Lege bei einer Aufgabe eine Deadline fest, damit sie hier erscheint.
          </Text>
        </View>
      )}

      {/* Agenda-Abschnitte */}
      {sections.map((section) => (
        <View key={section.key} style={styles.section}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <View style={[styles.sectionDot, { backgroundColor: section.color }]} />
            <Text style={[styles.sectionTitle, { color: section.color }]}>
              {section.title}
            </Text>
            <Text style={styles.sectionCount}>{section.tasks.length}</Text>
          </View>

          {/* Tasks in Section */}
          {section.tasks.map((task) => {
            const deadlineDate = toDate(task.deadline);

            return (
              <TouchableOpacity
                key={task.id}
                style={[styles.taskCard, task.done && styles.taskCardDone]}
                onPress={() => router.push(`/task/${task.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.taskHeader}>
                  {/* Status-Kreis */}
                  {task.done ? (
                    <View style={styles.checkDone}>
                      <Text style={styles.checkMark}>✓</Text>
                    </View>
                  ) : (
                    <View style={styles.checkOpen} />
                  )}

                  <View style={styles.taskContent}>
                    <Text
                      style={[styles.taskTitle, task.done && styles.taskTitleDone]}
                      numberOfLines={2}
                    >
                      {task.title}
                    </Text>

                    {/* Deadline-Datum */}
                    {deadlineDate && (
                      <Text style={[
                        styles.taskDeadline,
                        section.key === 'overdue' && styles.taskDeadlineOverdue,
                      ]}>
                        {formatDeadlineDate(deadlineDate)}
                      </Text>
                    )}
                  </View>
                </View>

                {/* Badges */}
                <View style={styles.badgeRow}>
                  {task.priority && PRIORITY_CONFIG[task.priority] && (
                    <View style={[styles.badge, { backgroundColor: PRIORITY_CONFIG[task.priority].color + '18' }]}>
                      <Text style={[styles.badgeText, { color: PRIORITY_CONFIG[task.priority].color }]}>
                        {PRIORITY_CONFIG[task.priority].label}
                      </Text>
                    </View>
                  )}

                  {formatEffort(task.effortEstimate) && (
                    <View style={[styles.badge, { backgroundColor: Colors.textTertiary + '18' }]}>
                      <Text style={[styles.badgeText, { color: Colors.textSecondary }]}>
                        ⏱ {formatEffort(task.effortEstimate)}
                      </Text>
                    </View>
                  )}

                  {(task.subtasks ?? []).length > 0 && (
                    <View style={[styles.badge, { backgroundColor: Colors.primary + '15' }]}>
                      <Text style={[styles.badgeText, { color: Colors.primary }]}>
                        {(task.subtasks ?? []).filter((s) => s.done).length}/{(task.subtasks ?? []).length}
                      </Text>
                    </View>
                  )}

                  {task.assignedTo && (
                    <View style={[styles.badge, { backgroundColor: Colors.primaryLight + '20' }]}>
                      <Text style={[styles.badgeText, { color: Colors.primary }]}>
                        {task.assignedTo.displayName} {task.assignedTo.emoji}
                      </Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ))}
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
  loadingText: {
    marginTop: Spacing.md,
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
  },
  errorEmoji: {
    fontSize: 48,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.danger,
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  container: {
    padding: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  screenTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  // --- Filter ---
  filterRow: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  filterTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightSemiBold,
  },
  // --- Empty State ---
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
    lineHeight: 20,
  },
  // --- Sections ---
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
    flex: 1,
  },
  sectionCount: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textTertiary,
  },
  // --- Task Cards ---
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
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkOpen: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.separator,
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  checkDone: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  checkMark: {
    color: Colors.textOnPrimary,
    fontSize: 12,
    fontWeight: Typography.weightBold,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
    color: Colors.textPrimary,
    lineHeight: 22,
  },
  taskTitleDone: {
    textDecorationLine: 'line-through',
    color: Colors.textTertiary,
  },
  taskDeadline: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    marginTop: 2,
  },
  taskDeadlineOverdue: {
    color: Colors.danger,
    fontWeight: Typography.weightMedium,
  },
  // --- Badges ---
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingLeft: 30, // Einrückung unter Checkbox
  },
  badge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
  },
});
