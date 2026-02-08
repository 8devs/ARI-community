# ARI Community App

Community-App fuer den Adenhauerring in Worms. Vollstaendig self-hosted mit Docker.

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS + shadcn/ui |
| Backend | Express 5 + Prisma ORM + PostgreSQL 18 + Socket.io |
| Auth | JWT + bcrypt (Session-Cookies) |
| Deployment | Docker Compose |

---

## Docker Installation (Produktion)

### Voraussetzungen

- Docker und Docker Compose (v2+)
- Ein Server mit mindestens 1 GB RAM
- (Optional) Reverse Proxy (nginx, Traefik, Caddy) fuer HTTPS

### 1. Repository klonen

```bash
git clone <repo-url> ari-community
cd ari-community
```

### 2. Environment-Datei erstellen

```bash
cp .env.docker.example .env.docker
```

Dann `.env.docker` bearbeiten:

```env
# ─── Database ──────────────────────────────────────────────────────
POSTGRES_DB=ari_community
POSTGRES_USER=ari
POSTGRES_PASSWORD=HIER_EIN_SICHERES_PASSWORT        # PFLICHT

# ─── App ───────────────────────────────────────────────────────────
APP_PORT=3000
PUBLIC_SITE_URL=https://ari.deine-domain.de          # PFLICHT

# ─── Auth ──────────────────────────────────────────────────────────
# Generiere mit: openssl rand -hex 32
AUTH_SESSION_SECRET=HIER_EIN_LANGER_ZUFAELLIGER_STRING   # PFLICHT
AUTH_BCRYPT_ROUNDS=12

# ─── Email (SMTP) ─────────────────────────────────────────────────
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USERNAME=notifications@example.com
SMTP_PASSWORD=SMTP_PASSWORT
SMTP_FROM=notifications@example.com
```

### Pflicht-Variablen

| Variable | Beschreibung |
|----------|-------------|
| `POSTGRES_PASSWORD` | Datenbank-Passwort. Wird nur intern zwischen App- und DB-Container verwendet. Muss sicher sein. |
| `AUTH_SESSION_SECRET` | JWT-Signierungsschluessel. Mindestens 32 Zeichen. Generieren mit `openssl rand -hex 32`. Wenn dieser Wert geaendert wird, werden alle bestehenden Sessions ungueltig. |
| `PUBLIC_SITE_URL` | Die oeffentliche URL der App (z.B. `https://ari.example.com`). Wird fuer Links in E-Mails und Einladungen verwendet. |

### Optionale Variablen

| Variable | Default | Beschreibung |
|----------|---------|-------------|
| `POSTGRES_DB` | `ari_community` | Name der Datenbank |
| `POSTGRES_USER` | `ari` | Datenbank-Benutzer |
| `APP_PORT` | `3000` | Port auf dem die App erreichbar ist |
| `AUTH_BCRYPT_ROUNDS` | `12` | Bcrypt Hashing-Runden (hoeher = sicherer, aber langsamer) |
| `SMTP_HOST` | *(leer)* | SMTP-Server. **Wenn leer, werden keine E-Mails versendet** (Einladungen, Benachrichtigungen, Passwort-Reset). |
| `SMTP_PORT` | `465` | SMTP-Port |
| `SMTP_SECURE` | `true` | `true` fuer SSL/TLS (Port 465), `false` fuer STARTTLS (Port 587) |
| `SMTP_USERNAME` | *(leer)* | SMTP-Benutzername |
| `SMTP_PASSWORD` | *(leer)* | SMTP-Passwort |
| `SMTP_FROM` | `notifications@ari-worms.de` | Absender-Adresse fuer ausgehende E-Mails |

### 3. Container starten

```bash
docker compose --env-file .env.docker up -d --build
```

Beim ersten Start passiert automatisch:

1. PostgreSQL 18 wird gestartet (mit Healthcheck)
2. Die App wird gebaut (Multi-Stage: Frontend + Backend)
3. `prisma migrate deploy` erstellt alle Datenbank-Tabellen
4. Der Express-Server startet auf Port 3000

### 4. Admin-Benutzer anlegen

Beim allerersten Start muss der initiale Admin-User per Seed erstellt werden:

```bash
docker compose --env-file .env.docker exec app npx prisma db seed
```

Das erstellt:

- **Organisation:** ARI Community
- **Admin-Login:** `admin@ari-worms.de` / `admin123`

> **Wichtig:** Aendere das Admin-Passwort sofort nach dem ersten Login unter **Profil > Passwort aendern**!

### 5. App aufrufen

Die App ist erreichbar unter `http://<server-ip>:3000` (bzw. dem konfigurierten `APP_PORT`).

---

## Sicherheitshinweise

### Datenbank nicht oeffentlich erreichbar

Die PostgreSQL-Datenbank ist bewusst **nicht** nach aussen exponiert. Sie ist ausschliesslich ueber das interne Docker-Netzwerk erreichbar (`db:5432`). Der App-Container verbindet sich intern – es wird kein Port auf dem Host geoeffnet.

Fuer Datenbank-Debugging waehrend der Entwicklung nutze `docker compose exec`:

```bash
docker compose --env-file .env.docker exec db psql -U ari ari_community
```

### Non-Root Container

Der App-Container laeuft als eingeschraenkter User (`appuser`), nicht als Root. Nur das `/app/uploads`-Verzeichnis ist beschreibbar.

### Upload-Beschraenkungen

Datei-Uploads sind auf erlaubte Typen beschraenkt:

| Bucket | Erlaubte Dateitypen | Max. Groesse |
|--------|-------------------|-------------|
| Avatare, Logos | JPG, PNG, WebP, SVG, GIF | 10 MB |
| Menues | JPG, PNG, WebP, SVG, GIF, PDF | 10 MB |
| Dokumente, Anhaenge | Bilder + PDF, DOC(X), XLS(X), TXT | 10 MB |

Nicht erlaubte Dateitypen (z.B. `.exe`, `.sh`, `.zip`) werden serverseitig abgelehnt.

### Environment-Dateien

`.env` und `.env.docker` sind in `.gitignore` und werden **nicht** ins Repository committed. Im Repo liegt nur das Template:

- `.env.docker.example` – Template fuer die Environment-Variablen

---

## HTTPS mit Reverse Proxy

Fuer Produktion sollte ein Reverse Proxy mit SSL/TLS vor der App geschaltet werden.

### Caddy (automatisches HTTPS)

```
ari.deine-domain.de {
    reverse_proxy localhost:3000
}
```

### nginx

```nginx
server {
    listen 443 ssl;
    server_name ari.deine-domain.de;

    ssl_certificate     /etc/letsencrypt/live/ari.deine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ari.deine-domain.de/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket Support (Socket.io) – wichtig fuer Echtzeit-Benachrichtigungen
    location /ws {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }
}
```

> **Wichtig:** Der WebSocket-Pfad `/ws` muss separat mit Upgrade-Headern konfiguriert werden, sonst funktionieren Echtzeit-Benachrichtigungen und Live-Nachrichten nicht.

---

## Verwaltung

### Logs anzeigen

```bash
docker compose --env-file .env.docker logs -f app     # App-Logs
docker compose --env-file .env.docker logs -f db       # Datenbank-Logs
```

### App neustarten

```bash
docker compose --env-file .env.docker restart app
```

### Update deployen

```bash
git pull
docker compose --env-file .env.docker up -d --build
```

Datenbank-Migrationen werden automatisch beim Container-Start ausgefuehrt (`prisma migrate deploy`).

### Backup der Datenbank

```bash
docker compose --env-file .env.docker exec db \
  pg_dump -U ari ari_community > backup_$(date +%Y%m%d).sql
```

### Datenbank wiederherstellen

```bash
cat backup.sql | docker compose --env-file .env.docker exec -T db \
  psql -U ari ari_community
```

---

## Projektstruktur

```
.
├── src/                    # Frontend (React + TypeScript)
│   ├── components/         # UI-Komponenten
│   ├── hooks/              # React Hooks (useAuth, useCurrentProfile, ...)
│   ├── lib/                # API-Client, Socket.io-Client, Hilfsfunktionen
│   └── pages/              # Seiten (Pinnwand, Events, Rooms, Q&A, ...)
├── server/                 # Backend (Express + TypeScript)
│   ├── routes/             # API-Routen (auth, crud, data, notifications, upload)
│   ├── services/           # Email, Realtime (Socket.io), Storage
│   ├── middleware/          # Auth-Middleware (JWT-Verifizierung)
│   └── lib/                # JWT, Passwort-Hashing, Prisma-Client
├── prisma/                 # Datenbank
│   ├── schema.prisma       # Schema (37 Tabellen, 12 Enums)
│   └── seed.ts             # Initiale Daten
├── docker-compose.yml      # Docker Compose (App + PostgreSQL)
├── Dockerfile              # Multi-Stage Build (non-root User)
└── .env.docker.example     # Template fuer Environment-Variablen
```

## Volumes und Persistenz

Docker Compose erstellt zwei benannte Volumes:

| Volume | Pfad im Container | Beschreibung |
|--------|-------------------|-------------|
| `postgres_data` | `/var/lib/postgresql/data` | Datenbank-Dateien |
| `uploads` | `/app/uploads` | Hochgeladene Dateien (Avatare, Logos, Dokumente, Menues) |

> **Achtung:** `docker compose down` behaelt die Volumes. Nur `docker compose down -v` loescht sie – dabei gehen **alle Daten** verloren!
