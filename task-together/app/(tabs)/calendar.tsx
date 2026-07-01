// Kalender mit Monatsansicht und Deadline-Übersicht

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
import { getCachedProfile, getCachedGroup, type CachedProfile, type CachedGroup } from '../../lib/storage';
import { subscribeToTasks, type Task } from '../../lib/task-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';

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

const WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const MONTH_NAMES = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
  'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember',
];

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: 'Niedrig', color: Colors.success },
  medium: { label: 'Mittel', color: Colors.warning },
  high: { label: 'Hoch', color: Colors.danger },
};

// Tageszellen für Monatsgrid erzeugen
function getMonthGrid(year: number, month: number): (number | null)[] {
  const firstDay = new Date(year, month, 1);
  // Montag = 0, Sonntag = 6 (JS: Sonntag = 0, Montag = 1)
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  return cells;
}

// Tage mit Deadlines als Set zurückgeben
function getDeadlineDays(tasks: Task[]): Set<string> {
  const days = new Set<string>();
  for (const t of tasks) {
    const d = toDate(t.deadline);
    if (d) {
      days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }
  }
  return days;
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${month}-${day}`;
}

// --- Komponente ---

export default function CalendarScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [group, setGroup] = useState<CachedGroup | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [selectedDay, setSelectedDay] = useState(now.getDate());

  useEffect(() => {
    getCachedProfile().then(setProfile);
    getCachedGroup().then(setGroup);
  }, []);

  // Echtzeit-Listener: mit Gruppe → persönliche + Gruppen-Tasks. Ohne → nur persönliche.
  useEffect(() => {
    if (!profile) return;

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

  // Kalender-Daten
  const grid = useMemo(() => getMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const deadlineDays = useMemo(() => getDeadlineDays(tasks), [tasks]);

  const today = startOfDay(new Date());
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDay = today.getDate();

  // Aufgaben für den ausgewählten Tag
  const selectedDate = useMemo(() => new Date(viewYear, viewMonth, selectedDay), [viewYear, viewMonth, selectedDay]);
  const selectedDayStart = startOfDay(selectedDate).getTime();

  const tasksForSelectedDay = useMemo(() => {
    return tasks.filter((t) => {
      const d = toDate(t.deadline);
      if (!d) return false;
      return startOfDay(d).getTime() === selectedDayStart;
    }).sort((a, b) => {
      // Offene zuerst, dann nach Titel
      if (a.done !== b.done) return a.done ? 1 : -1;
      return a.title.localeCompare(b.title);
    });
  }, [tasks, selectedDayStart]);

  // Überfällige offene Aufgaben
  const overdueTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (t.done) return false;
      const d = toDate(t.deadline);
      if (!d) return false;
      return startOfDay(d).getTime() < today.getTime();
    }).sort((a, b) => {
      const da = toDate(a.deadline)!.getTime();
      const db = toDate(b.deadline)!.getTime();
      return da - db;
    });
  }, [tasks, today]);

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(viewYear - 1);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDay(1);
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(viewYear + 1);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDay(1);
  }

  function goToToday() {
    setViewYear(todayYear);
    setViewMonth(todayMonth);
    setSelectedDay(todayDay);
  }

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

  const isCurrentMonth = viewYear === todayYear && viewMonth === todayMonth;

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
      {/* Monatsnavigation */}
      <View style={styles.navRow}>
        <TouchableOpacity style={styles.navButton} onPress={goToPrevMonth}>
          <Text style={styles.navButtonText}>‹</Text>
        </TouchableOpacity>

        <Text style={styles.monthTitle}>
          {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>

        <TouchableOpacity style={styles.navButton} onPress={goToNextMonth}>
          <Text style={styles.navButtonText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* Heute-Button */}
      {!isCurrentMonth && (
        <TouchableOpacity style={styles.todayButton} onPress={goToToday}>
          <Text style={styles.todayButtonText}>Heute</Text>
        </TouchableOpacity>
      )}

      {/* Wochentags-Header */}
      <View style={styles.weekdayRow}>
        {WEEKDAY_LABELS.map((label) => (
          <View key={label} style={styles.weekdayCell}>
            <Text style={styles.weekdayText}>{label}</Text>
          </View>
        ))}
      </View>

      {/* Monatsgrid */}
      <View style={styles.gridContainer}>
        {grid.map((day, index) => {
          if (day === null) {
            return <View key={`empty-${index}`} style={styles.dayCell} />;
          }

          const isToday = viewYear === todayYear && viewMonth === todayMonth && day === todayDay;
          const isSelected = day === selectedDay;
          const hasDeadline = deadlineDays.has(dayKey(viewYear, viewMonth, day));

          return (
            <TouchableOpacity
              key={`day-${day}`}
              style={[
                styles.dayCell,
                isToday && !isSelected && styles.dayCellToday,
                isSelected && !isToday && styles.dayCellSelected,
                isSelected && isToday && styles.dayCellTodaySelected,
              ]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.6}
            >
              <Text style={[
                styles.dayText,
                isToday && !isSelected && styles.dayTextToday,
                isSelected && styles.dayTextSelected,
              ]}>
                {day}
              </Text>
              {hasDeadline && (
                <View style={[
                  styles.deadlineDot,
                  isSelected && styles.deadlineDotSelected,
                ]} />
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Aufgaben für ausgewählten Tag */}
      <View style={styles.dayDetailSection}>
        <Text style={styles.dayDetailTitle}>
          {selectedDay}. {MONTH_NAMES[viewMonth]} {viewYear}
        </Text>

        {tasksForSelectedDay.length === 0 ? (
          <Text style={styles.noTasksText}>Keine Aufgaben an diesem Tag</Text>
        ) : (
          tasksForSelectedDay.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={[styles.taskCard, task.done && styles.taskCardDone]}
              onPress={() => router.push(`/task/${task.id}`)}
              activeOpacity={0.7}
            >
              <View style={styles.taskRow}>
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
                  {/* Badges */}
                  <View style={styles.badgeRow}>
                    {/* Scope-Badge */}
                    <View style={[styles.badge, {
                      backgroundColor: task.groupId ? Colors.primary + '15' : Colors.warning + '18',
                    }]}>
                      <Text style={[styles.badgeText, {
                        color: task.groupId ? Colors.primary : Colors.warning,
                      }]}>
                        {task.groupId && group ? group.name : 'Persönlich'}
                      </Text>
                    </View>
                    {task.priority && PRIORITY_CONFIG[task.priority] && (
                      <View style={[styles.badge, { backgroundColor: PRIORITY_CONFIG[task.priority].color + '18' }]}>
                        <Text style={[styles.badgeText, { color: PRIORITY_CONFIG[task.priority].color }]}>
                          {PRIORITY_CONFIG[task.priority].label}
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
                </View>
              </View>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Überfällige Aufgaben */}
      {overdueTasks.length > 0 && (
        <View style={styles.overdueSection}>
          <View style={styles.overdueHeader}>
            <View style={styles.overdueDot} />
            <Text style={styles.overdueTitle}>Überfällig</Text>
            <Text style={styles.overdueCount}>{overdueTasks.length}</Text>
          </View>
          {overdueTasks.map((task) => {
            const deadlineDate = toDate(task.deadline);
            return (
              <TouchableOpacity
                key={task.id}
                style={styles.taskCard}
                onPress={() => router.push(`/task/${task.id}`)}
                activeOpacity={0.7}
              >
                <View style={styles.taskRow}>
                  <View style={styles.checkOpen} />
                  <View style={styles.taskContent}>
                    <Text style={styles.taskTitle} numberOfLines={2}>
                      {task.title}
                    </Text>
                    <View style={styles.badgeRow}>
                      <View style={[styles.badge, {
                        backgroundColor: task.groupId ? Colors.primary + '15' : Colors.warning + '18',
                      }]}>
                        <Text style={[styles.badgeText, {
                          color: task.groupId ? Colors.primary : Colors.warning,
                        }]}>
                          {task.groupId && group ? group.name : 'Persönlich'}
                        </Text>
                      </View>
                    </View>
                    {deadlineDate && (
                      <Text style={styles.overdueDate}>
                        Fällig: {deadlineDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                      </Text>
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
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
  // --- Monatsnavigation ---
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  navButton: {
    width: MIN_TOUCH_TARGET,
    height: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.backgroundCard,
    ...Shadows.sm,
  },
  navButtonText: {
    fontSize: 24,
    color: Colors.primary,
    fontWeight: Typography.weightSemiBold,
  },
  monthTitle: {
    fontSize: Typography.sizeXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
  },
  todayButton: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary + '15',
    marginBottom: Spacing.sm,
  },
  todayButtonText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.primary,
  },
  // --- Wochentags-Header ---
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: Spacing.xs,
  },
  weekdayCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.xs,
  },
  weekdayText: {
    fontSize: Typography.sizeXS,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textTertiary,
  },
  // --- Monatsgrid ---
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xs,
    marginBottom: Spacing.lg,
    ...Shadows.sm,
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  dayCellToday: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success + '18',
    borderWidth: 2,
    borderColor: Colors.success,
  },
  dayCellSelected: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  dayCellTodaySelected: {
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.success,
  },
  dayText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textPrimary,
  },
  dayTextToday: {
    color: Colors.success,
    fontWeight: Typography.weightBold,
  },
  dayTextSelected: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightBold,
  },
  deadlineDot: {
    position: 'absolute',
    bottom: 4,
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: Colors.primary,
  },
  deadlineDotSelected: {
    backgroundColor: Colors.textOnPrimary,
  },
  // --- Tages-Detail ---
  dayDetailSection: {
    marginBottom: Spacing.lg,
  },
  dayDetailTitle: {
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  noTasksText: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    fontStyle: 'italic',
    paddingVertical: Spacing.md,
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
  taskRow: {
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
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
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
  // --- Überfällig ---
  overdueSection: {
    marginBottom: Spacing.lg,
  },
  overdueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  overdueDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.danger,
    marginRight: Spacing.sm,
  },
  overdueTitle: {
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightSemiBold,
    color: Colors.danger,
    flex: 1,
  },
  overdueCount: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textTertiary,
  },
  overdueDate: {
    fontSize: Typography.sizeXS,
    color: Colors.danger,
    fontWeight: Typography.weightMedium,
    marginTop: 2,
  },
});
