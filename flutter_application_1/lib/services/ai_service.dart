import 'package:google_generative_ai/google_generative_ai.dart';

import '../models/task.dart';

class AiService {
  // Gemini API Key — für Demo-Zwecke hier gespeichert.
  // In Produktion: über Environment-Variables oder Firebase Remote Config
  static const _apiKey = 'AIzaSyDummy_Replace_With_Real_Key';

  static GenerativeModel? _model;

  static GenerativeModel get _instance {
    _model ??= GenerativeModel(
      model: 'gemini-1.5-flash',
      apiKey: _apiKey,
    );
    return _model!;
  }

  /// Schlägt eine Priorität basierend auf Titel und Beschreibung vor.
  static Future<String> suggestPriority(String title, String description) async {
    final prompt = '''
Du bist ein hilfreicher Assistent für eine Aufgabenmanagement-App für Studenten.
Analysiere diese Aufgabe und schlage eine Priorität vor (niedrig, mittel oder hoch).
Antworte auf Deutsch in 1-2 kurzen Sätzen und nenne die empfohlene Priorität explizit.

Aufgabentitel: $title
Beschreibung: ${description.isEmpty ? '(keine Beschreibung)' : description}
''';

    final response = await _instance.generateContent([Content.text(prompt)]);
    return response.text ?? 'Keine Empfehlung verfügbar.';
  }

  /// Erstellt eine Tages-Zusammenfassung aller offenen Aufgaben.
  static Future<String> summarizeTasks(List<Task> tasks) async {
    if (tasks.isEmpty) {
      return 'Du hast keine offenen Aufgaben. Gut gemacht!';
    }

    final taskList = tasks
        .take(20) // max 20 Aufgaben für den Prompt
        .map((t) =>
            '- ${t.title} (Priorität: ${t.priority}${t.dueDate != null ? ', fällig: ${t.dueDate!.day}.${t.dueDate!.month}.${t.dueDate!.year}' : ''})')
        .join('\n');

    final prompt = '''
Du bist ein hilfreicher Assistent für eine Studenten-Aufgaben-App.
Fasse die folgenden offenen Aufgaben kurz zusammen und gib 1-2 konkrete Empfehlungen, womit man heute beginnen sollte.
Antworte auf Deutsch in maximal 4 Sätzen.

Offene Aufgaben:
$taskList
''';

    final response = await _instance.generateContent([Content.text(prompt)]);
    return response.text ?? 'Zusammenfassung nicht verfügbar.';
  }
}
