# TaskTogether – Dokumentation

Autoren: Andrea Siligato und David Reis
Modul: Verteilte Programmierung
Entwicklungszeitraum: 2025/2026

## 1. Grundidee

TaskTogether ist ein gemeinsamer Aufgabenplaner für kleine Gruppen (z. B. Lerngruppen
oder WGs). Statt Aufgaben über Chats oder Zettel zu verteilen, legt man eine Gruppe an,
teilt einen Beitrittscode und sieht danach in Echtzeit, wer woran arbeitet. Die App läuft
als Expo/React-Native-App auf dem Smartphone, alle Daten liegen aber nicht lokal,
sondern in Firebase Firestore. Jedes Gerät, das derselben Gruppe beitritt, sieht
Änderungen anderer Geräte sofort, ohne manuell zu aktualisieren – das war für uns der
naheliegendste Weg, das Thema "verteiltes System" konkret und nicht nur theoretisch zu
zeigen.

Wir haben uns für diese Idee entschieden, weil wir selbst genau dieses Problem im
Studienalltag haben (Gruppenarbeiten, wer macht was bis wann) und weil sich daran gut
zeigen lässt, wie mehrere Clients über ein Backend synchron gehalten werden.

## 2. Verwendete Technologien

- **Frontend**: React Native mit Expo (SDK 54) und Expo Router für die Navigation
  zwischen den Screens. TypeScript durchgehend für Typsicherheit.
- **Backend / Datenhaltung**: Firebase Firestore als Cloud-Datenbank. Kein eigener
  Server – Firestore wird direkt aus der App über das Firebase JS SDK angesprochen.
- **Lokaler Speicher**: AsyncStorage nur für eine geräteseitige User-ID (siehe
  Abschnitt 4), nicht für die eigentlichen Daten.
- **KI-Komponente**: Google Gemini API (`gemini-2.5-flash-lite`) für KI-gestützte
  Vorschläge, direkt per HTTP-Request aus der App aufgerufen.

Begründung der Wahl: Wir hatten beide noch keine Erfahrung mit React Native, wollten
sie aber lernen, weil sie für spätere (auch berufliche) Projekte relevant ist. Firebase
haben wir gewählt, weil man damit ohne eigenen Server sofort eine echte
Cloud-Datenbank mit Realtime-Updates bekommt – für ein Uni-Projekt im gegebenen
Zeitrahmen war das deutlich realistischer als ein selbstgehostetes Backend mit
WebSockets aufzusetzen.

## 3. Verteilte Komponenten

Das System besteht aus drei Teilen, die über das Netzwerk miteinander reden:

1. **Mobile App (Client)** – läuft auf beliebig vielen Smartphones/Tablets
   gleichzeitig. Jede Instanz ist ein eigener Firestore-Client.
2. **Firebase Firestore (Backend)** – zentrale Datenhaltung für Nutzer, Gruppen und
   Aufgaben. Übernimmt auch die Echtzeit-Verteilung der Änderungen an alle
   verbundenen Clients.
3. **Gemini API (externer KI-Dienst)** – wird bei Bedarf direkt vom Client
   angesprochen, um Vorschläge zu Unteraufgaben und zur Priorisierung zu generieren.

Damit sind tatsächlich mehrere unabhängige Geräte beteiligt: Erstellt eine Person auf
ihrem Handy eine Aufgabe, taucht sie ohne Aktion der anderen Person auf deren Gerät
auf, sobald diese die App geöffnet hat. Das haben wir im Test mit zwei Smartphones
gegenseitig ausprobiert.

## 4. Datenfluss zwischen den Komponenten

Beim ersten Start erzeugt die App lokal über AsyncStorage eine zufällige Geräte-ID
(`storage.ts`). Es gibt bewusst kein echtes Login mit Passwort – das wäre für den
Scope des Projekts übertrieben gewesen. Stattdessen ordnet man sich beim Onboarding
einen Anzeigenamen und ein Emoji zu, das Profil landet als Dokument in der
`users`-Collection in Firestore.

Danach folgt der Gruppen-Flow (`group-service.ts`): Eine Gruppe wird mit einem
6-stelligen Join-Code angelegt; andere Geräte geben diesen Code ein und werden per
`arrayUnion` der Mitgliederliste der Gruppe hinzugefügt. Ab diesem Punkt ist das
Gerät "in der Gruppe" und sieht nur noch Aufgaben mit der passenden `groupId`.

Aufgaben selbst laufen über `task-service.ts`. Jede Aufgabe ist ein Dokument in der
`tasks`-Collection mit Titel, Beschreibung, Priorität, Deadline, Zuweisung,
Unteraufgaben (als eingebettetes Array) usw. Statt Daten per Knopfdruck zu laden,
abonniert jeder Screen die relevante Query über `onSnapshot`. Ändert irgendein Client
ein Dokument (z. B. Aufgabe abhaken), pusht Firestore das Update an alle anderen
geöffneten Apps – das ist der Kern der "Netzwerkkommunikation" in diesem Projekt: kein
Polling, sondern ein dauerhafter Stream vom Server zum Client.

Für die KI-Funktionen geht ein separater, kurzer Request raus: Die App schickt Titel
(und ggf. Beschreibung) einer Aufgabe oder eine Liste offener Aufgaben als Text an die
Gemini API und bekommt strukturierte Vorschläge zurück, die nur in der UI angezeigt
werden – sie verändern nie automatisch die Datenbank.

## 5. Herausforderungen und Lösungen

**Kein Login, aber trotzdem "Multi-User"-Gefühl.** Anfangs war unklar, wie man mehrere
Personen unterscheidet, ohne eine echte Authentifizierung zu bauen, was für das
Projekt zu aufwendig gewesen wäre. Lösung: Jede Geräteinstallation bekommt automatisch
eine UUID, die mit einem selbstgewählten Namen verknüpft wird. Das reicht für die
Demo völlig aus, ist aber klar als Kompromiss gekennzeichnet (kein Passwortschutz,
jeder mit Join-Code kann beitreten).

**Echtzeit-Synchronisation testen.** Es ist schwer zu verifizieren, dass Realtime
wirklich funktioniert, wenn man nur an einem Gerät entwickelt. Wir haben deshalb
parallel auf zwei Handys getestet (Expo Go) und gezielt Szenarien durchgespielt:
Aufgabe auf Gerät A erstellen, abhaken auf Gerät B, Gruppenbeitritt auf Gerät B
während Gerät A offen ist.

**Gemini-Antworten sind nicht immer sauberes JSON.** Die KI liefert manchmal
Markdown-Codeblöcke statt reines JSON, oder Felder, die nicht zu unseren erwarteten
Task-IDs passen. Wir extrahieren daher das JSON-Array per Regex aus der Antwort,
validieren jedes Feld einzeln und verwerfen ungültige Einträge. Schlägt das fehl, das
Backend antwortet nicht innerhalb von 8 Sekunden, oder es ist gar kein API-Key
gesetzt, fällt die App automatisch auf eine lokale, regelbasierte Logik zurück
(Keyword-Matching für Unteraufgaben, ein Scoring-Algorithmus nach Deadline/Priorität/
Aufwand für die Priorisierung). Das heißt: Die App funktioniert komplett auch ohne
KI-Anbindung, die KI ist nur ein Bonus obendrauf.

**API-Key im Client.** Der Gemini-Key wird clientseitig über eine `EXPO_PUBLIC_`
Umgebungsvariable eingebunden, ist also im gebauten App-Bundle technisch auslesbar.
Für ein Uni-Demo-Projekt war uns das bewusst und akzeptabel, für eine echte
Produktivanwendung müsste der Call stattdessen über ein eigenes Backend (z. B. eine
Firebase Cloud Function oder einen n8n-Webhook) laufen, damit der Key nie das Gerät
verlässt.

## 6. KI-/Agenten-Anteil

Wir haben zwei KI-Funktionen eingebaut, beide über die Gemini API:

- **Unteraufgaben-Vorschläge**: Zu einer Aufgabe (Titel + optionale Beschreibung)
  schlägt die KI fünf konkrete Schritte vor, die man mit einem Klick übernehmen kann.
- **Aufgaben-Priorisierung**: Auf Knopfdruck sortiert die KI alle offenen Aufgaben
  einer Gruppe nach empfohlener Bearbeitungsreihenfolge und gibt kurze Begründungen
  (z. B. "Überfällig", "Schnell erledigt").

Beide Funktionen sind reine Vorschläge – die KI greift nie selbständig in die
Datenbank ein, das war uns aus Sicherheitsgründen wichtig (siehe Prompt-Injection-
Risiko in der Aufgabenstellung). Für beide gibt es einen lokalen, regelbasierten
Fallback, der ohne Netzwerk und ohne API-Key läuft, falls Gemini nicht erreichbar ist
oder kein Key hinterlegt wurde. In der UI wird angezeigt, ob ein Vorschlag von der KI
oder vom lokalen Algorithmus stammt.

## 7. Wichtige technische Entscheidungen

- **Firestore statt eigenem Server**: spart Aufwand für Server-Hosting,
  Authentifizierung und API-Design, liefert Realtime-Sync quasi gratis mit.
- **Kein Firebase Auth, sondern Geräte-ID + Join-Code**: bewusste Vereinfachung für
  den Projekt-Scope, klar dokumentiert als Punkt, der für einen echten Einsatz fehlt.
- **Gemini mit Fallback-Pflicht**: jede KI-Funktion muss auch ohne KI funktionieren.
  Das hat uns gezwungen, zuerst eine vernünftige nicht-KI-Lösung zu bauen und die KI
  als Verbesserung obendrauf zu setzen, statt umgekehrt.
- **Expo Router**: vereinfacht die Navigation zwischen den Screens (Onboarding,
  Gruppen-Setup, Tab-Navigation mit Dashboard, Liste, Kalender, Profil, sowie
  Aufgaben-Detailansicht) über dateibasiertes Routing, ohne eine Navigationsbibliothek
  manuell zu konfigurieren.
- **TypeScript überall**: gerade bei Firestore-Dokumenten, die keine feste Struktur
  erzwingen, hat uns das geholfen, Tippfehler in Feldnamen früh zu finden.

Insgesamt zeigt das Projekt für uns gut, wie eine simple App mit einem Cloud-Backend
zu einem echten verteilten System wird, sobald mehrere Geräte gleichzeitig auf
dieselben Daten zugreifen – und wie man eine optionale KI-Komponente so einbaut, dass
sie nützlich, aber nie kritisch für die Kernfunktion ist.
