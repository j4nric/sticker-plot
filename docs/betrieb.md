# Betrieb auf dem vServer

Die App läuft als Docker-Container. Chromium für die PDF-Erzeugung ist im Image enthalten.

## Voraussetzungen

- Linux-vServer mit Docker und Docker Compose
- mindestens 1 GB RAM, empfohlen 2 GB (Chromium braucht beim Rendern 200 bis 400 MB)
- eine (Sub-)Domain, die auf den Server zeigt, für HTTPS

## Erstinstallation

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
