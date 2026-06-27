/**
 * Aufgaben-Assistent mit zwei Modi:
 *
 * 1. suggestSubtasksAI() — Echte KI-Vorschläge via Gemini API.
 *    Nutzt EXPO_PUBLIC_GEMINI_API_KEY aus .env.
 *    Bei Fehler/Timeout → automatischer Fallback auf regelbasierten Modus.
 *
 * 2. suggestSubtasks() — Lokaler regelbasierter Fallback.
 *    Funktioniert komplett offline via Keyword-Matching.
 *
 * DEMO-HINWEIS:
 * Die Gemini-Integration ist eine Demo-Lösung für ein Uni-Projekt.
 * Der API-Key liegt clientseitig über EXPO_PUBLIC_ und ist NICHT
 * produktionssicher. Für eine echte App müsste der Key in einem
 * sicheren Backend liegen (Firebase Function, n8n Webhook, o.ä.).
 * .env wird nicht committed. Es werden keine vertraulichen Daten
 * an die KI gesendet (nur Aufgabentitel und optionale Beschreibung).
 * KI-Vorschläge erzeugen keine automatischen Datenbankänderungen.
 */

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

/**
 * Schlägt 3–5 Unteraufgaben basierend auf dem Titel vor.
 * Rein lokal, kein Netzwerk, keine externe API.
 */
export function suggestSubtasks(title: string): string[] {
  const lower = title.toLowerCase();

  for (const rule of rules) {
    if (rule.keywords.some((kw) => lower.includes(kw))) {
      return rule.suggestions;
    }
  }

  return fallbackSuggestions;
}

const GEMINI_MODEL = 'gemini-2.5-flash-lite';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const GEMINI_TIMEOUT = 8000;

/**
 * Schlägt Unteraufgaben via Gemini KI vor.
 * Bei Fehler, Timeout oder fehlendem API-Key → Fallback auf regelbasierten Modus.
 * Gibt { suggestions, source } zurück, damit die UI anzeigen kann woher die Vorschläge kommen.
 */
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

    // JSON-Array aus der Antwort extrahieren (Gemini kann Markdown-Wrapper hinzufügen)
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return { suggestions: suggestSubtasks(title), source: 'local' };
    }

    const parsed: unknown = JSON.parse(jsonMatch[0]);

    if (!Array.isArray(parsed) || parsed.length === 0) {
      return { suggestions: suggestSubtasks(title), source: 'local' };
    }

    // Nur gültige Strings akzeptieren, max 200 Zeichen pro Eintrag
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
