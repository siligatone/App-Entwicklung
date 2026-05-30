import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/task.dart';

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
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _titleController;
  late final TextEditingController _descriptionController;
  late final TextEditingController _assignedToController;

  late String _priority;
  DateTime? _dueDate;

  static const _priorities = ['niedrig', 'mittel', 'hoch'];

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

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      title: Text(widget.isEdit ? 'Aufgabe bearbeiten' : 'Aufgabe erstellen'),
      content: SingleChildScrollView(
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(labelText: 'Titel *'),
                validator: (value) {
                  if (value == null || value.trim().isEmpty) {
                    return 'Bitte Titel eingeben';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _descriptionController,
                maxLines: 3,
                decoration: const InputDecoration(labelText: 'Beschreibung'),
              ),
              const SizedBox(height: 10),
              DropdownButtonFormField<String>(
                initialValue: _priority,
                items: _priorities
                    .map((p) => DropdownMenuItem(value: p, child: Text(p)))
                    .toList(),
                onChanged: (value) {
                  if (value != null) {
                    setState(() => _priority = value);
                  }
                },
                decoration: const InputDecoration(labelText: 'Priorität'),
              ),
              const SizedBox(height: 10),
              TextFormField(
                controller: _assignedToController,
                decoration: const InputDecoration(labelText: 'Zugewiesen an'),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: Text(
                      _dueDate == null
                          ? 'Keine Fälligkeit'
                          : 'Fällig: ${DateFormat('dd.MM.yyyy').format(_dueDate!)}',
                    ),
                  ),
                  TextButton(
                    onPressed: _pickDate,
                    child: const Text('Datum wählen'),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
      actions: [
        if (_dueDate != null)
          TextButton(
            onPressed: () => setState(() => _dueDate = null),
            child: const Text('Datum entfernen'),
          ),
        TextButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Abbrechen'),
        ),
        FilledButton(
          onPressed: _submit,
          child: Text(widget.isEdit ? 'Speichern' : 'Erstellen'),
        ),
      ],
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

    if (selected != null) {
      setState(() => _dueDate = selected);
    }
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    final assigned = _assignedToController.text.trim();
    Navigator.of(context).pop(
      TaskFormData(
        title: _titleController.text.trim(),
        description: _descriptionController.text.trim(),
        priority: _priority,
        dueDate: _dueDate,
        assignedTo: assigned.isEmpty ? null : assigned,
      ),
    );
  }
}
