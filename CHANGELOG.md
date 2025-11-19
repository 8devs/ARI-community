# Changelog

Alle relevanten Änderungen der ARI Community App. Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/) und setzt [SemVer](https://semver.org/lang/de/) ein.

## [0.5.1] - 2025-11-19
### Neu
- Dashboard-Hero fasst die neuesten Pinnwand-Beiträge zusammen und zeigt sie dauerhaft oben auf der Übersichtsseite.
- Pinnwand-Dialog enthält nun eine Option, ob beim Veröffentlichen Mitarbeitende benachrichtigt werden sollen.

### Geändert
- Hauptnavigation sitzt jetzt in einer permanent sichtbaren Sidebar inklusive Branding, wodurch das Logo nicht mehr überlagert wird und das Menü nicht umbrechen kann.
- Der mobile Drawer übernimmt die neue Struktur samt Theme-Schalter und Versionshinweis.

## [0.5.0] - 2025-11-19
### Neu
- Dashboard: Kompakte Profilkarte mit Statuschips sowie direkt verlinkte Who-is-Who-Kacheln.
- Räume: Neue Schnellbuchung im Zeitstrahl, Dropdown-Raumauswahl im Kalender und modernisierte Detailkarte inklusive Bearbeiten-Abkürzung.

### Geändert
- Navigationslogo bleibt während Routenwechseln sichtbar.
- Buttons für „Raum buchen“ und „Raum anlegen“ wurden neu priorisiert; mobile Raumwahl bietet nun eine klare Trennung zwischen Schnell- und Erweiterter Suche.

## [0.4.1] - 2025-11-13
### Geändert
- Dashboard-Kachel für den eigenen Account wurde verkleinert und das Who-is-Who verlinkt jetzt direkt auf die entsprechenden Profile.
- Das Navigationslogo bleibt während Tabwechseln sichtbar.
- Die Räume-Ansicht erhielt ein Dropdown zur Raumwahl im Kalender, eine Schnellbuchung im Zeitstrahl, neue Aktionsschwerpunkte und eine modernisierte Detailkarte inklusive Bearbeiten-Shortcut.

## [0.4.0] - 2025-11-13
### Neu
- Push- und E-Mail-Benachrichtigungen für neue Pinnwand- und Q&A-Beiträge.
- Community-Gruppen mit Beitritt, Chat und organisationsübergreifender Nutzung.

### Geändert
- Pinnwand „Organisationsintern“-Modus strenger umgesetzt, Navigation zeigt direkten Zugang.
- Q&A-Workflow informiert Admins automatisch über neue Fragen.

## [0.3.0] - 2025-11-13
### Neu
- Benachrichtigungscenter mit Filter, Historie, "Mehr laden" und Massenlöschung.
- Versionierung direkt im UI plus öffentliche `/changelog`-Seite.

### Geändert
- Notifications-Hook reagiert auf INSERT/UPDATE/DELETE und limitiert Einträge konfigurierbar.
- Navigationsmenü zeigt aktive Tabs, Glocke verlinkt ins Center.

## [0.2.0] - 2025-11-12
### Neu
- HTML-E-Mail-Templates komplett überarbeitet (Table-Layout, Responsive Styles).
- Eigenes SMTP-Relay + Vercel-API-Endpunkt zur Nutzung eines eigenen Mailservers.

### Geändert
- Branding/Logo-Pipeline aktualisiert, Favicon wird dynamisch gesetzt.
- Admin-Menü und Navigation responsiv korrigiert.

## [0.1.0] - 2025-11-10
### Neu
- Erste produktive Version mit Dashboard, Nachrichten, Kaffee-, Räume- und Lunch-Roulette-Modulen.
- Supabase Auth, Organisations- & Rollenmanagement sowie Einladungsflow.
