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
   curl -fsSL https://raw.githubusercontent.com/j4nric/sticker-plot/main/scripts/install-server.sh -o install-server.sh
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

Läuft auf dem Server schon ein anderer Webserver auf Port 80/443, zeigt das Skript an, welcher es
ist. Bei Apache oder nginx fragt es, ob er abgeschaltet werden soll. Das ist richtig, wenn der
Server nur für diese App da ist. Läuft dort noch eine andere Website, die Frage verneinen und den
vorhandenen Webserver wie unten beschrieben einrichten.

### Wer belegt Port 80/443?

```bash
ss -ltnp '( sport = :80 or sport = :443 )'
```

Der Name in `users:(("…"` ist das Programm. Wird der Server nur für die App genutzt, den
Webserver abschalten und das Skript erneut ausführen, z. B. für Apache:

```bash
systemctl disable --now apache2
bash install-server.sh <domain>
```

### Vorhandener Webserver als Reverse Proxy

Läuft auf dem Server schon eine andere Website mit nginx, Apache oder Caddy im Docker-Container,
bleibt dieser Webserver in Betrieb und leitet nur die Adresse der Tee-App an sie weiter. Ablauf:

1. Installationsskript ausführen und die Frage, ob der Webserver abgeschaltet werden soll, mit
   **N** beantworten. Die App läuft dann intern. Ist Port 3000 schon von der anderen App belegt,
   wählt das Skript automatisch einen freien Port und trägt ihn als `APP_PORT` in `.env` ein.
2. Weiterleitung und HTTPS einrichten:

   ```bash
   sudo bash /opt/sticker-plot/scripts/setup-proxy.sh <domain>
   ```

   Das Skript erkennt nginx oder Apache, legt eine zusätzliche Konfiguration nur für diese Domain
   an, prüft sie und holt mit certbot ein Zertifikat. Ist die Konfiguration fehlerhaft, wird sie
   zurückgenommen; die andere Website bleibt unberührt.

Gehört Port 80 einem **Caddy im Docker-Container** einer anderen App, erledigt dasselbe Skript
das ebenfalls: Es verbindet die Tee-App mit dem Docker-Netzwerk dieses Containers
(`docker-compose.override.yml`, bleibt bei Updates erhalten), ergänzt in dessen Caddyfile einen
Block für die Domain (vorher mit Sicherungskopie), prüft die Konfiguration und lädt Caddy neu. Das
Zertifikat holt Caddy selbst. Überschreibt die andere App ihre Caddyfile bei eigenen Updates, den
Block dort dauerhaft eintragen:

```
tee-62-83-23-90.sslip.io {
	encode gzip
	request_body {
		max_size 64MB
	}
	reverse_proxy tee-etiketten:3000
}
```

Andere Webserver im Container (z. B. Traefik) werden nicht automatisch eingerichtet; dort die
Weiterleitung Domain → Container `tee-etiketten`, Port 3000 eintragen.

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

Die App lauscht dann nur lokal auf Port 3000 (oder `APP_PORT` aus `.env`). Datenbank und Sicherungen liegen im Docker-Volume
`tee-data`. Beim ersten Start wird die Datenbank angelegt und ein Standarddrucker erstellt.

## HTTPS mit Caddy

Caddy besorgt Zertifikate automatisch. Beispiel für `/etc/caddy/Caddyfile`:

```
etiketten.teetreffpunkt.de {
    encode gzip
    request_body {
        max_size 64MB
    }
    reverse_proxy 127.0.0.1:3000
}
```

Danach `sudo systemctl reload caddy`. Mit nginx funktioniert es genauso über `proxy_pass`; dann
zusätzlich ein Zertifikat, z. B. per certbot, einrichten. Ohne HTTPS funktioniert der Login nicht,
weil das Cookie nur über sichere Verbindungen gesendet wird.

## Anmeldung nach der Installation

Beim ersten Start legt die App den Benutzer **admin** mit dem Passwort aus `APP_PASSWORD` an
(steht in `/opt/sticker-plot/.env`). Danach unter **Verwaltung → Benutzer** Zugänge für das
Personal anlegen und das Admin-Passwort unter **Konto** ändern.

**Hinweis für das Update von der ersten Version:** Früher gab es nur ein gemeinsames Passwort. Nach
dem Update meldet man sich mit dem Benutzernamen `admin` und genau diesem Passwort an. Alle
bisherigen Tees, Drucker und Kalibrierungen bleiben erhalten.

## Updates

Das Installationsskript erneut ausführen:

```bash
sudo bash /opt/sticker-plot/scripts/install-server.sh <domain>
```

Es holt den neuesten Stand, baut den Container neu und startet ihn. Datenbank-Migrationen laufen
beim Start automatisch, die Daten bleiben erhalten.

**Hinweis zum Update mit der Performance-Überarbeitung (Oktober 2026):** Danach muss sich jeder
einmal neu anmelden. Messwerte und Änderungen stehen in
[performance-analyse.md](performance-analyse.md).

### Automatische Updates per GitHub Actions (optional)

Der Workflow `.github/workflows/deploy.yml` spielt jeden erfolgreich getesteten Stand automatisch
auf dem Server ein. Dafür im GitHub-Repository unter **Settings → Secrets and variables → Actions**
anlegen:

| Secret | Inhalt |
|---|---|
| `DEPLOY_HOST` | IP oder Name des Servers |
| `DEPLOY_DOMAIN` | Domain der App, z. B. `tee-62-83-23-90.sslip.io` |
| `DEPLOY_SSH_KEY` | privater SSH-Schlüssel, dessen öffentlicher Teil in `/root/.ssh/authorized_keys` steht |
| `DEPLOY_USER` | optional, Standard `root` |

Ohne diese Secrets wird der Deploy-Schritt einfach übersprungen. Manuell auslösen lässt er sich
unter **Actions → Deploy → Run workflow**.

## Alte Etiketten vom Server aus importieren

Für viele PDF-Dateien ist das Kommandozeilen-Werkzeug bequemer als das Hochladen im Browser. Die
PDFs per SFTP (z. B. mit WinSCP oder FileZilla) in einen Ordner auf dem Server kopieren, dann:

```bash
sudo bash /opt/sticker-plot/scripts/import-pdfs.sh /root/etiketten-pdfs
```

Die Ergebnisse erscheinen unter **Verwaltung → Import** zur Prüfung. Mit `--direkt` am Ende werden
sicher erkannte, neue Sorten sofort angelegt; unsichere und doppelte bleiben zur Prüfung stehen.

## Sicherung

Alle Daten, auch hochgeladene Bilder, liegen in einer SQLite-Datei im Docker-Volume `tee-data`.

- **Automatisch:** Das Installationsskript richtet eine tägliche Sicherung um 3:30 Uhr ein, die
  30 Tage aufbewahrt wird.
- **In der App:** **Verwaltung → Sicherung** lädt die aktuelle Datenbank herunter, listet die
  Sicherungen auf dem Server und stellt eine Sicherung wieder her. Vor dem Wiederherstellen wird der
  aktuelle Stand automatisch gesichert.
- **Auf der Kommandozeile:**

  ```bash
  cd /opt/sticker-plot
  docker compose exec app node scripts/backup.mjs        # Sicherung im Volume anlegen
  docker compose cp app:/app/data/backups ./backups      # Sicherungen auf den Host kopieren
  ```

Die Sicherungen zusätzlich extern ablegen, z. B. regelmäßig in der App herunterladen.

## Fehlersuche

- **PDF-Erzeugung schlägt fehl:** `docker compose logs app` prüfen. Meist fehlt Speicher; dann
  `shm_size` in `docker-compose.yml` erhöhen oder mehr RAM bereitstellen.
- **Login klappt nicht:** Läuft die Seite über HTTPS? Für Tests ohne HTTPS `COOKIE_SECURE=false`
  in `.env` setzen. Nach 5 Fehlversuchen von einem Gerät bzw. 20 Fehlversuchen insgesamt ist
  der Name 10 Minuten gesperrt.
- **„Die Datei ist zu groß“ (413):** Grenzen je Upload: Bild 4 MB, PDF-Import 40 MB je Datei,
  CSV 10 MB, Sicherung 500 MB (der Caddy-Proxy des Installationsskripts lässt bis 64 MB zu).
- **Container startet nicht:** Fehlt `APP_PASSWORD` oder `SESSION_SECRET`, bricht der Start mit
  einer entsprechenden Meldung ab.
- **Passwort des Admins vergessen:** Ein anderer Administrator setzt es unter Verwaltung →
  Benutzer neu. Gibt es keinen, auf dem Server alle Benutzer entfernen:
  `docker compose exec app node -e "const D=require('better-sqlite3');new D('/app/data/sticker-plot.db').prepare('delete from users').run()"`
  und den Container neu starten. Beim Start wird „admin“ mit dem Passwort aus `.env` neu angelegt.
- **PDF-Import hängt:** `docker compose logs app` prüfen. Abgebrochene Einträge werden nach einem
  Neustart automatisch erneut verarbeitet.
