import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';

enum TaskFilter {
  all,
  mine,
  open,
  done,
  dueToday,
  dueThisWeek,
  highPriority,
}

class AppState extends ChangeNotifier {
  AppState(this._prefs);

  static const _userNameKey = 'user_name';
  static const _groupIdKey = 'group_id';
  static const _filterKey = 'task_filter';

  final SharedPreferencesAsync _prefs;

  String? _userName;
  String? _groupId;
  TaskFilter _filter = TaskFilter.all;

  String? get userName => _userName;
  String? get groupId => _groupId;
  TaskFilter get filter => _filter;

  bool get isConfigured =>
      (_userName?.trim().isNotEmpty ?? false) &&
      (_groupId?.trim().isNotEmpty ?? false);

  static Future<AppState> load() async {
    final prefs = SharedPreferencesAsync();
    final state = AppState(prefs);
    await state._hydrate();
    return state;
  }

  Future<void> _hydrate() async {
    _userName = await _prefs.getString(_userNameKey);
    _groupId = await _prefs.getString(_groupIdKey);
    final savedFilter = await _prefs.getInt(_filterKey);
    if (savedFilter != null &&
        savedFilter >= 0 &&
        savedFilter < TaskFilter.values.length) {
      _filter = TaskFilter.values[savedFilter];
    }
  }

  Future<void> configure({required String userName, required String groupId}) async {
    _userName = userName.trim();
    _groupId = groupId.trim();
    await _prefs.setString(_userNameKey, _userName!);
    await _prefs.setString(_groupIdKey, _groupId!);
    notifyListeners();
  }

  Future<void> clearSetup() async {
    _userName = null;
    _groupId = null;
    await _prefs.remove(_userNameKey);
    await _prefs.remove(_groupIdKey);
    notifyListeners();
  }

  Future<void> setFilter(TaskFilter filter) async {
    if (_filter == filter) {
      return;
    }
    _filter = filter;
    await _prefs.setInt(_filterKey, filter.index);
    notifyListeners();
  }
}
