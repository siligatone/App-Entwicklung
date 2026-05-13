# Projektplanung: StudyTask – Gemeinsamer Aufgabenplaner für Studierende

## 1. Projektidee

**Titel:** StudyTask – Gemeinsamer Aufgabenplaner für Studierende

**Kurzbeschreibung:**  
StudyTask ist eine mobile App, in der Nutzer gemeinsame Aufgaben erstellen, bearbeiten, priorisieren, abhaken und Personen zuweisen können. Die Daten werden in einem Backend gespeichert und zwischen mehreren Geräten synchronisiert.

Die App soll als verteiltes System umgesetzt werden, da mehrere mobile Geräte über ein Netzwerk mit einem zentralen Backend kommunizieren. Aufgaben werden nicht nur lokal gespeichert, sondern über Firebase Firestore zentral abgelegt und in Echtzeit auf mehreren Geräten aktualisiert.

## 2. Empfohlener Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Flutter |
| Backend / Datenbank | Firebase Firestore |
| Login | Firebase Authentication oder vereinfachter Gruppenbeitritt |
| KI-Bonus | Gemini API, OpenAI API oder n8n-Webhook |
| Zielplattform | Android-Smartphone oder Android-Emulator |

## 3. Phase 1: Projektdefinition und Anforderungsanalyse

### Ziel

Festlegen, was die App genau können soll und welche Funktionen für die Abgabe wirklich notwendig sind.

### Aufgaben

- Projektname und Grundidee festlegen
- Zielgruppe definieren: Studierende, Lerngruppen oder Projektgruppen
- Mindestfunktionen bestimmen
- Erweiterungsfunktionen priorisieren
- Datenfluss grob skizzieren
- Rollen im Zweierteam verteilen

### Ergebnis dieser Phase

Die App ermöglicht es mehreren Nutzern, gemeinsame Aufgaben in einer Gruppe zu verwalten. Aufgaben werden zentral in Firebase gespeichert und auf mehreren Geräten synchronisiert.

### Mindestumfang für das MVP

- Aufgaben anzeigen
- Aufgabe erstellen
- Aufgabe bearbeiten
- Aufgabe löschen
- Aufgabe als erledigt markieren
- Fälligkeitsdatum setzen
- Priorität setzen
- Daten in Firebase speichern
- Änderungen auf zweitem Gerät sichtbar machen

## 4. Phase 2: Architekturplanung

### Ziel

Die technische Struktur der App planen, bevor programmiert wird.

### Geplante Architektur

```text
Smartphone A
   |
   | Aufgabe erstellen / bearbeiten
   v
Flutter App
   |
   | Netzwerkkommunikation
   v
Firebase Firestore
   |
   | Echtzeit-Synchronisation
   v
Flutter App
   |
   v
Smartphone B
```

### Komponenten

| Komponente | Aufgabe |
|---|---|
| Flutter App | Benutzeroberfläche und App-Logik |
| Firebase Firestore | zentrale Cloud-Datenbank |
| Firebase Auth | Nutzerverwaltung, optional |
| Firebase Rules | Zugriffsschutz |
| KI-Dienst / n8n | optionale Priorisierung oder Zusammenfassung |

### Datenfluss-Beispiel

1. Nutzer A erstellt eine Aufgabe.
2. Die Flutter-App sendet die Aufgabe an Firestore.
3. Firestore speichert die Aufgabe zentral.
4. Nutzer B sieht die neue Aufgabe auf seinem Gerät.
5. Wenn Nutzer B die Aufgabe abhakt, wird die Änderung wieder synchronisiert.

## 5. Phase 3: Datenmodell entwerfen

### Ziel

Festlegen, welche Daten gespeichert werden.

### Einfache Collection-Struktur in Firebase

```text
tasks
  taskId
    title
    description
    dueDate
    priority
    done
    assignedTo
    createdAt
```

### Erweiterte Collection-Struktur

```text
users
  userId
    name
    email

groups
  groupId
    name
    createdAt
    members

tasks
  taskId
    title
    description
    dueDate
    priority
    status
    assignedTo
    groupId
    createdBy
    createdAt
    updatedAt
```

### Beispiel für ein Task-Objekt

```json
{
  "title": "Präsentation vorbereiten",
  "description": "Folien für Verteilte Programmierung erstellen",
  "dueDate": "2026-06-20",
  "priority": "hoch",
  "done": false,
  "assignedTo": "David",
  "createdAt": "2026-05-13"
}
```

### Wichtige Felder

| Feld | Zweck |
|---|---|
| title | Name der Aufgabe |
| description | genauere Beschreibung |
| dueDate | Fälligkeitsdatum |
| priority | niedrig, mittel, hoch |
| done | erledigt oder offen |
| assignedTo | zuständige Person |
| groupId | Zuordnung zu einer Gruppe |
| createdAt | Sortierung und Nachvollziehbarkeit |

## 6. Phase 4: UI- und Screen-Planung

### Ziel

Die App-Oberfläche sinnvoll strukturieren.

### Screen 1: Login oder Gruppenbeitritt

**Funktion:**

- Nutzer gibt Namen ein
- optional Login per Firebase Auth
- Nutzer tritt einer Gruppe bei
- alternativ feste Demo-Gruppe verwenden

Einfacher Ablauf:

```text
Name eingeben -> Gruppe betreten -> Aufgaben anzeigen
```

### Screen 2: Aufgabenübersicht

**Funktion:**

- Liste aller Aufgaben anzeigen
- offene und erledigte Aufgaben unterscheiden
- Priorität anzeigen
- Fälligkeitsdatum anzeigen
- Aufgabe abhaken
- Button zum Erstellen neuer Aufgaben

Beispielanzeige:

```text
[hoch] Präsentation vorbereiten     fällig: 20.06.2026
[mittel] Dokumentation schreiben    fällig: 30.06.2026
[niedrig] App-Icon erstellen        fällig: 02.07.2026
```

### Screen 3: Aufgabe erstellen

**Funktion:**

- Titel eingeben
- Beschreibung eingeben
- Priorität wählen
- Fälligkeitsdatum wählen
- Person zuweisen
- Speichern in Firebase

### Screen 4: Aufgabendetails

**Funktion:**

- alle Details einer Aufgabe anzeigen
- Aufgabe bearbeiten
- Aufgabe löschen
- Status ändern
- optional Kommentare anzeigen

### Screen 5: Statistik oder KI-Zusammenfassung

Optional, aber gut für zusätzliche Tiefe:

- Anzahl offener Aufgaben
- Anzahl erledigter Aufgaben
- nächste Deadlines
- KI-Zusammenfassung der Woche

## 7. Phase 5: Backend-Integration mit Firebase

### Ziel

Die App soll nicht nur lokal funktionieren, sondern Daten über das Netzwerk speichern und abrufen.

### Aufgaben

- Firebase-Projekt erstellen
- Firestore-Datenbank anlegen
- Flutter-Projekt mit Firebase verbinden
- Testdatensatz in Firestore erstellen
- Aufgaben aus Firestore in der App anzeigen
- neue Aufgaben aus der App in Firestore speichern
- bestehende Aufgaben aktualisieren
- Aufgaben löschen

### Aufgabe erstellen

```text
Nutzer füllt Formular aus
-> App erzeugt Task-Objekt
-> Task wird an Firestore gesendet
-> Firestore speichert Task
-> Aufgabenliste aktualisiert sich
```

### Aufgabe abrufen

```text
App startet
-> Verbindung zu Firestore
-> Aufgaben werden geladen
-> Aufgaben erscheinen in der Liste
```

### Aufgabe aktualisieren

```text
Nutzer hakt Aufgabe ab
-> Status done wird auf true gesetzt
-> Firestore aktualisiert Datensatz
-> andere Geräte sehen Änderung
```

## 8. Phase 6: Realtime-Synchronisation und Mehrgeräte-Demo

### Ziel

Zeigen, dass mehrere Geräte beteiligt sein können.

Firestore bietet sogenannte Realtime Streams. Die App hört dauerhaft auf Änderungen in der Datenbank.

```text
Gerät A ändert Aufgabe
-> Firestore erkennt Änderung
-> Gerät B bekommt Änderung automatisch
-> UI auf Gerät B aktualisiert sich
```

### Demo-Szenario

1. App auf zwei Geräten oder Emulatoren öffnen.
2. Gerät A erstellt eine neue Aufgabe.
3. Gerät B zeigt die Aufgabe automatisch an.
4. Gerät B markiert die Aufgabe als erledigt.
5. Gerät A sieht den geänderten Status.

## 9. Phase 7: Kernfunktionen fertigstellen

### Ziel

Die App soll als vollständiger Aufgabenplaner nutzbar sein.

### Priorisierte Funktionen

| Priorität | Funktion | Muss/Kann |
|---|---|---|
| 1 | Aufgaben anzeigen | Muss |
| 1 | Aufgaben erstellen | Muss |
| 1 | Aufgaben abhaken | Muss |
| 1 | Firestore-Speicherung | Muss |
| 1 | Synchronisation zwischen Geräten | Muss |
| 2 | Aufgaben bearbeiten | Sollte |
| 2 | Aufgaben löschen | Sollte |
| 2 | Fälligkeitsdatum | Sollte |
| 2 | Priorität | Sollte |
| 3 | Personenzuweisung | Kann |
| 3 | Filter | Kann |
| 3 | Statistik | Kann |
| 4 | KI-Zusammenfassung | Bonus |

### Sinnvolle Filter

- Alle Aufgaben
- Meine Aufgaben
- Offen
- Erledigt
- Heute fällig
- Diese Woche fällig
- Hohe Priorität

## 10. Phase 8: Optionaler KI- oder Agenten-Anteil

### Ziel

Eine kleine intelligente Funktion einbauen, ohne das Projekt zu überladen.

### Einfachste KI-Funktion

```text
"Fasse meine offenen Aufgaben für diese Woche zusammen."
```

### Beispiel

Die App sendet offene Aufgaben an einen KI-Dienst:

```json
[
  {
    "title": "Präsentation vorbereiten",
    "dueDate": "2026-06-20",
    "priority": "hoch"
  },
  {
    "title": "Doku schreiben",
    "dueDate": "2026-06-30",
    "priority": "mittel"
  }
]
```

Der KI-Dienst gibt eine Empfehlung zurück:

```text
Diese Woche solltest du dich zuerst auf die Präsentation konzentrieren,
weil sie die höchste Priorität hat. Danach solltest du mit der Dokumentation beginnen.
```

### Alternative ohne echte KI: regelbasierter Agent

Beispielregeln:

```text
Wenn Aufgabe morgen fällig und nicht erledigt -> Priorität hoch
Wenn Aufgabe überfällig -> Warnung anzeigen
Wenn viele offene Aufgaben vorhanden -> Hinweis anzeigen
```

### Empfehlung

Zuerst die App vollständig bauen. Danach als Bonus entweder:

1. regelbasierte Priorisierung, falls wenig Zeit bleibt
2. KI-Zusammenfassung, falls die Grundfunktionen stabil laufen

## 11. Phase 9: Sicherheit, Datenschutz und Fehlerbehandlung

### Ziel

Die App soll nicht nur funktionieren, sondern auch reflektiert und sauber umgesetzt sein.

### API-Keys

API-Keys sollten nicht ungeschützt in einem öffentlichen Repository liegen.

Mögliche Formulierung für die Dokumentation:

```text
API-Keys werden nicht öffentlich dokumentiert. Für eine produktive Nutzung müssten sie über Umgebungsvariablen oder serverseitige Funktionen geschützt werden.
```

### Zugriffsschutz

Bei Firestore sollten Sicherheitsregeln definiert werden.

Einfache Demo-Regel:

```text
Nur angemeldete Nutzer dürfen Aufgaben lesen und schreiben.
```

Oder bei einer vereinfachten Demo:

```text
Der Zugriff ist für die Demonstration offen, müsste in einer produktiven Version aber über Authentifizierung und Gruppenrechte eingeschränkt werden.
```

### Datenschutz

- Es werden keine sensiblen personenbezogenen Daten gespeichert.
- Aufgaben enthalten nur Titel, Beschreibung, Status, Fälligkeit und Zuständigkeit.
- In einer echten Version müssten Löschkonzept und Rechteverwaltung ergänzt werden.

### Fehlerbehandlung

Beispiele:

- keine Internetverbindung
- Firebase nicht erreichbar
- leeres Eingabefeld
- ungültiges Datum
- Aufgabe konnte nicht gespeichert werden

## 12. Phase 10: Testing und Fehlerkorrektur

### Ziel

Die App stabil machen und die Präsentation absichern.

### Testfälle

| Testfall | Erwartetes Ergebnis |
|---|---|
| Aufgabe erstellen | Aufgabe erscheint in Liste |
| Aufgabe abhaken | Status ändert sich |
| Aufgabe löschen | Aufgabe verschwindet |
| App auf zwei Geräten öffnen | beide sehen gleiche Daten |
| Gerät A erstellt Aufgabe | Gerät B sieht neue Aufgabe |
| Pflichtfeld leer | Fehlermeldung erscheint |
| keine Internetverbindung | Hinweis erscheint |
| Aufgabe mit hoher Priorität | wird korrekt angezeigt |
| Filter „offen“ | nur offene Aufgaben erscheinen |

Besonders wichtig ist der frühe Test der Mehrgeräte-Demo, da sie für die Bewertung sehr relevant ist.

## 13. Phase 11: Dokumentation

### Ziel

Die Dokumentation soll kurz, aber strukturiert sein.

### Empfohlene Gliederung

1. Grundidee der Anwendung
2. Verwendete Technologien
3. Verteilte Komponenten
4. Datenfluss zwischen den Komponenten
5. Herausforderungen und Lösungen
6. Optionaler KI- oder Agenten-Anteil
7. Wichtige technische Entscheidungen

### Beispieltext zur Grundidee

```text
StudyTask ist ein gemeinsamer Aufgabenplaner für Studierende. Mehrere Nutzer können Aufgaben erstellen, bearbeiten und erledigen. Die Daten werden zentral in Firebase gespeichert und zwischen mehreren Geräten synchronisiert.
```

### Beispieltext zur Technologiewahl

```text
Flutter eignet sich für mobile Apps, Firebase reduziert den Backend-Aufwand und bietet direkte Cloud-Speicherung sowie Echtzeit-Synchronisation.
```

## 14. Phase 12: Präsentationsvorbereitung

### Ziel

Eine kurze, überzeugende Demo vorbereiten.

### Präsentationsablauf

1. Problem erklären  
   In Gruppenprojekten ist oft unklar, wer welche Aufgabe bis wann erledigt.

2. Lösung vorstellen  
   Die App ermöglicht gemeinsame Aufgabenplanung auf mehreren Geräten.

3. Architektur zeigen  
   Mobile App -> Firebase -> anderes Gerät

4. Live-Demo durchführen  
   - Aufgabe auf Gerät A erstellen
   - Aufgabe erscheint auf Gerät B
   - Aufgabe auf Gerät B abhaken
   - Änderung erscheint auf Gerät A

5. Code- und Technikteil erklären  
   - Firestore-Datenmodell
   - Realtime Stream
   - Create-, Update- und Delete-Funktionen
   - optional KI- oder Agentenfunktion

6. Herausforderungen nennen  
   - Synchronisation
   - Datenmodell
   - Fehlerbehandlung
   - Sicherheit

7. Fazit  
   Die App erfüllt die Anforderungen an ein verteiltes mobiles System.

## 15. Grober Zeitplan bis zur Abgabe

| Zeitraum | Phase | Ergebnis |
|---|---|---|
| Woche 1 | Planung und Architektur | Konzept, Datenmodell, Screens |
| Woche 2 | Flutter/Firebase Setup | Projekt läuft, Firebase verbunden |
| Woche 3 | Aufgaben anzeigen und erstellen | erste nutzbare Version |
| Woche 4 | Bearbeiten, löschen, erledigen | vollständige CRUD-Funktionen |
| Woche 5 | Realtime-Synchronisation und Mehrgeräte-Test | verteilter Kern funktioniert |
| Woche 6 | Filter, Prioritäten, Zuweisungen | fachliche Erweiterung |
| Woche 7 | KI-/Agentenfunktion oder Statistik | Bonusfunktion |
| Woche 8 | Testing, Doku, Präsentation | abgabefertiges Projekt |

## 16. Empfohlene Arbeitsteilung im Zweierteam

### Person A: Frontend/App

- Flutter-Projektstruktur
- Screens
- Navigation
- Formulare
- UI-Komponenten
- Filter und Anzeige

### Person B: Backend/Logik

- Firebase-Projekt
- Firestore-Struktur
- Datenzugriff
- Realtime-Streams
- Sicherheitsregeln
- KI-/Agentenfunktion

## 17. Realistische MVP-Version

Diese Version sollte auf jeden Fall umgesetzt werden:

```text
1. Aufgabenübersicht
2. Aufgabe erstellen
3. Aufgabe abhaken
4. Aufgabe löschen
5. Fälligkeitsdatum und Priorität
6. Speicherung in Firebase
7. Synchronisation zwischen zwei Geräten
```

## 18. Erweiterte Version

Wenn noch Zeit bleibt:

```text
1. Login
2. Gruppenfunktion
3. Personenzuweisung
4. Filter und Sortierung
5. Kommentarbereich
6. Statistikseite
7. KI-Zusammenfassung
```

## 19. Finale Projektformulierung

**StudyTask ist eine mobile Aufgabenplaner-App für Studierende, mit der mehrere Nutzer gemeinsame Aufgaben verwalten können. Die App nutzt Firebase Firestore als Cloud-Backend, um Aufgaben zentral zu speichern und in Echtzeit auf mehreren Geräten zu synchronisieren. Optional unterstützt ein Agent die Nutzer durch Priorisierung oder Zusammenfassung offener Aufgaben.**
