import 'package:flutter/material.dart' hide Card;
import 'package:intl/intl.dart';
import 'package:shadcn_ui/shadcn_ui.dart';

import '../models/task.dart';

class TaskCard extends StatelessWidget {
  const TaskCard({
    super.key,
    required this.task,
    required this.onToggleDone,
    required this.onEdit,
    required this.onDelete,
    this.onTap,
  });

  final Task task;
  final VoidCallback onToggleDone;
  final VoidCallback onEdit;
  final VoidCallback onDelete;
  final VoidCallback? onTap;

  Color _priorityColor(ShadColorScheme cs) {
    switch (task.priority) {
      case 'hoch':
        return cs.destructive;
      case 'mittel':
        return const Color(0xFFF97316); // orange — not in shadcn tokens
      default:
        return cs.primary;
    }
  }

  String _priorityLabel() {
    switch (task.priority) {
      case 'hoch': return 'Hoch';
      case 'mittel': return 'Mittel';
      default: return 'Niedrig';
    }
  }

  bool get _isOverdue =>
      !task.done && task.dueDate != null && task.dueDate!.isBefore(DateTime.now());

  @override
  Widget build(BuildContext context) {
    final theme = ShadTheme.of(context);
    final cs = theme.colorScheme;

    return GestureDetector(
      onTap: onTap,
      child: ShadCard(
        padding: EdgeInsets.zero,
        child: IntrinsicHeight(
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Container(
                width: 4,
                decoration: BoxDecoration(
                  color: _priorityColor(cs),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(6),
                    bottomLeft: Radius.circular(6),
                  ),
                ),
              ),
              Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          SizedBox(
                            width: 20,
                            height: 20,
                            child: Checkbox(
                              value: task.done,
                              onChanged: (_) => onToggleDone(),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(4),
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Text(
                              task.title,
                              style: theme.textTheme.p.copyWith(
                                fontWeight: FontWeight.w600,
                                decoration: task.done ? TextDecoration.lineThrough : null,
                                color: task.done ? cs.mutedForeground : cs.foreground,
                              ),
                            ),
                          ),
                          ShadButton.ghost(
                            size: ShadButtonSize.sm,
                            onPressed: onEdit,
                            child: Icon(LucideIcons.pencil, size: 14, color: cs.mutedForeground),
                          ),
                          ShadButton.ghost(
                            size: ShadButtonSize.sm,
                            onPressed: onDelete,
                            child: Icon(LucideIcons.trash2, size: 14, color: cs.destructive),
                          ),
                        ],
                      ),
                      if (task.description.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Padding(
                          padding: const EdgeInsets.only(left: 28),
                          child: Text(
                            task.description,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: theme.textTheme.muted,
                          ),
                        ),
                      ],
                      const SizedBox(height: 8),
                      Padding(
                        padding: const EdgeInsets.only(left: 28),
                        child: Wrap(
                          spacing: 6,
                          runSpacing: 4,
                          children: [
                            ShadBadge.secondary(
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(LucideIcons.flag, size: 10, color: _priorityColor(cs)),
                                  const SizedBox(width: 4),
                                  Text(_priorityLabel()),
                                ],
                              ),
                            ),
                            if (task.dueDate != null)
                              _isOverdue
                                  ? ShadBadge.destructive(
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(LucideIcons.calendarX2, size: 10),
                                          const SizedBox(width: 4),
                                          Text(DateFormat('dd.MM.yy').format(task.dueDate!)),
                                        ],
                                      ),
                                    )
                                  : ShadBadge.outline(
                                      child: Row(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          const Icon(LucideIcons.calendar, size: 10),
                                          const SizedBox(width: 4),
                                          Text(DateFormat('dd.MM.yy').format(task.dueDate!)),
                                        ],
                                      ),
                                    ),
                            if (task.assignedTo != null)
                              ShadBadge.outline(
                                child: Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    const Icon(LucideIcons.userRound, size: 10),
                                    const SizedBox(width: 4),
                                    Text(task.assignedTo!),
                                  ],
                                ),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
