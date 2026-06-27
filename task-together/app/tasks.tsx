/**
 * Aufgabenliste — Echtzeit-Sync aus Firestore.
 * Zeigt alle Tasks, neueste zuerst. Offene Tasks können abgehakt werden.
 */

import { useEffect, useState } from 'react';
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
import { getCachedProfile, type CachedProfile } from '../lib/storage';
import { subscribeToTasks, completeTask, type Task } from '../lib/task-service';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../constants/design';

export default function TasksScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());

  // Profil laden
  useEffect(() => {
    getCachedProfile().then(setProfile);
  }, []);

  // Echtzeit-Listener für Tasks
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

  async function handleComplete(taskId: string) {
    if (!profile || completingIds.has(taskId)) return;

    setCompletingIds((prev) => new Set(prev).add(taskId));

    try {
      await completeTask(taskId, {
        userId: profile.userId,
        displayName: profile.displayName,
        emoji: profile.emoji,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      if (Platform.OS === 'web') {
        alert(`Fehler: ${message}`);
      } else {
        Alert.alert('Fehler', `Aufgabe konnte nicht abgehakt werden: ${message}`);
      }
    } finally {
      setCompletingIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
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
      {!loading && !error && tasks.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyTitle}>Noch keine Aufgaben</Text>
          <Text style={styles.emptySubtitle}>
            Tippe auf + um die erste Aufgabe zu erstellen.
          </Text>
        </View>
      )}

      {/* Task-Liste */}
      {!loading && tasks.map((task) => {
        const isCompleting = completingIds.has(task.id);

        return (
          <View
            key={task.id}
            style={[styles.taskCard, task.done && styles.taskCardDone]}
          >
            <View style={styles.taskRow}>
              {/* Check-Button */}
              {!task.done ? (
                <TouchableOpacity
                  style={styles.checkButton}
                  onPress={() => handleComplete(task.id)}
                  disabled={isCompleting}
                  accessibilityLabel={`Aufgabe "${task.title}" abhaken`}
                >
                  {isCompleting ? (
                    <ActivityIndicator size="small" color={Colors.primary} />
                  ) : (
                    <View style={styles.checkCircle} />
                  )}
                </TouchableOpacity>
              ) : (
                <View style={styles.checkButton}>
                  <View style={styles.checkCircleDone}>
                    <Text style={styles.checkMark}>✓</Text>
                  </View>
                </View>
              )}

              {/* Task-Inhalt */}
              <View style={styles.taskContent}>
                <Text
                  style={[styles.taskTitle, task.done && styles.taskTitleDone]}
                  numberOfLines={2}
                >
                  {task.title}
                </Text>

                {task.description !== '' && (
                  <Text
                    style={[styles.taskDescription, task.done && styles.taskDescriptionDone]}
                    numberOfLines={3}
                  >
                    {task.description}
                  </Text>
                )}
              </View>
            </View>

            {/* Footer */}
            <View style={styles.taskFooter}>
              <Text style={styles.taskCreator}>
                {task.createdBy.emoji} {task.createdBy.displayName}
              </Text>
              {task.done && task.completedBy && (
                <Text style={styles.taskCompletedBy}>
                  Erledigt von {task.completedBy.emoji} {task.completedBy.displayName}
                </Text>
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
  taskCreator: {
    fontSize: Typography.sizeXS,
    color: Colors.textTertiary,
  },
  taskCompletedBy: {
    fontSize: Typography.sizeXS,
    color: Colors.success,
    fontWeight: Typography.weightMedium,
  },
});
