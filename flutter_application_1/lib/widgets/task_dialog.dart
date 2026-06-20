import 'package:flutter/material.dart' hide Card;
import 'package:intl/intl.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import '../models/task.dart';
import '../services/ai_service.dart';

class TaskFormData {
  const TaskFormData({
    required this.title,
    required this.description,
    required this.priority,
    this.dueDate,
    this.assignedTo,
  });

  final String title;
  final String description;
  final String priority;
  final DateTime? dueDate;
  final String? assignedTo;
}

class TaskDialog extends StatefulWidget {
  const TaskDialog({
    super.key,
    this.initialTask,
    this.initialAssignedTo,
  });

  final Task? initialTask;
  final String? initialAssignedTo;

  bool get isEdit => initialTask != null;

  @override
  State<TaskDialog> createState() => _TaskDialogState();
}

class _TaskDialogState extends State<TaskDialog> {
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _assignedToController;

  late String _priority;
  DateTime? _dueDate;
  bool _isAiLoading = false;
  String? _aiSuggestion;

  static const _priorities = ['niedrig', 'mittel', 'hoch'];
  static const _priorityLabels = {
    'niedrig': 'Niedrig',
    'mittel': 'Mittel',
    'hoch': 'Hoch',
  };

  @override
  void initState() {
    super.initState();
    final task = widget.initialTask;
    _titleController = TextEditingController(text: task?.title ?? '');
    _descriptionController = TextEditingController(text: task?.description ?? '');
    _assignedToController = TextEditingController(
      text: task?.assignedTo ?? widget.initialAssignedTo ?? '',
    );
    _priority = task?.priority ?? 'mittel';
    _dueDate = task?.dueDate;
  }

  @override
  void dispose() {
    _titleController.dispose();
    _descriptionController.dispose();
    _assignedToController.dispose();
    super.dispose();
  }

  Future<void> _askAi() async {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ShadToaster.of(context).show(
        const ShadToast.destructive(
          description: Text('Bitte zuerst einen Titel eingeben.'),
        ),
      );
      return;
    }
    setState(() {
      _isAiLoading = true;
      _aiSuggestion = null;
    });
    try {
      final suggestion = await AiService.suggestPriority(
        title,
        _descriptionController.text.trim(),
      );
      setState(() => _aiSuggestion = suggestion);
    } catch (_) {
      if (mounted) {
        ShadToaster.of(context).show(
          const ShadToast.destructive(
            description: Text('KI-Vorschlag fehlgeschlagen.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isAiLoading = false);
    }
  }

  void _applyAiSuggestion() {
    if (_aiSuggestion == null) return;
    final lower = _aiSuggestion!.toLowerCase();
    String? matched;
    for (final p in _priorities) {
      if (lower.contains(p)) {
        matched = p;
        break;
      }
    }
    if (matched != null) {
      setState(() {
        _priority = matched!;
        _aiSuggestion = null;
      });
      ShadToaster.of(context).show(
        ShadToast(
          description: Text('Priorität auf "${_priorityLabels[matched]}" gesetzt.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    final cs = theme.colorScheme;

    return ShadDialog(
      title: Text(widget.isEdit ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'),
      description: Text(
        widget.isEdit
            ? 'Ändere die Details dieser Aufgabe.'
            : 'Füge eine neue Aufgabe zur Gruppe hinzu.',
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          ShadInput(
            controller: _titleController,
            placeholder: const Text('Titel *'),
            leading: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(LucideIcons.type, size: 14, color: cs.mutedForeground),
            ),
          ),
          const SizedBox(height: 10),
          ShadInput(
            controller: _descriptionController,
            maxLines: 3,
            placeholder: const Text('Beschreibung (optional)'),
          ),
          const SizedBox(height: 10),
          ShadSelect<String>(
            placeholder: const Text('Priorität wählen'),
            initialValue: _priority,
            onChanged: (v) { if (v != null) setState(() => _priority = v); },
            options: _priorities
                .map((p) => ShadOption(value: p, child: Text(_priorityLabels[p]!)))
                .toList(),
            selectedOptionBuilder: (ctx, v) => Text(_priorityLabels[v] ?? v),
          ),
          const SizedBox(height: 10),
          ShadInput(
            controller: _assignedToController,
            placeholder: const Text('Zugewiesen an'),
            leading: Padding(
              padding: const EdgeInsets.all(8),
              child: Icon(LucideIcons.userRound, size: 14, color: cs.mutedForeground),
            ),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Icon(LucideIcons.calendar, size: 14, color: cs.mutedForeground),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  _dueDate == null
                      ? 'Kein Fälligkeitsdatum'
                      : 'Fällig: ${DateFormat('dd.MM.yyyy').format(_dueDate!)}',
                  style: theme.textTheme.muted,
                ),
              ),
              if (_dueDate != null)
                ShadButton.ghost(
                  size: ShadButtonSize.sm,
                  onPressed: () => setState(() => _dueDate = null),
                  child: Icon(LucideIcons.x, size: 14),
                ),
              ShadButton.outline(
                size: ShadButtonSize.sm,
                onPressed: _pickDate,
                child: const Text('Datum'),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ShadButton.secondary(
            onPressed: _isAiLoading ? null : _askAi,
            leading: _isAiLoading
                ? const SizedBox(
                    width: 14, height: 14,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : Icon(LucideIcons.sparkles, size: 14),
            child: Text(_isAiLoading ? 'KI analysiert...' : 'KI fragen'),
          ),
          if (_aiSuggestion != null) ...[
            const SizedBox(height: 10),
            ShadCard(
              backgroundColor: cs.accent,
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(LucideIcons.sparkles, size: 14, color: cs.primary),
                      const SizedBox(width: 6),
                      Text('KI-Vorschlag', style: theme.textTheme.small),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(_aiSuggestion!, style: theme.textTheme.muted),
                  const SizedBox(height: 8),
                  ShadButton(
                    size: ShadButtonSize.sm,
                    onPressed: _applyAiSuggestion,
                    leading: Icon(LucideIcons.check, size: 12),
                    child: const Text('Übernehmen'),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              ShadButton.ghost(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text('Abbrechen'),
              ),
              const SizedBox(width: 8),
              ShadButton(
                onPressed: _submit,
                leading: Icon(
                  widget.isEdit ? LucideIcons.save : LucideIcons.plus,
                  size: 14,
                ),
                child: Text(widget.isEdit ? 'Speichern' : 'Erstellen'),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _pickDate() async {
    final now = DateTime.now();
    final selected = await showDatePicker(
      context: context,
      initialDate: _dueDate ?? now,
      firstDate: DateTime(now.year - 2),
      lastDate: DateTime(now.year + 5),
    );
    if (selected != null) setState(() => _dueDate = selected);
  }

  void _submit() {
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      ShadToaster.of(context).show(
        const ShadToast.destructive(description: Text('Bitte Titel eingeben.')),
      );
      return;
    }
    final assigned = _assignedToController.text.trim();
    Navigator.of(context).pop(
      TaskFormData(
        title: title,
        description: _descriptionController.text.trim(),
        priority: _priority,
        dueDate: _dueDate,
        assignedTo: assigned.isEmpty ? null : assigned,
      ),
    );
  }
}
