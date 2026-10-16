#!/usr/bin/env bash
#
# Installiert oder aktualisiert die Tee-Etiketten-App auf einem frischen
# Debian- oder Ubuntu-Server (z. B. netcup vServer / Root-Server).
#
#   sudo bash install-server.sh etiketten.example.de
#   sudo bash install-server.sh          # ohne Domain: kostenloser sslip.io-Name
#
# Was das Skript macht:
#   1. Docker und Caddy (Webserver mit automatischem HTTPS) installieren
#   2. Die App nach /opt/sticker-plot holen bzw. aktualisieren
#   3. .env mit Passwort und Zufallsschlüssel anlegen (nur beim ersten Mal)
#   4. Caddy für die Domain einrichten
#   5. Container bauen und starten, tägliche Datensicherung einrichten
#
# Erneut ausführen = Update auf den neuesten Stand des Branches.
#
# Ohne Rückfragen (z. B. für automatische Updates per GitHub Actions):
#   NONINTERACTIVE=1 bash install-server.sh <domain>
# Beim ersten Mal dann APP_PASSWORD=... mitgeben; ein belegter Port 80/443
# wird nur mit STOP_WEBSERVER=1 freigemacht.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/j4nric/sticker-plot.git}"
BRANCH="${BRANCH:-claude/tea-label-sticker-generator-379hjt}"
APP_DIR="${APP_DIR:-/opt/sticker-plot}"
DOMAIN="${1:-${DOMAIN:-}}"
INTERACTIVE=1
if [[ -n "${NONINTERACTIVE:-}" || ! -t 0 ]]; then INTERACTIVE=0; fi

# Liegt das Skript im App-Ordner, würde "git reset" es während der Ausführung
# überschreiben. Deshalb zuerst eine Kopie anlegen und diese ausführen.
SELF="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || true)"
if [[ -n "$SELF" && "$SELF" == "$APP_DIR"/* && -z "${STICKER_PLOT_COPY:-}" ]]; then
  COPY="$(mktemp /tmp/install-server.XXXXXX.sh)"
  cp "$SELF" "$COPY"
  STICKER_PLOT_COPY=1 exec bash "$COPY" "$@"
fi

info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mHinweis: %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Bitte als root ausführen, z. B. mit: sudo bash $0 etiketten.example.de"
[[ -r /etc/os-release ]] || fail "Unbekanntes Betriebssystem."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "debian" || "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] \
  || fail "Dieses Skript unterstützt Debian und Ubuntu (gefunden: ${PRETTY_NAME:-unbekannt})."

public_ipv4() {
  # erste öffentliche IPv4 des Servers (netcup vergibt sie direkt am Interface)
  hostname -I 2>/dev/null | tr ' ' '\n' \
    | grep -E '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$' \
    | grep -vE '^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\.)' \
    | head -n1 || true
}

if [[ -z "$DOMAIN" && $INTERACTIVE -eq 0 ]]; then
  IP="$(public_ipv4)"
  [[ -n "$IP" ]] || fail "Ohne Rückfragen muss eine Domain angegeben werden."
  DOMAIN="tee-${IP//./-}.sslip.io"
fi
if [[ -z "$DOMAIN" ]]; then
  IP="$(public_ipv4)"
  if [[ -n "$IP" ]]; then
    # Kostenloser Name ohne Anmeldung: sslip.io löst auf die enthaltene IP auf
    SUGGESTION="tee-${IP//./-}.sslip.io"
    echo "Ohne eigene Domain kann die App unter einem kostenlosen sslip.io-Namen laufen."
    read -rp "Domain für die App [Enter = $SUGGESTION]: " DOMAIN
    DOMAIN="${DOMAIN:-$SUGGESTION}"
  else
    read -rp "Domain für die App (z. B. etiketten.teetreffpunkt.de): " DOMAIN
  fi
fi
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Ungültige Domain: '$DOMAIN'"

export DEBIAN_FRONTEND=noninteractive

# ---------------------------------------------------------------- Grundpakete
info "Systempakete installieren"
apt-get update -qq
apt-get install -y -qq ca-certificates curl git gnupg openssl cron >/dev/null

# ---------------------------------------------------------------- DNS-Prüfung
SERVER_IPS="$(hostname -I 2>/dev/null || true)"
DOMAIN_IP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)"
if [[ -z "$DOMAIN_IP" ]]; then
  warn "$DOMAIN zeigt noch auf keine IP. Ohne DNS-Eintrag (A-Record) bekommt Caddy kein HTTPS-Zertifikat."
elif [[ " $SERVER_IPS " != *" $DOMAIN_IP "* ]]; then
  warn "$DOMAIN zeigt auf $DOMAIN_IP, dieser Server hat aber: $SERVER_IPS. Bitte DNS-Eintrag prüfen."
fi

# ---------------------------------------------------------------- Docker
if ! command -v docker >/dev/null 2>&1; then
  info "Docker installieren"
  curl -fsSL https://get.docker.com | sh
fi
docker compose version >/dev/null 2>&1 || fail "Docker Compose fehlt. Bitte das Paket docker-compose-plugin installieren."
systemctl enable --now docker >/dev/null

# ---------------------------------------------------------------- Caddy
# Programme (außer Caddy), die Port 80 oder 443 belegen
port_blockers() {
  ss -ltnpH '( sport = :80 or sport = :443 )' 2>/dev/null \
    | grep -oP 'users:\(\("\K[^"]+' | sort -u | grep -vx caddy | tr '\n' ' ' || true
}
SETUP_CADDY=1
if ! command -v caddy >/dev/null 2>&1; then
  BLOCKERS="$(port_blockers)"
  if [[ -n "${BLOCKERS// /}" ]]; then
    warn "Port 80/443 ist belegt durch: $BLOCKERS"
    ss -ltnp '( sport = :80 or sport = :443 )' 2>/dev/null || true
    for svc in apache2 nginx lighttpd httpd; do
      if [[ " $BLOCKERS " == *" $svc "* ]] && systemctl cat "$svc.service" >/dev/null 2>&1; then
        echo
        echo "Auf dem Server läuft der Webserver '$svc'. Caddy braucht die Ports 80 und 443 für HTTPS."
        echo "Abschalten nur, wenn auf diesem Server KEINE andere Website über '$svc' läuft."
        if [[ $INTERACTIVE -eq 1 ]]; then
          read -rp "'$svc' stoppen und dauerhaft deaktivieren? [j/N] " ANSWER
        else
          ANSWER="${STOP_WEBSERVER:+j}"
        fi
        if [[ "$ANSWER" =~ ^[jJyY] ]]; then
          systemctl disable --now "$svc"
          info "'$svc' gestoppt und deaktiviert"
        fi
      fi
    done
    sleep 1
    BLOCKERS="$(port_blockers)"
    if [[ -n "${BLOCKERS// /}" ]]; then
      warn "Port 80/443 ist weiterhin belegt ($BLOCKERS). Caddy wird nicht installiert."
      warn "Die App läuft auf 127.0.0.1:3000. Den vorhandenen Webserver als Reverse Proxy einrichten,"
      warn "siehe docs/betrieb.md, Abschnitt 'Vorhandener Webserver'."
      SETUP_CADDY=0
    fi
  fi
  if [[ $SETUP_CADDY -eq 1 ]]; then
    info "Caddy installieren"
    install -d -m 0755 /usr/share/keyrings
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
      | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
    curl -fsSL https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
      > /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    apt-get install -y -qq caddy >/dev/null
  fi
fi

# ---------------------------------------------------------------- App holen
if [[ -d "$APP_DIR/.git" ]]; then
  info "App aktualisieren ($BRANCH)"
  git -C "$APP_DIR" fetch --quiet origin "$BRANCH"
  git -C "$APP_DIR" checkout --quiet "$BRANCH"
  git -C "$APP_DIR" reset --quiet --hard "origin/$BRANCH"
else
  info "App herunterladen nach $APP_DIR"
  git clone --quiet --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

# ---------------------------------------------------------------- .env
if [[ ! -f .env ]]; then
  info "Konfiguration anlegen"
  if [[ $INTERACTIVE -eq 0 ]]; then
    APP_PASSWORD="${APP_PASSWORD:-}"
    [[ ${#APP_PASSWORD} -ge 8 ]] || fail "Ohne Rückfragen bitte APP_PASSWORD (mind. 8 Zeichen) mitgeben."
    PW="$APP_PASSWORD"
    PW2="$APP_PASSWORD"
  fi
  while [[ -z "${PW:-}" ]] || [[ "$PW" != "${PW2:-}" ]] || [[ ${#PW} -lt 8 ]]; do
    read -rsp "Passwort für den Benutzer 'admin' festlegen (mind. 8 Zeichen): " PW; echo
    read -rsp "Passwort wiederholen: " PW2; echo
    [[ ${#PW} -ge 8 && "$PW" == "$PW2" ]] && break
    warn "Passwörter stimmen nicht überein oder sind zu kurz."
    PW=""
  done
  umask 077
  {
    echo "APP_PASSWORD=$PW"
    echo "SESSION_SECRET=$(openssl rand -hex 32)"
    echo "SHOP_NAME=Tee-Treff-Punkt"
    echo "SHOP_URL=www.teetreffpunkt.de"
  } > .env
  unset PW PW2
  umask 022
else
  info "Vorhandene .env wird beibehalten"
fi

# ---------------------------------------------------------------- Caddy konfigurieren
if [[ $SETUP_CADDY -eq 1 ]]; then
  info "HTTPS für $DOMAIN einrichten"
  install -d /etc/caddy/conf.d
  cat > /etc/caddy/conf.d/sticker-plot.caddy <<EOF
$DOMAIN {
	encode gzip
	request_body {
		max_size 64MB
	}
	reverse_proxy 127.0.0.1:3000
}
EOF
  CADDYFILE=/etc/caddy/Caddyfile
  if [[ ! -f $CADDYFILE ]] || grep -q "/usr/share/caddy" "$CADDYFILE"; then
    # Auslieferungszustand von Caddy: durch Import ersetzen
    [[ -f $CADDYFILE ]] && cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
    echo "import /etc/caddy/conf.d/*.caddy" > "$CADDYFILE"
  elif ! grep -q "import /etc/caddy/conf.d/" "$CADDYFILE"; then
    cp "$CADDYFILE" "$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
    printf '\nimport /etc/caddy/conf.d/*.caddy\n' >> "$CADDYFILE"
  fi
  caddy validate --config "$CADDYFILE" --adapter caddyfile >/dev/null 2>&1 \
    || fail "Caddy-Konfiguration ungültig. Bitte $CADDYFILE prüfen."
  systemctl enable --now caddy >/dev/null
  systemctl reload caddy

  if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    ufw allow 80/tcp >/dev/null
    ufw allow 443/tcp >/dev/null
  fi
fi

# ---------------------------------------------------------------- Starten
info "Container bauen und starten (beim ersten Mal einige Minuten)"
docker compose up -d --build

info "Auf Start warten"
for _ in $(seq 1 60); do
  if curl -fs -o /dev/null http://127.0.0.1:3000/login; then READY=1; break; fi
  sleep 2
done
[[ "${READY:-0}" -eq 1 ]] || fail "Die App antwortet nicht. Logs ansehen mit: cd $APP_DIR && docker compose logs app"

# ---------------------------------------------------------------- Datensicherung
cat > /etc/cron.d/sticker-plot-backup <<EOF
# Tägliche Sicherung der Tee-Etiketten-Datenbank, Aufbewahrung 30 Tage
30 3 * * * root cd $APP_DIR && docker compose exec -T app node scripts/backup.mjs >/dev/null 2>&1 && docker compose exec -T app find /app/data/backups -name '*.db' -mtime +30 -delete
EOF
chmod 644 /etc/cron.d/sticker-plot-backup

info "Fertig"
if [[ $SETUP_CADDY -eq 1 ]]; then
  echo "Die App ist erreichbar unter: https://$DOMAIN"
  echo "Das HTTPS-Zertifikat holt Caddy beim ersten Aufruf automatisch."
else
  echo "Die App läuft auf http://127.0.0.1:3000 (Reverse Proxy noch einrichten)."
fi
echo "Anmeldung:       Benutzer 'admin' mit dem Passwort aus APP_PASSWORD (Datei $APP_DIR/.env)."
echo "                 Weitere Zugänge für das Personal unter Verwaltung → Benutzer anlegen."
echo "PDF-Import:      sudo bash $APP_DIR/scripts/import-pdfs.sh <ordner-mit-pdfs>"
echo "Update später:   sudo bash $APP_DIR/scripts/install-server.sh $DOMAIN"
echo "Logs:            cd $APP_DIR && docker compose logs -f app"
