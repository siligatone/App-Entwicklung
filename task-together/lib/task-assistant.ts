// Unteraufgaben-Vorschläge und Aufgaben-Priorisierung
// Gemini API wenn API-Key vorhanden, sonst lokaler Fallback

interface Rule {
  keywords: string[];
  suggestions: string[];
}

const rules: Rule[] = [
  {
    keywords: ['präsentation', 'folien', 'vortrag', 'slides', 'pitch'],
    suggestions: [
      'Inhalte und Kernaussagen sammeln',
      'Folienstruktur und Gliederung erstellen',
      'Folien gestalten und Grafiken einfügen',
      'Demo oder Live-Beispiel vorbereiten',
      'Vortrag üben und Zeitplan prüfen',
    ],
  },
  {
    keywords: ['doku', 'dokumentation', 'bericht', 'readme', 'anleitung'],
    suggestions: [
      'Gliederung und Kapitelstruktur erstellen',
      'Inhalte ausarbeiten und formulieren',
      'Screenshots und Diagramme ergänzen',
      'Quellen und Referenzen einfügen',
      'Korrekturlesen und Formatierung prüfen',
    ],
  },
  {
    keywords: ['test', 'bug', 'fehler', 'fix', 'debug'],
    suggestions: [
      'Problem reproduzieren und Schritte dokumentieren',
      'Ursache analysieren und eingrenzen',
      'Lösung implementieren',
      'Fix testen und Seiteneffekte prüfen',
      'Ergebnis dokumentieren',
    ],
  },
  {
    keywords: ['code', 'implementier', 'develop', 'programm', 'feature', 'funktion'],
    suggestions: [
      'Anforderungen klären und abgrenzen',
      'Technischen Ansatz planen',
      'Implementierung umsetzen',
      'Code testen und reviewen',
      'Änderungen dokumentieren',
    ],
  },
  {
    keywords: ['meeting', 'besprechung', 'termin', 'call', 'workshop'],
    suggestions: [
      'Agenda vorbereiten',
      'Teilnehmer einladen und informieren',
      'Unterlagen zusammenstellen',
      'Protokoll während des Meetings führen',
      'Ergebnisse und nächste Schritte festhalten',
    ],
  },
  {
    keywords: ['design', 'ui', 'ux', 'layout', 'mockup', 'wireframe'],
    suggestions: [
      'Anforderungen und Zielgruppe klären',
      'Wireframes oder Skizzen erstellen',
      'Design ausarbeiten',
      'Feedback einholen und einarbeiten',
      'Design-Assets exportieren',
    ],
  },
  {
    keywords: ['recherche', 'analyse', 'vergleich', 'evaluier', 'bewert'],
    suggestions: [
      'Fragestellung und Kriterien definieren',
      'Quellen und Informationen sammeln',
      'Ergebnisse strukturieren und auswerten',
      'Empfehlung formulieren',
      'Ergebnisse präsentieren',
    ],
  },
];

const fallbackSuggestions = [
  'Aufgabe konkretisieren und Ziel definieren',
  'Benötigte Informationen sammeln',
  'Nächste Schritte planen',
  'Umsetzung durchführen',
  'Ergebnis prüfen und abschließen',
];

// lokal, kein Netzwerk
export function suggestSubtasks(title: string): string[] {
  const lower = title.toLowerCase();

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.suggestions;
    }
  }

  return fallbackSuggestions;
}

// Typen für Priorisierung
export interface PriorityInputTask {
  taskId: string;
  title: string;
  description: string;
  deadline: string | null;
  priority: string | null;
  effortEstimate: number | null; // Minuten
  assignedTo: string | null;
  subtaskProgress: string | null; // z.B. "2/5"
}

export interface PrioritySuggestion {
  taskId: string;
  rank: number;
  reason: string;
}

export interface PrioritySuggestionResult {
  suggestions: PrioritySuggestion[];
  source: 'ai' | 'local';
}

// nach Deadline, Priorität und Aufwand sortieren
export function prioritizeTasksLocally(tasks: PriorityInputTask[]): PrioritySuggestion[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  function getScore(task: PriorityInputTask): number {
    let score = 0;

    // Deadline-Score
    if (task.deadline) {
      const dl = new Date(task.deadline);
      const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
      const diffDays = Math.round((dlDay.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) score += 1000;        // überfällig
      else if (diffDays === 0) score += 800;   // heute
      else if (diffDays === 1) score += 600;   // morgen
      else if (diffDays <= 3) score += 400;    // nächste 3 Tage
      else if (diffDays <= 7) score += 200;    // diese Woche
    }

    // Priorität
    if (task.priority === 'high') score += 150;
    else if (task.priority === 'medium') score += 80;
    else if (task.priority === 'low') score += 20;

    // kurze Aufgaben bevorzugen
    if (task.effortEstimate != null) {
      if (task.effortEstimate <= 15) score += 50;
      else if (task.effortEstimate <= 30) score += 30;
      else if (task.effortEstimate <= 60) score += 10;
    }

    // mehr offene Subtasks → weiter oben
    if (task.subtaskProgress) {
      const match = task.subtaskProgress.match(/(\d+)\/(\d+)/);
      if (match) {
        const done = parseInt(match[1], 10);
        const total = parseInt(match[2], 10);
        const remaining = total - done;
        if (remaining > 0) score += remaining * 5;
      }
    }

    return score;
  }

  function getReason(task: PriorityInputTask): string {
    const reasons: string[] = [];

    if (task.deadline) {
      const dl = new Date(task.deadline);
      const dlDay = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate());
      const diffDays = Math.round((dlDay.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) reasons.push('Überfällig');
      else if (diffDays === 0) reasons.push('Heute fällig');
      else if (diffDays === 1) reasons.push('Morgen fällig');
      else if (diffDays <= 7) reasons.push('Diese Woche fällig');
    }

    if (task.priority === 'high') reasons.push('Hohe Priorität');
    else if (task.priority === 'medium') reasons.push('Mittlere Priorität');

    if (task.effortEstimate != null && task.effortEstimate <= 30) {
      reasons.push('Schnell erledigt');
    }

    if (reasons.length === 0) reasons.push('Empfohlen');

    return reasons.join(', ');
  }

  return tasks
    .map((t) => ({ task: t, score: getScore(t) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((item, index) => ({
      taskId: item.task.taskId,
      rank: index + 1,
      reason: getReason(item.task),
    }));
}

// Aufgaben nach Dringlichkeit sortieren, Gemini wenn API-Key vorhanden
export async function suggestTaskPriority(
  tasks: PriorityInputTask[],
): Promise<PrioritySuggestionResult> {
  if (tasks.length === 0) {
    return { suggestions: [], source: 'local' };
  }

  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'HIER_EINTRAGEN') {
    return { suggestions: prioritizeTasksLocally(tasks), source: 'local' };
  }

  const limited = tasks.slice(0, 10);

  const taskList = limited.map((t, i) => {
    const parts = [`${i + 1}. "${t.title}"`];
    if (t.deadline) parts.push(`Deadline: ${t.deadline}`);
    if (t.priority) parts.push(`Priorität: ${t.priority}`);
    if (t.effortEstimate) parts.push(`Aufwand: ${t.effortEstimate} Min`);
    if (t.assignedTo) parts.push(`Zugewiesen: ${t.assignedTo}`);
    if (t.subtaskProgress) parts.push(`Subtasks: ${t.subtaskProgress}`);
    if (t.description) parts.push(`Beschreibung: ${t.description}`);
    return parts.join(' | ');
  }).join('\n');

  const taskIds = limited.map((t) => t.taskId);

  const body = {
    contents: [
      {
        parts: [
          {
            text: `Du bist ein Aufgabenplaner. Sortiere diese offenen Aufgaben nach empfohlener Bearbeitungsreihenfolge. Berücksichtige Deadlines, Priorität und Aufwand. Antworte als JSON-Array mit Objekten: {"taskId": string, "rank": number, "reason": string}. Verwende die exakten taskIds aus der Liste. Begründungen auf Deutsch, max 50 Zeichen. Keine Erklärung, kein Markdown, nur das JSON-Array.\n\nTaskIds: ${JSON.stringify(taskIds)}\n\nAufgaben:\n${taskList}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.5,
      maxOutputTokens: 800,
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT);

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { suggestions: prioritizeTasksLocally(tasks), source: 'local' };
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Gemini kann Markdown drumherum schreiben
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { suggestions: prioritizeTasksLocally(tasks), source: 'local' };
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { suggestions: prioritizeTasksLocally(tasks), source: 'local' };
    }

    // nur gültige taskIds durchlassen
    const validTaskIds = new Set(taskIds);
    const validated: PrioritySuggestion[] = parsed
      .filter((item): item is { taskId: string; rank: number; reason: string } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).taskId === 'string' &&
        validTaskIds.has((item as Record<string, unknown>).taskId as string) &&
        typeof (item as Record<string, unknown>).rank === 'number' &&
        typeof (item as Record<string, unknown>).reason === 'string',
      )
      .map((item, index) => ({
        taskId: item.taskId,
        rank: index + 1,
        reason: item.reason.length > 80 ? item.reason.slice(0, 80) : item.reason,
      }));

    if (validated.length === 0) {
      return { suggestions: prioritizeTasksLocally(tasks), source: 'local' };
    }

    return { suggestions: validated, source: 'ai' };
  } catch {
    return { suggestions: prioritizeTasksLocally(tasks), source: 'local' };
  }
}

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT = 8000;

// Unteraufgaben vorschlagen, Gemini wenn verfügbar
export async function suggestSubtasksAI(
  title: string,
  description?: string,
): Promise<{ suggestions: string[]; source: 'ai' | 'local' }> {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;

  if (!apiKey || apiKey === 'HIER_EINTRAGEN') {
    return { suggestions: suggestSubtasks(title), source: 'local' };
  }

  const taskText = description?.trim()
    ? `Aufgabe: ${title}\nBeschreibung: ${description.trim()}`
    : `Aufgabe: ${title}`;

  const body = {
    contents: [
      {
        parts: [
          {
            text: `Du bist ein Aufgabenplaner für eine Team-App. Gegeben ist eine Aufgabe. Schlage genau 5 konkrete Unteraufgaben vor. Antworte ausschließlich als JSON-Array mit genau 5 kurzen deutschen Strings. Keine Erklärung, kein Markdown, nur das JSON-Array.\n\n${taskText}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
    },
  };

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), GEMINI_TIMEOUT);

    const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return { suggestions: suggestSubtasks(title), source: 'local' };
    }

    const data = await response.json();
    const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { suggestions: suggestSubtasks(title), source: 'local' };
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { suggestions: suggestSubtasks(title), source: 'local' };
    }

    // validieren
    const validated = parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      .map((s) => (s.length > 200 ? s.slice(0, 200) : s))
      .slice(0, 10);

    if (validated.length === 0) {
      return { suggestions: suggestSubtasks(title), source: 'local' };
    }

    return { suggestions: validated, source: 'ai' };
  } catch {
    return { suggestions: suggestSubtasks(title), source: 'local' };
  }
}
