export type ChangelogEntry = {
  version: string;
  date: string;
  highlights: string[];
  details?: string[];
};

export const changelogEntries: ChangelogEntry[] = [
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
