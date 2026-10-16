#!/usr/bin/env bash
#
# Installiert oder aktualisiert die Tee-Etiketten-App auf einem frischen
# Debian- oder Ubuntu-Server (z. B. netcup vServer / Root-Server).
#
#   sudo bash install-server.sh etiketten.example.de
#
# Was das Skript macht:
#   1. Docker und Caddy (Webserver mit automatischem HTTPS) installieren
#   2. Die App nach /opt/sticker-plot holen bzw. aktualisieren
#   3. .env mit Passwort und Zufallsschlüssel anlegen (nur beim ersten Mal)
#   4. Caddy für die Domain einrichten
#   5. Container bauen und starten, tägliche Datensicherung einrichten
#
# Erneut ausführen = Update auf den neuesten Stand des Branches.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/j4nric/sticker-plot.git}"
BRANCH="${BRANCH:-claude/tea-label-sticker-generator-379hjt}"
APP_DIR="${APP_DIR:-/opt/sticker-plot}"
DOMAIN="${1:-${DOMAIN:-}}"

info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mHinweis: %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Bitte als root ausführen, z. B. mit: sudo bash $0 etiketten.example.de"
[[ -r /etc/os-release ]] || fail "Unbekanntes Betriebssystem."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == "debian" || "${ID:-}" == "ubuntu" || "${ID_LIKE:-}" == *debian* ]] \
  || fail "Dieses Skript unterstützt Debian und Ubuntu (gefunden: ${PRETTY_NAME:-unbekannt})."

if [[ -z "$DOMAIN" ]]; then
  read -rp "Domain für die App (z. B. etiketten.teetreffpunkt.de): " DOMAIN
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
port_in_use_by_other() {
  ss -ltnpH "( sport = :$1 )" 2>/dev/null | grep -v caddy | grep -q .
}
SETUP_CADDY=1
if ! command -v caddy >/dev/null 2>&1; then
  if port_in_use_by_other 80 || port_in_use_by_other 443; then
    warn "Port 80 oder 443 ist bereits belegt (anderer Webserver?). Caddy wird nicht installiert."
    warn "Die App läuft dann nur auf 127.0.0.1:3000; den vorhandenen Webserver als Reverse Proxy darauf zeigen lassen."
    SETUP_CADDY=0
  else
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
  while true; do
    read -rsp "Laden-Passwort für die Anmeldung festlegen (mind. 8 Zeichen): " PW; echo
    read -rsp "Passwort wiederholen: " PW2; echo
    [[ ${#PW} -ge 8 && "$PW" == "$PW2" ]] && break
    warn "Passwörter stimmen nicht überein oder sind zu kurz."
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
  if curl -fsS -o /dev/null http://127.0.0.1:3000/login; then READY=1; break; fi
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
echo "Update später:   sudo bash $APP_DIR/scripts/install-server.sh $DOMAIN"
echo "Logs:            cd $APP_DIR && docker compose logs -f app"
