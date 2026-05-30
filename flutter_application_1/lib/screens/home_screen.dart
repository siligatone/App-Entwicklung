import 'package:flutter/material.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';

import '../models/task.dart';
import '../services/firestore_service.dart';
import '../state/app_state.dart';
import '../widgets/task_dialog.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tabIndex = 0;

  static const _filterLabels = <TaskFilter, String>{
    TaskFilter.all: 'Alle',
    TaskFilter.mine: 'Meine',
    TaskFilter.open: 'Offen',
    TaskFilter.done: 'Erledigt',
    TaskFilter.dueToday: 'Heute fällig',
    TaskFilter.dueThisWeek: 'Diese Woche',
    TaskFilter.highPriority: 'Hohe Priorität',
  };

  @override
  Widget build(BuildContext context) {
    final service = context.read<FirestoreService>();
    final appState = context.watch<AppState>();
    final userName = appState.userName ?? 'Unbekannt';
    final groupId = appState.groupId ?? 'default-group';

    return Scaffold(
      appBar: AppBar(
        title: Text('StudyTask · Gruppe: $groupId'),
        actions: [
          IconButton(
            tooltip: 'Abmelden',
            onPressed: () async {
              await FirebaseAuth.instance.signOut();
              if (!context.mounted) {
                return;
              }
              await context.read<AppState>().clearSetup();
            },
            icon: const Icon(Icons.logout),
          ),
          PopupMenuButton<String>(
            onSelected: (value) {
              if (value == 'reset_setup') {
                appState.clearSetup();
              }
            },
            itemBuilder: (_) => const [
              PopupMenuItem(
                value: 'reset_setup',
                child: Text('Setup zurücksetzen'),
              ),
            ],
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
                child: Text('Fehler beim Laden: ${snapshot.error}'),
              ),
            );
          }

          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          final tasks = snapshot.data ?? const <Task>[];
          final visibleTasks = _applyFilter(
            tasks: tasks,
            filter: appState.filter,
            userName: userName,
          );

          if (_tabIndex == 1) {
            return _StatsView(tasks: tasks, userName: userName);
          }

          return Column(
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(12, 12, 12, 8),
                child: _HintCard(tasks: tasks),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                child: SizedBox(
                  height: 42,
                  child: ListView(
                    scrollDirection: Axis.horizontal,
                    children: TaskFilter.values
                        .map(
                          (filter) => Padding(
                            padding: const EdgeInsets.only(right: 8),
                            child: ChoiceChip(
                              label: Text(_filterLabels[filter]!),
                              selected: appState.filter == filter,
                              onSelected: (_) => appState.setFilter(filter),
                            ),
                          ),
                        )
                        .toList(),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              if (visibleTasks.isEmpty)
                const Expanded(
                  child: Center(child: Text('Keine Aufgaben für diesen Filter.')),
                )
              else
                Expanded(
                  child: ListView.separated(
                    itemCount: visibleTasks.length,
                    separatorBuilder: (context, index) => const Divider(height: 1),
                    itemBuilder: (context, index) {
                      final task = visibleTasks[index];
                      return ListTile(
                        leading: Checkbox(
                          value: task.done,
                          onChanged: (value) {
                            service.setTaskDone(
                              taskId: task.id,
                              done: value ?? false,
                            );
                          },
                        ),
                        title: Text(
                          task.title,
                          style: TextStyle(
                            decoration:
                                task.done ? TextDecoration.lineThrough : null,
                          ),
                        ),
                        subtitle: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            if (task.description.isNotEmpty) Text(task.description),
                            const SizedBox(height: 4),
                            Wrap(
                              spacing: 8,
                              children: [
                                _MetaChip(label: 'Priorität: ${task.priority}'),
                                if (task.dueDate != null)
                                  _MetaChip(
                                    label:
                                        'Fällig: ${DateFormat('dd.MM.yyyy').format(task.dueDate!)}',
                                  ),
                                if (task.assignedTo != null)
                                  _MetaChip(label: 'An: ${task.assignedTo}'),
                                _MetaChip(label: 'Von: ${task.createdBy}'),
                              ],
                            ),
                          ],
                        ),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.edit_outlined),
                              onPressed: () => _editTask(context, task),
                            ),
                            IconButton(
                              icon: const Icon(Icons.delete_outline),
                              onPressed: () => service.deleteTask(task.id),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
            ],
          );
        },
      ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _createTask(context),
        child: const Icon(Icons.add),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.list_alt), label: 'Aufgaben'),
          NavigationDestination(icon: Icon(Icons.insights), label: 'Statistik'),
        ],
      ),
    );
  }

  Future<void> _createTask(BuildContext context) async {
    final service = context.read<FirestoreService>();
    final appState = context.read<AppState>();
    final formData = await showDialog<TaskFormData>(
      context: context,
      builder: (_) => TaskDialog(
        initialAssignedTo: appState.userName,
      ),
    );

    if (formData == null) {
      return;
    }

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
    final formData = await showDialog<TaskFormData>(
      context: context,
      builder: (_) => TaskDialog(initialTask: task),
    );

    if (formData == null) {
      return;
    }

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

    bool isToday(DateTime date) {
      return date.year == now.year &&
          date.month == now.month &&
          date.day == now.day;
    }

    bool isThisWeek(DateTime date) {
      final start = now.subtract(Duration(days: now.weekday - 1));
      final end = start.add(const Duration(days: 7));
      return date.isAfter(start.subtract(const Duration(seconds: 1))) &&
          date.isBefore(end);
    }

    final filtered = tasks.where((task) {
      switch (filter) {
        case TaskFilter.all:
          return true;
        case TaskFilter.mine:
          return (task.assignedTo ?? '').toLowerCase() == userName.toLowerCase();
        case TaskFilter.open:
          return !task.done;
        case TaskFilter.done:
          return task.done;
        case TaskFilter.dueToday:
          return task.dueDate != null && isToday(task.dueDate!);
        case TaskFilter.dueThisWeek:
          return task.dueDate != null && isThisWeek(task.dueDate!);
        case TaskFilter.highPriority:
          return task.priority.toLowerCase() == 'hoch';
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

class _HintCard extends StatelessWidget {
  const _HintCard({required this.tasks});

  final List<Task> tasks;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final overdue = tasks.where((t) =>
        !t.done && t.dueDate != null && t.dueDate!.isBefore(now)).length;
    final highOpen = tasks
        .where((t) => !t.done && t.priority.toLowerCase() == 'hoch')
        .length;

    String message;
    if (overdue > 0) {
      message = '⚠️ $overdue Aufgabe(n) sind überfällig.';
    } else if (highOpen > 0) {
      message = '💡 $highOpen offene Aufgabe(n) mit hoher Priorität.';
    } else {
      message = '✅ Gute Arbeit! Aktuell keine kritischen Aufgaben.';
    }

    return Card(
      margin: EdgeInsets.zero,
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            const Icon(Icons.auto_awesome),
            const SizedBox(width: 8),
            Expanded(child: Text(message)),
          ],
        ),
      ),
    );
  }
}

class _StatsView extends StatelessWidget {
  const _StatsView({required this.tasks, required this.userName});

  final List<Task> tasks;
  final String userName;

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final open = tasks.where((t) => !t.done).length;
    final done = tasks.where((t) => t.done).length;
    final mine = tasks
        .where((t) => (t.assignedTo ?? '').toLowerCase() == userName.toLowerCase())
        .length;
    final overdue = tasks.where((t) =>
        !t.done && t.dueDate != null && t.dueDate!.isBefore(now)).length;

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        Wrap(
          spacing: 12,
          runSpacing: 12,
          children: [
            _StatCard(title: 'Offen', value: '$open'),
            _StatCard(title: 'Erledigt', value: '$done'),
            _StatCard(title: 'Meine Aufgaben', value: '$mine'),
            _StatCard(title: 'Überfällig', value: '$overdue'),
          ],
        ),
      ],
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 170,
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: Theme.of(context).textTheme.titleSmall),
              const SizedBox(height: 8),
              Text(
                value,
                style: Theme.of(context).textTheme.headlineMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(top: 4),
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(label, style: Theme.of(context).textTheme.bodySmall),
    );
  }
}
