// Neue Aufgabe erstellen

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getCachedProfile, getCachedGroup, type CachedProfile, type CachedGroup } from '../../lib/storage';
import { createTask, generateId, type UserSnapshot, type Priority, type Subtask } from '../../lib/task-service';
import { subscribeToUsers, subscribeToUserProfile, addUserLabel, type UserProfile } from '../../lib/user-service';
import { subscribeToGroup, addGroupLabel, type Group } from '../../lib/group-service';
import { suggestSubtasksAI } from '../../lib/task-assistant';
import { Colors, Spacing, Typography, BorderRadius, Shadows, MIN_TOUCH_TARGET } from '../../constants/design';
import DatePicker from '../../components/DatePicker';

export default function CreateScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CachedProfile | null>(null);
  const [group, setGroup] = useState<CachedGroup | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [assignedTo, setAssignedTo] = useState<UserSnapshot | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [labels, setLabels] = useState<Set<string>>(new Set());
  const [effortEstimate, setEffortEstimate] = useState<number | null>(null);
  const [deadline, setDeadline] = useState<Date | null>(null);
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [addedSuggestions, setAddedSuggestions] = useState<Set<string>>(new Set());
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestSource, setSuggestSource] = useState<'ai' | 'local' | null>(null);
  const [taskScope, setTaskScope] = useState<'personal' | 'group'>('personal');
  const [newLabelText, setNewLabelText] = useState('');
  const [groupDetail, setGroupDetail] = useState<Group | null>(null);
  const [userDetail, setUserDetail] = useState<UserProfile | null>(null);

  useEffect(() => {
    getCachedProfile().then(setProfile);
    getCachedGroup().then((g) => {
      setGroup(g);
      if (g) setTaskScope('group'); // Standard: Gruppen-Task wenn Gruppe vorhanden
    });
  }, []);

  // Echtzeit-Listener für Gruppenmitglieder + Gruppendetails (Labels)
  useEffect(() => {
    if (!group) return;
    const unsub1 = subscribeToUsers(
      (users) => setAllUsers(users),
      () => {},
      group.groupId,
    );
    const unsub2 = subscribeToGroup(
      group.groupId,
      (g) => setGroupDetail(g),
      () => {},
    );
    return () => { unsub1(); unsub2(); };
  }, [group]);

  // Echtzeit-Listener für User-Profil (persönliche Labels)
  useEffect(() => {
    if (!profile) return;
    const unsub = subscribeToUserProfile(
      profile.userId,
      (p) => setUserDetail(p),
      () => {},
    );
    return () => unsub();
  }, [profile]);

  // Verfügbare Labels je nach Scope
  const availableLabels = taskScope === 'group' && groupDetail
    ? (groupDetail.labels ?? [])
    : (userDetail?.labels ?? []);

  async function handleAddLabel() {
    const trimmed = newLabelText.trim();
    if (!trimmed || availableLabels.includes(trimmed)) {
      setNewLabelText('');
      return;
    }
    if (taskScope === 'group' && group) {
      await addGroupLabel(group.groupId, trimmed);
    } else if (profile) {
      await addUserLabel(profile.userId, trimmed);
    }
    setLabels((prev) => new Set(prev).add(trimmed));
    setNewLabelText('');
  }

  const trimmedTitle = title.trim();
  const canSave = trimmedTitle.length > 0 && !saving && profile !== null;

  async function handleCreate() {
    if (!canSave || !profile) return;

    setSaving(true);
    setError(null);

    try {
      await createTask(
        {
          title: trimmedTitle,
          description: description.trim(),
          groupId: taskScope === 'group' && group ? group.groupId : null,
          priority,
          labels: [...labels],
          effortEstimate,
          deadline,
          subtasks,
        },
        {
          userId: profile.userId,
          displayName: profile.displayName,
          emoji: profile.emoji,
        },
        assignedTo,
      );
      setTitle('');
      setDescription('');
      setAssignedTo(null);
      setPriority(null);
      setLabels(new Set());
      setEffortEstimate(null);
      setDeadline(null);
      setSubtasks([]);
      setSuggestions([]);
      setAddedSuggestions(new Set());
      setSuggestSource(null);
      setSaving(false);
      router.replace('/(tabs)');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unbekannter Fehler';
      setError(`Aufgabe konnte nicht erstellt werden: ${message}`);
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
    <KeyboardAvoidingView
      style={styles.keyboardView}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.screenTitle}>Neue Aufgabe</Text>

        {/* Persönlich / Gruppe Toggle — nur wenn Gruppe vorhanden */}
        {group && (
          <View style={styles.scopeToggle}>
            <TouchableOpacity
              style={[styles.scopeButton, taskScope === 'personal' && styles.scopeButtonActive]}
              onPress={() => { setTaskScope('personal'); setAssignedTo(null); setLabels(new Set()); }}
            >
              <Text style={[styles.scopeText, taskScope === 'personal' && styles.scopeTextActive]}>
                Persönlich
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.scopeButton, taskScope === 'group' && styles.scopeButtonActive]}
              onPress={() => { setTaskScope('group'); setLabels(new Set()); }}
            >
              <Text style={[styles.scopeText, taskScope === 'group' && styles.scopeTextActive]}>
                Gruppe
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Titel */}
        <View style={styles.card}>
          <Text style={styles.label}>Titel *</Text>
          <TextInput
            style={styles.input}
            placeholder="Was ist zu tun?"
            placeholderTextColor={Colors.textTertiary}
            value={title}
            onChangeText={setTitle}
            autoCapitalize="sentences"
            autoCorrect
            maxLength={100}
            returnKeyType="next"
          />
        </View>

        {/* Beschreibung */}
        <View style={styles.card}>
          <Text style={styles.label}>Beschreibung (optional)</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Details, Notizen…"
            placeholderTextColor={Colors.textTertiary}
            value={description}
            onChangeText={setDescription}
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
          style={[styles.suggestButton, (trimmedTitle.length === 0 || suggestLoading) && styles.suggestButtonDisabled]}
          onPress={async () => {
            setSuggestLoading(true);
            setSuggestions([]);
            setAddedSuggestions(new Set());
            const result = await suggestSubtasksAI(trimmedTitle, description.trim() || undefined);
            setSuggestions(result.suggestions);
            setSuggestSource(result.source);
            setSuggestLoading(false);
          }}
          disabled={trimmedTitle.length === 0 || suggestLoading}
        >
          {suggestLoading ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Text style={[styles.suggestButtonText, trimmedTitle.length === 0 && styles.suggestButtonTextDisabled]}>
              💡 KI-Unteraufgaben vorschlagen
            </Text>
          )}
        </TouchableOpacity>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsCard}>
            <Text style={styles.suggestionsLabel}>
              KI-Vorschläge — antippen zum Hinzufügen:
            </Text>
            {suggestions.map((s) => {
              const isAdded = addedSuggestions.has(s);
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.suggestionChip, isAdded && styles.suggestionChipAdded]}
                  onPress={() => {
                    if (isAdded) return;
                    setSubtasks((prev) => [...prev, { id: generateId(), title: s, done: false }]);
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

        {/* Subtask-Vorschau */}
        {subtasks.length > 0 && (
          <View style={styles.subtasksCard}>
            <Text style={styles.label}>Unterpunkte ({subtasks.length})</Text>
            {subtasks.map((st) => (
              <View key={st.id} style={styles.subtaskRow}>
                <View style={styles.subtaskCheckEmpty} />
                <Text style={styles.subtaskTitle} numberOfLines={2}>{st.title}</Text>
                <TouchableOpacity
                  style={styles.subtaskRemove}
                  onPress={() => {
                    setSubtasks((prev) => prev.filter((s) => s.id !== st.id));
                    setAddedSuggestions((prev) => {
                      const next = new Set(prev);
                      next.delete(st.title);
                      return next;
                    });
                  }}
                >
                  <Text style={styles.subtaskRemoveText}>×</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Priorität */}
        <View style={styles.card}>
          <Text style={styles.label}>Priorität</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {([
              { value: null, label: 'Keine' },
              { value: 'low' as Priority, label: 'Niedrig' },
              { value: 'medium' as Priority, label: 'Mittel' },
              { value: 'high' as Priority, label: 'Hoch' },
            ] as const).map((opt) => (
              <TouchableOpacity
                key={opt.label}
                style={[styles.metaChip, priority === opt.value && styles.metaChipSelected]}
                onPress={() => setPriority(opt.value)}
              >
                <Text style={[styles.metaChipText, priority === opt.value && styles.metaChipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Labels */}
        <View style={styles.card}>
          <Text style={styles.label}>Labels</Text>
          <View style={styles.chipWrap}>
            {availableLabels.map((lbl) => {
              const isSelected = labels.has(lbl);
              return (
                <TouchableOpacity
                  key={lbl}
                  style={[styles.metaChip, isSelected && styles.metaChipSelected]}
                  onPress={() => setLabels((prev) => {
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
          <Text style={styles.label}>Geschätzter Aufwand</Text>
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
                style={[styles.metaChip, effortEstimate === opt.value && styles.metaChipSelected]}
                onPress={() => setEffortEstimate(opt.value)}
              >
                <Text style={[styles.metaChipText, effortEstimate === opt.value && styles.metaChipTextSelected]}>
                  {opt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Deadline */}
        <View style={styles.card}>
          <Text style={styles.label}>Deadline</Text>
          <DatePicker value={deadline} onChange={setDeadline} />
        </View>

        {/* Zuweisen an — nur bei Gruppen-Tasks */}
        {group && taskScope === 'group' && (
          <View style={styles.card}>
            <Text style={styles.label}>Zuweisen an (optional)</Text>
            {(() => {
              const otherUsers = allUsers.filter((u) => u.userId !== profile?.userId);
              if (otherUsers.length === 0) {
                return (
                  <Text style={styles.noUsersHint}>
                    Noch keine anderen Nutzer in der Gruppe
                  </Text>
                );
              }
              return (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.userChips}
                >
                  <TouchableOpacity
                    style={[styles.userChip, assignedTo === null && styles.userChipSelected]}
                    onPress={() => setAssignedTo(null)}
                  >
                    <Text style={[styles.userChipText, assignedTo === null && styles.userChipTextSelected]}>
                      Niemand
                    </Text>
                  </TouchableOpacity>
                  {otherUsers.map((user) => (
                    <TouchableOpacity
                      key={user.userId}
                      style={[styles.userChip, assignedTo?.userId === user.userId && styles.userChipSelected]}
                      onPress={() => setAssignedTo({
                        userId: user.userId,
                        displayName: user.displayName,
                        emoji: user.emoji,
                      })}
                    >
                      <Text style={[styles.userChipText, assignedTo?.userId === user.userId && styles.userChipTextSelected]}>
                        {user.displayName} {user.emoji}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              );
            })()}
          </View>
        )}

        {/* Ersteller-Info */}
        {profile && (
          <View style={styles.creatorInfo}>
            <Text style={styles.creatorText}>
              Erstellt von {profile.displayName} {profile.emoji}
            </Text>
          </View>
        )}

        {/* Fehler */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Buttons */}
        <TouchableOpacity
          style={[styles.createButton, !canSave && styles.createButtonDisabled]}
          onPress={handleCreate}
          disabled={!canSave}
          accessibilityLabel="Aufgabe erstellen"
        >
          {saving ? (
            <ActivityIndicator color={Colors.textOnPrimary} />
          ) : (
            <Text style={styles.createButtonText}>Aufgabe erstellen</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.replace('/(tabs)')}
          accessibilityLabel="Abbrechen"
        >
          <Text style={styles.cancelButtonText}>Abbrechen</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.backgroundPrimary,
  },
  keyboardView: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  container: {
    padding: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  screenTitle: {
    fontSize: Typography.sizeXXL,
    fontWeight: Typography.weightBold,
    color: Colors.textPrimary,
    marginTop: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  scopeToggle: {
    flexDirection: 'row',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.md,
    padding: Spacing.xs,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  scopeButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    alignItems: 'center',
  },
  scopeButtonActive: {
    backgroundColor: Colors.primary,
  },
  scopeText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  scopeTextActive: {
    color: Colors.textOnPrimary,
    fontWeight: Typography.weightSemiBold,
  },
  card: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  label: {
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
  subtasksCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    ...Shadows.sm,
  },
  subtaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.separatorOpaque,
  },
  subtaskCheckEmpty: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.separator,
    marginRight: Spacing.sm,
  },
  subtaskTitle: {
    flex: 1,
    fontSize: Typography.sizeSM,
    color: Colors.textPrimary,
  },
  subtaskRemove: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: Spacing.xs,
  },
  subtaskRemoveText: {
    fontSize: Typography.sizeLG,
    color: Colors.textTertiary,
    fontWeight: Typography.weightMedium,
  },
  chipRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
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
  noUsersHint: {
    fontSize: Typography.sizeSM,
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },
  userChips: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  userChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.backgroundPrimary,
    borderWidth: 1.5,
    borderColor: Colors.separatorOpaque,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
  },
  userChipSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  userChipText: {
    fontSize: Typography.sizeSM,
    fontWeight: Typography.weightMedium,
    color: Colors.textSecondary,
  },
  userChipTextSelected: {
    color: Colors.textOnPrimary,
  },
  creatorInfo: {
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  creatorText: {
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
  createButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET + 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    ...Shadows.md,
  },
  createButtonDisabled: {
    opacity: 0.5,
  },
  createButtonText: {
    color: Colors.textOnPrimary,
    fontSize: Typography.sizeLG,
    fontWeight: Typography.weightSemiBold,
  },
  cancelButton: {
    padding: Spacing.md,
    minHeight: MIN_TOUCH_TARGET,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: Colors.textTertiary,
    fontSize: Typography.sizeMD,
    fontWeight: Typography.weightMedium,
  },
});
