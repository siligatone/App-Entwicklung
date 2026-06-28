/**
 * Dashboard — Kompakte Statistiken und Übersicht aller Aufgaben.
 * Echtzeit-Sync via bestehender Task-Subscription.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { subscribeToTasks, type Task } from '../../lib/task-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

/** Firestore Timestamp zu Date */
function toDate(timestamp: unknown): Date | null {
  if (timestamp == null) return null;
  if (typeof (timestamp as { toDate?: unknown }).toDate === 'function') {
    return (timestamp as { toDate: () => Date }).toDate();
  }
  if (timestamp instanceof Date) return timestamp;
  return null;
}

/** Deadline-Info mit Überfällig-Status */
function getDeadlineInfo(timestamp: unknown): { date: Date; text: string; overdue: boolean } | null {
  const date = toDate(timestamp);
  if (!date) return null;
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const deadlineDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((deadlineDay.getTime() - today.getTime()) / 86400000);

  const formatted = date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  if (diffDays < 0) return { date, text: `${formatted} (Überfällig)`, overdue: true };
  if (diffDays === 0) return { date, text: `${formatted} (Heute)`, overdue: false };
  if (diffDays === 1) return { date, text: `${formatted} (Morgen)`, overdue: false };
  return { date, text: formatted, overdue: false };
}

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  high: { label: 'Hoch', color: Colors.danger },
  medium: { label: 'Mittel', color: Colors.warning },
  low: { label: 'Niedrig', color: Colors.success },
};

export default function DashboardScreen() {
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
    );
    return () => unsubscribe();
  }, []);

  const stats = useMemo(() => {
    const total = tasks.length;
    const open = tasks.filter((t) => !t.done);
    const done = tasks.filter((t) => t.done);
    const progress = total > 0 ? Math.round((done.length / total) * 100) : 0;

    // Offene nach Priorität
    const priorityCounts = {
      high: open.filter((t) => t.priority === 'high').length,
      medium: open.filter((t) => t.priority === 'medium').length,
      low: open.filter((t) => t.priority === 'low').length,
      none: open.filter((t) => !t.priority).length,
    };

    // Nächste Deadlines (offene Tasks mit Deadline, sortiert)
    const upcomingDeadlines = open
      .map((t) => ({ task: t, info: getDeadlineInfo(t.deadline) }))
      .filter((item): item is { task: Task; info: NonNullable<ReturnType<typeof getDeadlineInfo>> } =>
        item.info !== null,
      )
      .sort((a, b) => a.info.date.getTime() - b.info.date.getTime())
      .slice(0, 5);

    // Aufgaben nach Person
    const personMap = new Map<string, { name: string; count: number }>();
    let unassignedCount = 0;
    for (const t of open) {
      if (t.assignedTo) {
        const key = t.assignedTo.userId;
        const existing = personMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          personMap.set(key, {
            name: `${t.assignedTo.displayName} ${t.assignedTo.emoji}`,
            count: 1,
          });
        }
      } else {
        unassignedCount++;
      }
    }
    const personStats = [...personMap.values()].sort((a, b) => b.count - a.count);

    // Labels-Zusammenfassung (offene Tasks)
    const labelMap = new Map<string, number>();
    for (const t of open) {
      if (t.labels) {
        for (const lbl of t.labels) {
          labelMap.set(lbl, (labelMap.get(lbl) ?? 0) + 1);
        }
      }
    }
    const labelStats = [...labelMap.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

    return {
      total,
      openCount: open.length,
      doneCount: done.length,
      progress,
      priorityCounts,
      upcomingDeadlines,
      personStats,
      unassignedCount,
      labelStats,
    };
  }, [tasks]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Dashboard laden...</Text>
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

  if (tasks.length === 0) {
    return (
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <Text style={styles.screenTitle}>Übersicht</Text>
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📊</Text>
          <Text style={styles.emptyTitle}>Noch keine Daten</Text>
          <Text style={styles.emptySubtitle}>
            Erstelle Aufgaben, um hier Statistiken zu sehen.
          </Text>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      <Text style={styles.screenTitle}>Übersicht</Text>

      {/* Hauptzahlen */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{stats.total}</Text>
          <Text style={styles.statLabel}>Gesamt</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.primary }]}>{stats.openCount}</Text>
          <Text style={styles.statLabel}>Offen</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: Colors.success }]}>{stats.doneCount}</Text>
          <Text style={styles.statLabel}>Erledigt</Text>
        </View>
      </View>

      {/* Fortschrittsbalken */}
      <View style={styles.card}>
        <View style={styles.progressHeader}>
          <Text style={styles.cardTitle}>Fortschritt</Text>
          <Text style={styles.progressPercent}>{stats.progress}%</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${stats.progress}%` }]} />
        </View>
      </View>

      {/* Offene nach Priorität */}
      {stats.openCount > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Offene nach Priorität</Text>
          {(['high', 'medium', 'low'] as const).map((key) => {
            const count = stats.priorityCounts[key];
            if (count === 0) return null;
            const config = PRIORITY_CONFIG[key];
            return (
              <View key={key} style={styles.listRow}>
                <View style={[styles.priorityDot, { backgroundColor: config.color }]} />
                <Text style={styles.listLabel}>{config.label}</Text>
                <Text style={styles.listCount}>{count}</Text>
              </View>
            );
          })}
          {stats.priorityCounts.none > 0 && (
            <View style={styles.listRow}>
              <View style={[styles.priorityDot, { backgroundColor: Colors.textTertiary }]} />
              <Text style={styles.listLabel}>Ohne Priorität</Text>
              <Text style={styles.listCount}>{stats.priorityCounts.none}</Text>
            </View>
          )}
        </View>
      )}

      {/* Nächste Deadlines */}
      {stats.upcomingDeadlines.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Nächste Deadlines</Text>
          {stats.upcomingDeadlines.map(({ task, info }) => (
            <TouchableOpacity
              key={task.id}
              style={styles.deadlineRow}
              onPress={() => router.push(`/task/${task.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.deadlineContent}>
                <Text style={styles.deadlineTitle} numberOfLines={1}>{task.title}</Text>
                <Text style={[
                  styles.deadlineDate,
                  info.overdue && styles.deadlineDateOverdue,
                ]}>
                  {info.text}
                </Text>
              </View>
              <Text style={styles.deadlineChevron}>›</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Aufgaben nach Person */}
      {(stats.personStats.length > 0 || stats.unassignedCount > 0) && stats.openCount > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Offene nach Person</Text>
          {stats.personStats.map((person) => (
            <View key={person.name} style={styles.listRow}>
              <Text style={styles.listLabel}>{person.name}</Text>
              <Text style={styles.listCount}>{person.count}</Text>
            </View>
          ))}
          {stats.unassignedCount > 0 && (
            <View style={styles.listRow}>
              <Text style={[styles.listLabel, { color: Colors.textTertiary }]}>Nicht zugewiesen</Text>
              <Text style={styles.listCount}>{stats.unassignedCount}</Text>
            </View>
          )}
        </View>
      )}

      {/* Labels */}
      {stats.labelStats.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Labels (offen)</Text>
          <View style={styles.labelChips}>
            {stats.labelStats.map(({ label, count }) => (
              <View key={label} style={styles.labelChip}>
                <Text style={styles.labelChipText}>{label} ({count})</Text>
              </View>
            ))}
          </View>
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
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
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
  },
  // --- Stat Cards Row ---
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    alignItems: 'center',
    ...Shadows.sm,
  },
  statNumber: {
    fontSize: Typography.sizeXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
  },
  statLabel: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
    fontWeight: Typography.weightMedium,
  },
  // --- Cards ---
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  cardTitle: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  // --- Progress ---
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  progressPercent: {
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightBold,
    color: Colors.primary,
  },
  progressBarBg: {
    height: 8,
    backgroundColor: Colors.separatorOpaque,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: 8,
    backgroundColor: Colors.success,
    borderRadius: 4,
  },
  // --- List Rows ---
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separatorOpaque,
  },
  priorityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },
  listLabel: {
    flex: 1,
    fontSize: Typography.sizeSM,
    color: Colors.textPrimary,
  },
  listCount: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textSecondary,
    minWidth: 24,
    textAlign: 'right',
  },
  // --- Deadlines ---
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separatorOpaque,
    minHeight: MIN_TOUCH_TARGET,
  },
  deadlineContent: {
    flex: 1,
  },
  deadlineTitle: {
    fontSize: Typography.sizeSM,
    color: Colors.textPrimary,
    fontWeight: Typography.weightMedium,
    marginBottom: 2,
  },
  deadlineDate: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
  },
  deadlineDateOverdue: {
    color: Colors.danger,
    fontWeight: Typography.weightSemiBold,
  },
  deadlineChevron: {
    fontSize: Typography.sizeLG,
    color: Colors.textTertiary,
    marginLeft: Spacing.sm,
  },
  // --- Labels ---
  labelChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  labelChip: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  labelChipText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightMedium,
    color: Colors.primary,
  },
});
