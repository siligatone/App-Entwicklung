import 'package:flutter/material.dart' hide Card;
import 'package:firebase_auth/firebase_auth.dart';
import 'package:provider/provider.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import '../models/task.dart';
import '../services/ai_service.dart';
import '../services/firestore_service.dart';
import '../state/app_state.dart';
import '../widgets/stats_card.dart';
import '../widgets/task_card.dart';
import '../widgets/task_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;
  bool _isAiSummaryLoading = false;

  static const _filters = <TaskFilter, (String, IconData)>{
    TaskFilter.all:          ('Alle',           LucideIcons.list),
    TaskFilter.mine:         ('Meine',          LucideIcons.userRound),
    TaskFilter.open:         ('Offen',          LucideIcons.circleDot),
    TaskFilter.done:         ('Erledigt',       LucideIcons.circleCheck),
    TaskFilter.dueToday:     ('Heute',          LucideIcons.calendarClock),
    TaskFilter.dueThisWeek:  ('Diese Woche',    LucideIcons.calendarDays),
    TaskFilter.highPriority: ('Hohe Priorität', LucideIcons.triangleAlert),
  };

  Future<void> _showAiSummary(BuildContext context, List<Task> tasks) async {
    final openTasks = tasks.where((t) => !t.done).toList();
    setState(() => _isAiSummaryLoading = true);
    try {
      final summary = await AiService.summarizeTasks(openTasks);
      if (!context.mounted) return;
      showShadDialog(
        context: context,
        builder: (ctx) => ShadDialog(
          title: Row(
            children: [
              Icon(LucideIcons.sparkles, size: 18,
                  color: ShadTheme.of(ctx).colorScheme.primary),
              const SizedBox(width: 8),
              const Text('Mein Tag'),
            ],
          ),
          description: const Text('KI-Zusammenfassung deiner offenen Aufgaben'),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(summary),
              const SizedBox(height: 16),
              ShadButton(
                onPressed: () => Navigator.of(ctx).pop(),
                child: const Text('Schließen'),
              ),
            ],
          ),
        ),
      );
    } catch (_) {
      if (context.mounted) {
        ShadToaster.of(context).show(
          const ShadToast.destructive(
            description: Text('KI-Zusammenfassung fehlgeschlagen.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isAiSummaryLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final service = context.read<FirestoreService>();
    final appState = context.watch<AppState>();
    final userName = appState.userName ?? 'Unbekannt';
    final groupId = appState.groupId ?? 'default-group';
    final theme = ShadTheme.of(context);

    return ShadToaster(
      child: Scaffold(
        appBar: AppBar(
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('StudyTask',
                  style: theme.textTheme.h4.copyWith(color: theme.colorScheme.foreground)),
              Text('Gruppe: $groupId',
                  style: theme.textTheme.muted.copyWith(fontSize: 11)),
            ],
          ),
          actions: [
            StreamBuilder<List<Task>>(
              stream: service.watchTasks(groupId: groupId),
              builder: (context, snapshot) {
                final tasks = snapshot.data ?? [];
                return IconButton(
                  tooltip: 'Mein Tag (KI)',
                  onPressed: _isAiSummaryLoading
                      ? null
                      : () => _showAiSummary(context, tasks),
                  icon: _isAiSummaryLoading
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2))
                      : const Icon(LucideIcons.sparkles),
                );
              },
            ),
            IconButton(
              tooltip: 'Abmelden',
              onPressed: () async {
                await FirebaseAuth.instance.signOut();
                if (!context.mounted) return;
                await context.read<AppState>().clearSetup();
              },
              icon: const Icon(LucideIcons.logOut),
            ),
          ],
        ),
        body: StreamBuilder<List<Task>>(
          stream: service.watchTasks(groupId: groupId),
          builder: (context, snapshot) {
            if (snapshot.hasError) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: ShadAlert.destructive(
                    icon: Icon(LucideIcons.circleAlert, size: 16),
                    title: const Text('Fehler'),
                    description: Text('${snapshot.error}'),
                  ),
                ),
              );
            }
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            final tasks = snapshot.data ?? const <Task>[];

            if (_tabIndex == 1) {
              return _buildStatsTab(tasks, userName);
            }

            final visibleTasks = _applyFilter(
              tasks: tasks,
              filter: appState.filter,
              userName: userName,
            );

            return Column(
              children: [
                // Filter chips
                SizedBox(
                  height: 52,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    children: TaskFilter.values.map((filter) {
                      final (label, icon) = _filters[filter]!;
                      final isSelected = appState.filter == filter;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: isSelected
                            ? ShadBadge(
                                onPressed: () => appState.setFilter(filter),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(icon, size: 10),
                                    const SizedBox(width: 4),
                                    Text(label),
                                  ],
                                ),
                              )
                            : ShadBadge.secondary(
                                onPressed: () => appState.setFilter(filter),
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(icon, size: 10),
                                    const SizedBox(width: 4),
                                    Text(label),
                                  ],
                                ),
                              ),
                      );
                    }).toList(),
                  ),
                ),
                if (visibleTasks.isEmpty)
                  Expanded(
                    child: Center(
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(LucideIcons.clipboardCheck,
                              size: 48, color: theme.colorScheme.mutedForeground),
                          const SizedBox(height: 12),
                          Text('Keine Aufgaben für diesen Filter.',
                              style: theme.textTheme.muted),
                        ],
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      padding: const EdgeInsets.fromLTRB(12, 4, 12, 80),
                      itemCount: visibleTasks.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 8),
                      itemBuilder: (context, index) {
                        final task = visibleTasks[index];
                        return TaskCard(
                          task: task,
                          onToggleDone: () => service.setTaskDone(
                            taskId: task.id,
                            done: !task.done,
                          ),
                          onEdit: () => _editTask(context, task),
                          onDelete: () => service.deleteTask(task.id),
                        );
                      },
                    ),
                  ),
              ],
            );
          },
        ),
        floatingActionButton: ShadButton(
          onPressed: () => _createTask(context),
          leading: const Icon(LucideIcons.plus, size: 16),
          child: const Text('Aufgabe'),
        ),
        bottomNavigationBar: NavigationBar(
          selectedIndex: _tabIndex,
          onDestinationSelected: (index) => setState(() => _tabIndex = index),
          destinations: const [
            NavigationDestination(
              icon: Icon(LucideIcons.listTodo),
              label: 'Aufgaben',
            ),
            NavigationDestination(
              icon: Icon(LucideIcons.chartBar),
              label: 'Statistik',
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStatsTab(List<Task> tasks, String userName) {
    final now = DateTime.now();
    final open = tasks.where((t) => !t.done).length;
    final done = tasks.where((t) => t.done).length;
    final mine = tasks
        .where((t) => (t.assignedTo ?? '').toLowerCase() == userName.toLowerCase())
        .length;
    final overdue = tasks
        .where((t) => !t.done && t.dueDate != null && t.dueDate!.isBefore(now))
        .length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Text('Übersicht', style: ShadTheme.of(context).textTheme.h3),
        const SizedBox(height: 12),
        StatsGrid(open: open, done: done, mine: mine, overdue: overdue),
      ],
    );
  }

  Future<void> _createTask(BuildContext context) async {
    final service = context.read<FirestoreService>();
    final appState = context.read<AppState>();
    final formData = await showShadDialog<TaskFormData>(
      context: context,
      builder: (_) => TaskDialog(initialAssignedTo: appState.userName),
    );
    if (formData == null) return;

    final now = DateTime.now();
    await service.createTask(
      Task(
        id: '',
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        done: false,
        createdAt: now,
        groupId: appState.groupId ?? 'default-group',
        createdBy: appState.userName ?? 'Unbekannt',
        dueDate: formData.dueDate,
        assignedTo: formData.assignedTo,
        updatedAt: now,
      ),
    );
  }

  Future<void> _editTask(BuildContext context, Task task) async {
    final service = context.read<FirestoreService>();
    final formData = await showShadDialog<TaskFormData>(
      context: context,
      builder: (_) => TaskDialog(initialTask: task),
    );
    if (formData == null) return;

    await service.updateTask(
      task.copyWith(
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        dueDate: formData.dueDate,
        assignedTo: formData.assignedTo,
        updatedAt: DateTime.now(),
      ),
    );
  }

  List<Task> _applyFilter({
    required List<Task> tasks,
    required TaskFilter filter,
    required String userName,
  }) {
    final now = DateTime.now();

    bool isToday(DateTime date) =>
        date.year == now.year && date.month == now.month && date.day == now.day;

    bool isThisWeek(DateTime date) {
      final start = now.subtract(Duration(days: now.weekday - 1));
      final end = start.add(const Duration(days: 7));
      return date.isAfter(start.subtract(const Duration(seconds: 1))) &&
          date.isBefore(end);
    }

    final filtered = tasks.where((task) {
      switch (filter) {
        case TaskFilter.all:          return true;
        case TaskFilter.mine:         return (task.assignedTo ?? '').toLowerCase() == userName.toLowerCase();
        case TaskFilter.open:         return !task.done;
        case TaskFilter.done:         return task.done;
        case TaskFilter.dueToday:     return task.dueDate != null && isToday(task.dueDate!);
        case TaskFilter.dueThisWeek:  return task.dueDate != null && isThisWeek(task.dueDate!);
        case TaskFilter.highPriority: return task.priority.toLowerCase() == 'hoch';
      }
    }).toList();

    filtered.sort((a, b) {
      final aDue = a.dueDate;
      final bDue = b.dueDate;
      if (aDue == null && bDue == null) return b.createdAt.compareTo(a.createdAt);
      if (aDue == null) return 1;
      if (bDue == null) return -1;
      return aDue.compareTo(bDue);
    });

    return filtered;
  }
}
