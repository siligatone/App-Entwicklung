# TaskTogether – Dokumentation

Autoren: Andrea Siligato und David Reis
Modul: Verteilte Programmierung
Entwicklungszeitraum: 2025/2026

## 1. Grundidee

TaskTogether ist ein gemeinsamer Aufgabenplaner für kleine, feste Gruppen – gedacht
für Lerngruppen, WGs oder kleine Projektteams, bei denen sich immer dieselben
zwei bis fünf Personen Aufgaben teilen. Der Auslöser für die Idee war ein ganz
alltägliches Problem aus unserem eigenen Studienalltag: Bei Gruppenarbeiten
landen Zuständigkeiten meist in einem WhatsApp-Chat, gehen dort unter und niemand
weiß mehr verbindlich, wer bis wann was übernommen hat. TaskTogether soll genau
das ersetzen, ohne dabei overengineered zu sein.

Das Grundprinzip: Man öffnet die App, vergibt sich einen Namen und ein Emoji,
gründet eine Gruppe oder tritt einer bestehenden über einen sechsstelligen Code
bei, und sieht ab dann alle Aufgaben der Gruppe in einer gemeinsamen Liste. Legt
jemand eine neue Aufgabe an, weist sie einer Person zu oder hakt sie ab, sehen
alle anderen Gruppenmitglieder diese Änderung in Echtzeit auf ihrem eigenen Gerät
– ohne zu aktualisieren, ohne Pull-to-Refresh. Genau dieser Punkt war für uns der
Kern der Aufgabenstellung: Wir wollten nicht nur "eine App mit einer Datenbank"
bauen, sondern bewusst etwas, an dem man den Unterschied zwischen lokalem und
verteiltem Zustand direkt sehen kann, indem man die App auf zwei Handys parallel
offen hat.

Zusätzlich zur reinen Aufgabenverwaltung bietet die App eine Kalenderansicht für
Deadlines, ein kleines Dashboard mit Fortschrittsübersicht pro Gruppe sowie eine
optionale KI-Unterstützung, die Aufgaben in Unterschritte zerlegt und Vorschläge
zur Bearbeitungsreihenfolge macht (siehe Abschnitt 6).

## 2. Verwendete Technologien

**App-Entwicklung – React Native mit Expo (SDK 54).** Wir haben uns für React
Native entschieden, weil keiner von uns beiden vorher Erfahrung mit nativer
Mobile-Entwicklung (Kotlin/Swift) hatte, React selbst aber aus anderen Kursen
bekannt war – der Umstieg auf React Native war dadurch deutlich flacher als bei
Null anzufangen. Expo nimmt einem zusätzlich den kompletten nativen Build- und
Konfigurations-Kram ab (Gradle, Xcode-Projekte etc.) und erlaubt es, die App per
Expo Go sofort auf dem eigenen Handy zu testen, ohne sie zu signieren oder zu
deployen. Für die Navigation zwischen Screens nutzen wir Expo Router, der
Dateisystem-basiertes Routing bietet: Jede Datei unter `app/` wird automatisch zu
einer Route, ganz ähnlich wie bei Next.js im Web. Die gesamte App ist in
TypeScript geschrieben.

**Backend / Datenhaltung – Firebase Firestore.** Statt einen eigenen Server mit
REST-API zu bauen, haben wir uns für Firestore als verwaltete Cloud-Datenbank
entschieden. Das Firebase JS SDK wird direkt im Client eingebunden und spricht
Firestore über dessen eigenes Protokoll an (kein klassisches REST/JSON über
HTTP, das wir selbst entwerfen müssten). Der Hauptgrund für diese Wahl war
Pragmatismus: Mit Firestore bekommt man Persistenz, Skalierung über mehrere
Geräte und vor allem Realtime-Synchronisation (über `onSnapshot`-Listener) quasi
"out of the box", ohne selbst WebSockets oder Polling zu implementieren. Für den
zeitlichen Rahmen des Moduls war das die realistischere Wahl gegenüber einem
selbstgebauten Node.js/Express-Backend mit eigener Datenbank und eigenem
Realtime-Layer.

**Lokaler Speicher – AsyncStorage.** Wird ausschließlich für eine einzelne,
geräteseitig generierte User-ID verwendet (siehe Abschnitt 4) – nicht für
Aufgaben oder andere fachliche Daten. Diese liegen ausnahmslos in Firestore.

**KI-Komponente – Google Gemini API.** Für die optionale KI-Funktionalität haben
wir uns für Gemini (`gemini-2.5-flash-lite`) entschieden, weil Google AI Studio
einen kostenlosen Einstieg ohne Kreditkarte bietet und damit für ein
Studienprojekt am unkompliziertesten ist. Die App ruft die Gemini-REST-API direkt
per `fetch` auf, es gibt also keine SDK-Abhängigkeit dafür.

Kurz zusammengefasst war unser Leitgedanke bei der Technologiewahl: möglichst
wenig Infrastruktur selbst betreiben (kein eigener Server, kein eigenes
Hosting), aber an den Stellen, an denen es für das Lernziel "verteiltes System"
zählt, bewusst Mechanismen einsetzen, die mehrere Geräte über das Netzwerk
synchron halten.

## 3. Verteilte Komponenten

Das System besteht aus drei eigenständigen, über Netzwerk verbundenen Teilen:

1. **Mobile App (Client).** Läuft beliebig oft parallel – jedes Smartphone oder
   Tablet, auf dem die App installiert ist, ist eine eigenständige Instanz mit
   eigener Verbindung zu Firestore. Es gibt keine Kommunikation direkt zwischen
   den Geräten, jeder Client redet ausschließlich mit dem Backend.
2. **Firebase Firestore (Backend).** Die zentrale, gemeinsame Datenhaltung für
   drei Collections: `users` (Profile), `groups` (Gruppen mit Mitgliederliste
   und Join-Code) und `tasks` (Aufgaben mit Verweis auf ihre `groupId`).
   Firestore übernimmt zusätzlich die Verteilung von Änderungen an alle Clients,
   die auf den jeweiligen Datenbestand "hören".
3. **Gemini API (externer KI-Dienst).** Wird nur bei aktiver Nutzung der
   KI-Funktionen direkt vom Client per HTTPS angesprochen, völlig unabhängig vom
   Firestore-Backend. Es gibt keine Kopplung zwischen den beiden Backends – fällt
   Gemini aus, ist Firestore und damit die Kernfunktion der App davon nicht
   betroffen (siehe Fallback-Logik in Abschnitt 5 und 6).

Damit ist das Mindestkriterium "mehrere Geräte beteiligt" nicht nur theoretisch
erfüllt, sondern lässt sich direkt vorführen: Wir haben während der Entwicklung
durchgehend mit zwei Smartphones parallel getestet (beide über Expo Go mit
demselben Firebase-Projekt verbunden). Erstellt Person A auf ihrem Gerät eine
Aufgabe oder tritt einer Gruppe bei, taucht das bei Person B auf, ohne dass diese
etwas tun muss – die App reagiert allein auf das Firestore-Event.

## 4. Datenfluss zwischen den Komponenten

**Geräteidentifikation und Profil.** Beim allerersten Start prüft die App über
`storage.ts`, ob bereits eine lokale User-ID im AsyncStorage liegt. Ist das nicht
der Fall, wird eine zufällige UUID erzeugt und dauerhaft auf dem Gerät
gespeichert. Es gibt bewusst kein Login mit Passwort oder E-Mail – stattdessen
durchläuft man beim ersten Start das Onboarding, vergibt einen Anzeigenamen und
ein Emoji, und dieses Profil wird über `user-service.ts` als Dokument unter
`users/{userId}` in Firestore angelegt.

**Gruppen-Beitritt.** Danach folgt der Gruppen-Flow (`group-service.ts`): Entweder
erstellt man eine neue Gruppe – dabei generiert die App einen sechsstelligen
Join-Code aus einem auf Verwechslungen reduzierten Zeichensatz (ohne `I`, `O`,
`0`, `1`) und prüft kurz, ob dieser Code bereits vergeben ist – oder man tritt
einer bestehenden Gruppe bei, indem man den Code eines anderen Mitglieds
eingibt. Beim Beitritt wird die eigene `userId` per `arrayUnion` in das
`memberIds`-Array des Gruppendokuments eingetragen, und umgekehrt die `groupId`
auf dem eigenen Nutzerprofil gespeichert. Ab diesem Zeitpunkt filtert die App
alle Aufgabenlisten serverseitig über eine `where("groupId", "==", ...)`-Query,
sodass jedes Gerät ausschließlich die Aufgaben der eigenen Gruppe sieht.

**Aufgaben und Realtime-Sync.** Die eigentliche Kernlogik steckt in
`task-service.ts`. Jede Aufgabe ist ein Firestore-Dokument in der
`tasks`-Collection mit Titel, Beschreibung, Erledigt-Status, Priorität
(`low`/`medium`/`high`), Deadline (als Firestore-`Timestamp`), Labels,
Zeitschätzung in Minuten, einer optionalen Zuweisung an ein Gruppenmitglied
sowie einem eingebetteten Array von Unteraufgaben (`Subtask[]`) mit eigenem
Erledigt-Status. Statt Daten klassisch per `GET`-Request einmalig zu laden,
abonniert jeder relevante Screen (Aufgabenliste, Kalender, Dashboard,
Detailansicht) die passende Firestore-Query über einen `onSnapshot`-Listener.
Sobald irgendein Client – egal welcher – ein Dokument verändert (z. B. eine
Aufgabe abhakt, eine neue Unteraufgabe abhakt oder eine Deadline ändert), erkennt
Firestore serverseitig, welche aktiven Listener von dieser Änderung betroffen
sind, und pusht das aktualisierte Dokument an alle diese Clients. Das ist der
eigentliche Kern der "Netzwerkkommunikation" in diesem Projekt: kein Polling in
festen Intervallen, sondern ein dauerhaft offener Stream vom Server zu jedem
Client, der gerade eine Liste anzeigt.

Beim Erstellen, Abschließen, Wiedereröffnen oder Löschen von Aufgaben (siehe
`createTask`, `completeTask`, `reopenTask`, `deleteTask`) schreibt die App jeweils
nur das betroffene Dokument zurück nach Firestore, inklusive eingebettetem
Snapshot des handelnden Nutzers (`userId`, `displayName`, `emoji`) – so lässt
sich z. B. anzeigen, wer eine Aufgabe erledigt hat, ohne bei jeder Anzeige
zusätzlich das Nutzerprofil separat nachzuladen.

**KI-Anfragen als separater Seitenkanal.** Für die KI-Funktionen geht ein
zusätzlicher, kurzlebiger HTTPS-Request an die Gemini API: Die App baut aus
Titel, optionaler Beschreibung bzw. aus einer Liste offener Aufgaben (Titel,
Deadline, Priorität, Aufwand, Zuweisung, Subtask-Fortschritt) einen Prompt
zusammen, schickt ihn an Gemini und erwartet eine strukturierte JSON-Antwort
zurück. Diese Antwort fließt ausschließlich in die UI – sie wird niemals direkt
nach Firestore zurückgeschrieben, sondern muss vom Nutzer aktiv übernommen
werden (z. B. Klick auf "Vorschlag übernehmen"). Datenfluss und Datenbestand
bleiben damit klar getrennt: Firestore ist die Quelle der Wahrheit, Gemini ist
nur ein optionaler Berater.

## 5. Herausforderungen und Lösungen

**Mehrere Nutzer ohne echtes Login abbilden.** Eine der ersten Designfragen war,
wie man überhaupt mehrere Personen unterscheidet, ohne ein vollständiges
Auth-System mit Passwörtern, Sessions und Account-Wiederherstellung zu bauen –
das hätte den Rahmen des Projekts gesprengt und war auch nicht der Punkt, den wir
zeigen wollten. Unsere Lösung: Jede App-Installation bekommt automatisch eine
zufällige UUID, die lokal über AsyncStorage persistiert wird, und der Nutzer
verknüpft diese UUID einmalig mit einem selbstgewählten Anzeigenamen und Emoji.
Das reicht für die Demo völlig aus, ist aber bewusst als Kompromiss
dokumentiert: Es gibt keinen Passwortschutz, und wer den Join-Code einer Gruppe
kennt, kann ihr beitreten. Für einen echten Produktiveinsatz müsste hier
Firebase Authentication samt richtiger Zugriffskontrolle ergänzt werden.

**Realtime-Verhalten überhaupt testen können.** Auf einem einzelnen
Entwicklungsgerät lässt sich kaum beurteilen, ob die Synchronisation zwischen
mehreren Clients tatsächlich funktioniert. Wir haben deshalb von Anfang an
parallel auf zwei physischen Smartphones über Expo Go getestet und gezielt
Szenarien durchgespielt, die in einer Einzelgeräte-Entwicklung nicht auffallen
würden: eine Aufgabe auf Gerät A anlegen und beobachten, ob sie auf Gerät B
erscheint; eine Aufgabe auf Gerät B abhaken, während sie auf Gerät A gerade
geöffnet ist; einen Gruppenbeitritt auf einem zweiten Gerät durchführen, während
das erste Gerät die Mitgliederliste anzeigt. Dabei sind uns auch kleinere Bugs
aufgefallen, etwa veraltete lokale Zustände in React, die erst durch den
Listener und nicht durch eigene State-Updates aktualisiert wurden – wir haben
deshalb konsequent darauf geachtet, den UI-Zustand möglichst direkt aus dem
Firestore-Snapshot abzuleiten statt ihn parallel manuell zu pflegen.

**Unzuverlässige KI-Antworten.** Gemini liefert nicht immer sauberes JSON zurück
– teilweise wird die Antwort in Markdown-Codeblöcke verpackt, oder einzelne
Felder fehlen bzw. enthalten Aufgaben-IDs, die gar nicht zur ursprünglichen
Anfrage gehören. Wir extrahieren deshalb das JSON-Array gezielt per
regulärem Ausdruck aus dem Antworttext, parsen es defensiv und validieren danach
jedes einzelne Element (korrekter Typ, bekannte `taskId`, sinnvolle Länge der
Begründung) – ungültige Einträge werden verworfen statt die ganze Antwort zu
verwerfen. Schlägt die Anfrage komplett fehl, antwortet der Server nicht
innerhalb von acht Sekunden (hartes Timeout über `AbortController`), liefert
gar kein valides JSON, oder ist erst gar kein API-Key konfiguriert, fällt die
App automatisch und ohne Fehlermeldung auf eine rein lokale, regelbasierte
Logik zurück: Keyword-Matching gegen vordefinierte Themenfelder (z. B.
"Präsentation", "Bug/Fix", "Meeting") für Unteraufgaben-Vorschläge, sowie ein
einfacher Scoring-Algorithmus nach Deadline-Dringlichkeit, Priorität,
Zeitaufwand und offenen Subtasks für die Priorisierung. Damit funktioniert die
Kernfunktion der App auch komplett offline bzw. ohne jede KI-Anbindung – die KI
ist eine Verbesserung obendrauf, kein notwendiger Bestandteil.

**Umgang mit dem API-Key.** Der Gemini-Schlüssel wird über eine
`EXPO_PUBLIC_GEMINI_API_KEY`-Umgebungsvariable eingebunden und landet damit
zwangsläufig im ausgelieferten App-Bundle, ist also technisch auslesbar. Für ein
Studienprojekt mit begrenztem Nutzerkreis war uns dieses Risiko bewusst und
vertretbar; die `.env`-Datei selbst wird nicht versioniert. Für eine echte
Produktivanwendung wäre der richtige Weg, den Gemini-Aufruf hinter ein eigenes
schlankes Backend zu legen (z. B. eine Firebase Cloud Function oder einen
n8n-Webhook), sodass der Schlüssel nie das Gerät verlässt – das haben wir explizit
als bekannte Einschränkung im Code dokumentiert, statt sie zu verschweigen.

**Datenmodellierung ohne festes Schema.** Firestore erzwingt kein Schema, was
beim schnellen Prototyping geholfen hat, aber auch dazu führen kann, dass
Dokumente in der Praxis inkonsistent werden (fehlende Felder, falsche Typen).
Wir haben dem mit durchgängigen TypeScript-Interfaces für jedes Dokument
(`Task`, `Group`, `UserProfile`) entgegengewirkt, die an jeder Schreib- und
Lesestelle verwendet werden – Tippfehler in Feldnamen oder falsch befüllte
optionale Felder sind uns dadurch mehrfach schon beim Kompilieren statt erst zur
Laufzeit aufgefallen.

## 6. KI-/Agenten-Anteil

Wir haben uns für eine begrenzte, klar abgegrenzte KI-Komponente entschieden statt
für einen vollständigen autonomen Agenten – passend zum Hinweis in der
Aufgabenstellung, dass es nicht um möglichst "mächtige KI" geht, sondern um ein
begründetes Verständnis, wie ein externer KI-Dienst sinnvoll angebunden werden
kann. Konkret gibt es zwei Funktionen, beide über die Gemini API:

- **Unteraufgaben-Vorschläge** (`suggestSubtasksAI`): Zu einer Aufgabe schlägt die
  KI anhand von Titel und optionaler Beschreibung genau fünf konkrete,
  umsetzbare Unterschritte vor (z. B. bei "Präsentation vorbereiten": Inhalte
  sammeln, Gliederung erstellen, Folien gestalten, Demo vorbereiten, Vortrag
  üben). Der Nutzer kann jeden Vorschlag einzeln übernehmen.
- **Aufgaben-Priorisierung** (`suggestTaskPriority`): Auf Knopfdruck schickt die
  App alle offenen Aufgaben der aktuellen Gruppe (maximal zehn, um den Prompt
  klein zu halten) an Gemini und bekommt eine empfohlene Bearbeitungsreihenfolge
  mit kurzer Begründung pro Aufgabe zurück (z. B. "Überfällig", "Morgen fällig",
  "Schnell erledigt").

Beide Funktionen sind reine Empfehlungen in der Benutzeroberfläche – die KI hat
keinerlei Schreibzugriff auf Firestore und kann von sich aus weder Aufgaben
anlegen, ändern noch löschen. Das war uns aus den in der Aufgabenstellung
genannten Sicherheitsgründen wichtig: Ein Sprachmodell, das auf Zuruf Daten in der
echten Datenbank verändern könnte, öffnet die Tür für Prompt-Injection-artige
Angriffe (z. B. eine Aufgabenbeschreibung, die versucht, das Modell zu
unerwünschten Aktionen zu verleiten). Indem die KI ausschließlich Text liest und
Text zurückgibt, der erst nach aktiver Bestätigung durch den Nutzer in die
Datenbank übernommen wird, ist dieses Risiko strukturell ausgeschlossen statt nur
durch Prompt-Disziplin "versprochen".

Beide Funktionen besitzen außerdem einen vollständigen lokalen Fallback (siehe
Abschnitt 5), der ohne Netzwerk und ohne API-Key auskommt. In der Oberfläche wird
jeweils sichtbar gemacht, ob ein Vorschlag von der KI (`source: 'ai'`) oder vom
lokalen Algorithmus (`source: 'local'`) stammt, damit für Nutzer (und für die
Bewertung) transparent bleibt, wann tatsächlich ein externer Dienst beteiligt
war.

## 7. Wichtige technische Entscheidungen

- **Firestore statt eigenem Server.** Spart Aufwand für Server-Hosting,
  Authentifizierung und eigenes API-Design und liefert Realtime-Synchronisation
  über mehrere Geräte hinweg praktisch ohne Zusatzaufwand. Der Kompromiss: Wir
  haben weniger Kontrolle über serverseitige Validierung als bei einem eigenen
  Backend, was für ein Demo-Projekt mit überschaubarem Nutzerkreis vertretbar
  ist.
- **Geräte-ID statt Firebase Auth.** Bewusste Vereinfachung für den
  Projekt-Scope. Damit die App trotzdem ein glaubhaftes Multi-User-Gefühl
  vermittelt, wird konsequent zwischen "wer hat etwas erstellt", "wem ist es
  zugewiesen" und "wer hat es erledigt" unterschieden und in jedem Task-Dokument
  als Snapshot mitgespeichert.
- **Gemini mit verpflichtendem Fallback statt KI als Voraussetzung.** Wir haben
  uns bewusst dazu entschieden, jede KI-Funktion zuerst ohne KI funktionsfähig zu
  bauen und Gemini erst danach als Erweiterung obendrauf zu legen. Das hat uns
  gezwungen, von Anfang an über sinnvolle, nachvollziehbare Regeln nachzudenken
  (z. B. den Priorisierungs-Score), statt uns blind auf die KI-Antwort zu
  verlassen – und macht die App unabhängig von Verfügbarkeit, Kosten oder
  Rate-Limits des externen Dienstes.
- **Expo Router für dateibasierte Navigation.** Vereinfacht die Struktur der App
  erheblich: Onboarding, Gruppen-Setup, eine Tab-Navigation mit Aufgabenliste,
  Kalender, Dashboard und Profil, sowie eine dynamische Detailroute
  (`task/[id].tsx`) für einzelne Aufgaben, alles ohne eine
  Navigationsbibliothek manuell konfigurieren zu müssen.
- **Durchgängiges TypeScript.** Gerade weil Firestore selbst kein festes Schema
  erzwingt, haben uns die selbstdefinierten Interfaces in den Service-Dateien
  geholfen, Inkonsistenzen zwischen Schreib- und Lesezugriffen früh beim
  Kompilieren statt erst beim Testen auf dem Gerät zu finden.
- **Eingebettete Snapshots statt Joins.** Statt bei jeder Anzeige zusätzliche
  Lookups gegen die `users`-Collection zu machen, speichern wir kleine
  Nutzer-Snapshots (`userId`, `displayName`, `emoji`) direkt in den
  Task- und Group-Dokumenten. Das ist in einer dokumentenorientierten Datenbank
  wie Firestore der übliche Weg, fehlende Relationen/Joins zu kompensieren, und
  reduziert spürbar die Anzahl nötiger Requests pro Bildschirm.

## 8. Fazit

Für uns zeigt TaskTogether im Kleinen genau das, worum es im Modul ging: Eine an
sich einfache App – eine Aufgabenliste – wird durch eine Cloud-Datenbank mit
Realtime-Listenern zu einem echten verteilten System, sobald mehrere Geräte
gleichzeitig auf denselben Datenbestand zugreifen und Änderungen sich ohne
manuelles Eingreifen verteilen. Gleichzeitig haben wir versucht, eine optionale
KI-Komponente so einzubauen, dass sie nützlich ist, aber nie zur kritischen
Voraussetzung für die Kernfunktion wird, und dass ihre Risiken (unsichere
Antworten, API-Key-Exposition, möglicher Missbrauch) von Anfang an mitgedacht
statt nachträglich gepatcht wurden.
