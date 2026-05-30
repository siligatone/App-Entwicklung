import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/task.dart';

class FirestoreService {
  FirestoreService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  CollectionReference<Map<String, dynamic>> get _tasks =>
      _firestore.collection('tasks');

  Stream<List<Task>> watchTasks({required String groupId}) {
    return _tasks
        .where('groupId', isEqualTo: groupId)
        .orderBy('createdAt', descending: true)
        .snapshots()
        .map((snapshot) => snapshot.docs.map(Task.fromDoc).toList());
  }

  Future<void> createTask(Task task) async {
    await _tasks.add(task.toMap());
  }

  Future<void> updateTask(Task task) async {
    await _tasks.doc(task.id).update(task.toMap());
  }

  Future<void> setTaskDone({required String taskId, required bool done}) async {
    await _tasks.doc(taskId).update({
      'done': done,
      'updatedAt': Timestamp.fromDate(DateTime.now()),
    });
  }

  Future<void> deleteTask(String taskId) async {
    await _tasks.doc(taskId).delete();
  }
}
