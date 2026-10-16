# Betrieb auf dem vServer

Die App läuft als Docker-Container. Chromium für die PDF-Erzeugung ist im Image enthalten.

## Voraussetzungen

- Linux-vServer mit Docker und Docker Compose
- mindestens 1 GB RAM, empfohlen 2 GB (Chromium braucht beim Rendern 200 bis 400 MB)
- eine eigene (Sub-)Domain oder ein kostenloser sslip.io-Name (siehe unten), für HTTPS

## Schnellinstallation mit Skript (empfohlen)

Für einen Debian- oder Ubuntu-Server, z. B. einen netcup vServer.

**Ohne eigene Domain:** Das Skript ohne Domain aufrufen. Es schlägt dann einen kostenlosen Namen
bei [sslip.io](https://sslip.io) vor, z. B. `tee-203-0-113-5.sslip.io` für die Server-IP
203.0.113.5. Dieser Name zeigt ohne Anmeldung automatisch auf den Server, und Caddy holt dafür ein
gültiges HTTPS-Zertifikat. Ein DNS-Eintrag ist nicht nötig.

**Mit eigener Domain:** Vorher beim Domain-Anbieter einen A-Record anlegen, z. B. Host `etiketten`,
Ziel = IPv4 des Servers. Bei netcup geht das im Customer Control Panel unter *Domains* → *DNS*,
sobald dort eine Domain registriert ist.

1. **Per SSH als root auf den Server** einloggen und ausführen:

   ```bash
   curl -fsSL https://raw.githubusercontent.com/j4nric/sticker-plot/claude/tea-label-sticker-generator-379hjt/scripts/install-server.sh -o install-server.sh
   bash install-server.sh                              # ohne Domain: sslip.io-Vorschlag
   # oder: bash install-server.sh etiketten.teetreffpunkt.de
   ```

   Das Skript fragt einmal nach dem Laden-Passwort. Es installiert Docker und Caddy, richtet HTTPS
   ein, startet die App und legt eine tägliche Datensicherung an (Aufbewahrung 30 Tage).
2. **Aufrufen** unter der Adresse, die das Skript am Ende ausgibt.

Ein späterer Wechsel auf eine eigene Domain ist jederzeit möglich: Skript mit der neuen Domain erneut
ausführen. Die Daten bleiben erhalten.

Für ein Update dasselbe Skript mit derselben Domain erneut ausführen:
`bash /opt/sticker-plot/scripts/install-server.sh <domain>`

Läuft auf dem Server schon ein anderer Webserver auf Port 80/443, installiert das Skript Caddy
nicht. Die App ist dann unter `127.0.0.1:3000` erreichbar und wird im vorhandenen Webserver als
Reverse Proxy eingetragen.

## Manuelle Installation

```bash
git clone https://github.com/j4nric/sticker-plot.git
cd sticker-plot
cp .env.example .env
# .env bearbeiten: APP_PASSWORD und SESSION_SECRET setzen, z. B.
#   SESSION_SECRET=$(openssl rand -hex 32)
docker compose up -d --build
docker compose logs -f app      # Start prüfen
```

Die App lauscht dann nur lokal auf Port 3000. Datenbank und Sicherungen liegen im Docker-Volume
`tee-data`. Beim ersten Start wird die Datenbank angelegt und ein Standarddrucker erstellt.

## HTTPS mit Caddy

Caddy besorgt Zertifikate automatisch. Beispiel für `/etc/caddy/Caddyfile`:

```
etiketten.teetreffpunkt.de {
    encode gzip
    reverse_proxy 127.0.0.1:3000
}
```

Danach `sudo systemctl reload caddy`. Mit nginx funktioniert es genauso über `proxy_pass`; dann
zusätzlich ein Zertifikat, z. B. per certbot, einrichten. Ohne HTTPS funktioniert der Login nicht,
weil das Cookie nur über sichere Verbindungen gesendet wird.

## Updates

```bash
git pull
docker compose up -d --build
```

Datenbank-Migrationen laufen beim Start automatisch.

## Sicherung

```bash
# konsistente Kopie im laufenden Betrieb nach /app/data/backups im Volume
docker compose exec app node scripts/backup.mjs
# Sicherungen auf den Host kopieren
docker compose cp app:/app/data/backups ./backups
```

Für eine tägliche Sicherung beide Befehle in einen Cronjob auf dem Host schreiben und den Ordner
`backups` zusätzlich extern sichern.

## Fehlersuche

- **PDF-Erzeugung schlägt fehl:** `docker compose logs app` prüfen. Meist fehlt Speicher; dann
  `shm_size` in `docker-compose.yml` erhöhen oder mehr RAM bereitstellen.
- **Login klappt nicht:** Läuft die Seite über HTTPS? Für Tests ohne HTTPS `COOKIE_SECURE=false`
  in `.env` setzen.
- **Container startet nicht:** Fehlt `APP_PASSWORD` oder `SESSION_SECRET`, bricht der Start mit
  einer entsprechenden Meldung ab.
