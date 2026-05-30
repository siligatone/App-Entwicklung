import 'package:cloud_firestore/cloud_firestore.dart';

class Task {
  const Task({
    required this.id,
    required this.title,
    required this.description,
    required this.priority,
    required this.done,
    required this.createdAt,
    required this.groupId,
    required this.createdBy,
    this.dueDate,
    this.assignedTo,
    this.updatedAt,
  });

  final String id;
  final String title;
  final String description;
  final String priority;
  final bool done;
  final DateTime createdAt;
  final String groupId;
  final String createdBy;
  final DateTime? dueDate;
  final String? assignedTo;
  final DateTime? updatedAt;

  Task copyWith({
    String? id,
    String? title,
    String? description,
    String? priority,
    bool? done,
    DateTime? createdAt,
    String? groupId,
    String? createdBy,
    DateTime? dueDate,
    String? assignedTo,
    DateTime? updatedAt,
  }) {
    return Task(
      id: id ?? this.id,
      title: title ?? this.title,
      description: description ?? this.description,
      priority: priority ?? this.priority,
      done: done ?? this.done,
      createdAt: createdAt ?? this.createdAt,
      groupId: groupId ?? this.groupId,
      createdBy: createdBy ?? this.createdBy,
      dueDate: dueDate ?? this.dueDate,
      assignedTo: assignedTo ?? this.assignedTo,
      updatedAt: updatedAt ?? this.updatedAt,
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'title': title,
      'description': description,
      'priority': priority,
      'done': done,
      'createdAt': Timestamp.fromDate(createdAt),
      'groupId': groupId,
      'createdBy': createdBy,
      'dueDate': dueDate == null ? null : Timestamp.fromDate(dueDate!),
      'assignedTo': assignedTo,
      'updatedAt': updatedAt == null ? null : Timestamp.fromDate(updatedAt!),
    };
  }

  factory Task.fromDoc(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};

    return Task(
      id: doc.id,
      title: (data['title'] as String?)?.trim().isNotEmpty == true
          ? data['title'] as String
          : 'Ohne Titel',
      description: (data['description'] as String?) ?? '',
      priority: (data['priority'] as String?) ?? 'mittel',
      done: (data['done'] as bool?) ?? false,
      createdAt: _parseDate(data['createdAt']) ?? DateTime.now(),
        groupId: (data['groupId'] as String?) ?? 'default-group',
        createdBy: (data['createdBy'] as String?) ?? 'Unbekannt',
      dueDate: _parseDate(data['dueDate']),
      assignedTo: (data['assignedTo'] as String?)?.trim().isEmpty == true
          ? null
          : data['assignedTo'] as String?,
      updatedAt: _parseDate(data['updatedAt']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value is Timestamp) {
      return value.toDate();
    }
    if (value is DateTime) {
      return value;
    }
    return null;
  }
}
