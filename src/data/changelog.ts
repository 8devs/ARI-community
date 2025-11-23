export type ChangelogEntry = {
  version: string;
  date: string;
  highlights: string[];
  details?: string[];
};

export const changelogEntries: ChangelogEntry[] = [
  {
    version: "0.6.0",
    date: "22.11.2025",
    highlights: [
      "Neues Modul „Empfang & Aufgaben“ mit To-Dos, Protokoll und Flag „Empfangsperson“",
      "Admins können Lunch-Orte/Bewertungen löschen sowie Community-Gruppen bearbeiten und entfernen",
      "Leaflet-basierte Karte für Lunch-Orte, öffentliche Speisekarten und erweiterte Lunch-Roulette Steuerung",
    ],
    details: [
      "Empfang erhält eigenes Aufgabenboard inkl. Organisations-To-Dos, Meldungen von Mitarbeitenden, Benachrichtigungen und Protokollführung",
      "Neue DB-Tabellen `reception_tasks` + Logs sowie das Profil-Flag `is_receptionist` – Aufgaben triggern E-Mail & In-App-Notifications",
      "Lunch-Orte bieten OpenStreetMap mit Campus-Marker, Admin-Löschfunktionen und öffentlichen Speisekarten dank Storage-Policies",
      "Community-Gruppen lassen sich jetzt bearbeiten, globale Admins gelten als Gruppen-Admins; Lunch-Roulette-Runden können gelöscht werden",
      "Navigation & Texte angepasst („Getränke-Abrechnung“, neuer Empfängereintrag), Version und Datum aktualisiert",
    ],
  },
  {
    version: "0.4.1",
    date: "14.11.2025",
    highlights: [
      "Überarbeitetes Admin-Dashboard mit größerer Navigation und besserer Responsivität",
      "Gruppenansicht mit stabilen Chats und Mitglieder-Tab ohne überlagerte Eingabefelder",
    ],
    details: [
      "Admin-Menü erhält scrollbare Sidebar, großzügige Abstände und optimierte Darstellung auf schmalen Screens",
      "Chat-Eingabebereich der Gruppen bleibt sichtbar, zusätzliche Puffer verhindern Überlappungen",
      "Versionierung & Changelog aktualisiert, damit die sichtbare App-Version mit dem Release übereinstimmt",
    ],
  },
  {
    version: "0.4.0",
    date: "13.11.2025",
    highlights: [
      "Push- & E-Mail-Benachrichtigungen für neue Pinnwand- und Q&A-Einträge",
      "Community-Gruppen mit Chat, Beitritt und organisationsübergreifenden Unterhaltungen",
    ],
    details: [
      "Pinnwand-Beiträge lassen sich organisationsintern begrenzen, Admins erhalten automatische Alerts",
      "Neue /gruppen-Seite inkl. Gruppenerstellung, Mitgliedschaften und Nachrichtenverlauf",
    ],
  },
  {
    version: "0.3.0",
    date: "13.11.2025",
    highlights: [
      "Neues Benachrichtigungscenter mit Historie, Filtern und Löschfunktionen",
      "Versionierung und öffentliches Changelog sichtbar in der App",
    ],
    details: [
      "Einstellbares Notification-Limit, Realtime-Updates für Lesen/Löschen",
      "Kontextlinks in der Navigation inkl. direktem Zugriff über Profilmenü",
    ],
  },
  {
    version: "0.2.0",
    date: "12.11.2025",
    highlights: [
      "Überarbeitung aller Supabase-Mail-Templates inkl. Table-Layout für Clients",
      "Eigenes SMTP-Relay & Vercel-Endpunkt zur vollständigen Kontrolle des Versands",
    ],
    details: [
      "Favicon-Dynamik + Branding-Pipeline, damit Logo in App & E-Mails konsistent ist",
      "Fixes für Admin-Menüs, Responsive-Verhalten und globale Navigation",
    ],
  },
  {
    version: "0.1.0",
    date: "10.11.2025",
    highlights: [
      "Erste produktive Version mit Dashboard, Nachrichten, Kaffee- & Lunch-Modulen",
      "Supabase Auth, Organisationsverwaltung und Rollenmodell",
    ],
  },
];
