#!/usr/bin/env bash
#
# Bindet die Tee-Etiketten-App in einen bereits laufenden Webserver ein, wenn
# auf dem Server noch eine andere Website läuft: nginx, Apache oder Caddy im
# Docker-Container.
#
#   sudo bash /opt/sticker-plot/scripts/setup-proxy.sh <domain>
#
# Legt nur eine zusätzliche Konfiguration für <domain> an; andere Websites
# bleiben unverändert. Danach holt certbot ein HTTPS-Zertifikat.
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/sticker-plot}"
DOMAIN="${1:-}"
info() { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
fail() { printf '\033[1;31mFehler: %s\033[0m\n' "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || fail "Bitte als root ausführen."
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+\.[A-Za-z]{2,}$ ]] || fail "Aufruf: $0 <domain>, z. B. $0 tee-62-83-23-90.sslip.io"

PORT="$(grep -E '^APP_PORT=[0-9]+$' "$APP_DIR/.env" 2>/dev/null | cut -d= -f2 || true)"
PORT="${PORT:-3000}"
curl -fs -o /dev/null "http://127.0.0.1:$PORT/login" || fail "Die App antwortet nicht auf Port $PORT. Zuerst install-server.sh ausführen."

# Welcher Webserver bedient Port 80?
OWNER="$(ss -ltnpH '( sport = :80 )' 2>/dev/null | grep -oP 'users:\(\("\K[^"]+' | head -n1 || true)"
info "Port 80 gehört: ${OWNER:-niemandem}"

export DEBIAN_FRONTEND=noninteractive
case "$OWNER" in
  nginx)
    if [[ -d /etc/nginx/sites-available ]]; then
      CONF=/etc/nginx/sites-available/sticker-plot
      LINK=/etc/nginx/sites-enabled/sticker-plot
    else
      CONF=/etc/nginx/conf.d/sticker-plot.conf
      LINK=""
    fi
    cat > "$CONF" <<NGINX
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 64m;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 180s;
    }
}
NGINX
    [[ -n "$LINK" ]] && ln -sf "$CONF" "$LINK"
    if ! nginx -t; then
      rm -f "$CONF" ${LINK:+"$LINK"}
      fail "nginx-Konfiguration ungültig, Änderung zurückgenommen."
    fi
    systemctl reload nginx
    info "HTTPS-Zertifikat holen"
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-nginx >/dev/null
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
    ;;
  apache2|httpd)
    a2enmod -q proxy proxy_http >/dev/null
    CONF=/etc/apache2/sites-available/sticker-plot.conf
    cat > "$CONF" <<APACHE
<VirtualHost *:80>
    ServerName $DOMAIN
    ProxyPreserveHost On
    ProxyPass / http://127.0.0.1:$PORT/
    ProxyPassReverse / http://127.0.0.1:$PORT/
    ProxyTimeout 180
    LimitRequestBody 67108864
</VirtualHost>
APACHE
    a2ensite -q sticker-plot >/dev/null
    if ! apache2ctl configtest; then
      a2dissite -q sticker-plot >/dev/null || true
      rm -f "$CONF"
      fail "Apache-Konfiguration ungültig, Änderung zurückgenommen."
    fi
    systemctl reload apache2
    info "HTTPS-Zertifikat holen"
    apt-get update -qq
    apt-get install -y -qq certbot python3-certbot-apache >/dev/null
    certbot --apache -d "$DOMAIN" --non-interactive --agree-tos --register-unsafely-without-email --redirect
    ;;
  docker-proxy)
    # Port 80 gehört einem Container. Unterstützt: Caddy im Container (z. B. caddy:2) mit
    # eingebundener Caddyfile. Die App kommt ins selbe Docker-Netzwerk, Caddy leitet weiter.
    CID="$(docker ps -q --filter publish=80 | head -n1)"
    [[ -n "$CID" ]] || fail "Kein Container mit Port 80 gefunden."
    CNAME="$(docker inspect -f '{{.Name}}' "$CID" | sed 's#^/##')"
    IMAGE="$(docker inspect -f '{{.Config.Image}}' "$CID")"
    info "Port 80 gehört dem Container $CNAME ($IMAGE)"
    [[ "$IMAGE" =~ (^|/)caddy(:|@|$) ]] || fail "Der Container $CNAME ist kein Caddy. Bitte die Ausgabe von 'docker ps' an den Entwickler schicken."

    NETS="$(docker inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{"\n"}}{{end}}' "$CID" | grep -v '^$' || true)"
    NET="$(grep -m1 '_default$' <<<"$NETS" || head -n1 <<<"$NETS")"
    [[ -n "$NET" ]] || fail "Netzwerk von $CNAME nicht gefunden."

    CADDYFILE="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy/Caddyfile"}}{{.Source}}{{end}}{{end}}' "$CID")"
    if [[ -z "$CADDYFILE" ]]; then
      DIR="$(docker inspect -f '{{range .Mounts}}{{if eq .Destination "/etc/caddy"}}{{.Source}}{{end}}{{end}}' "$CID")"
      [[ -n "$DIR" ]] && CADDYFILE="$DIR/Caddyfile"
    fi
    [[ -n "$CADDYFILE" && -f "$CADDYFILE" ]] || fail "Die Caddyfile von $CNAME liegt nicht als Datei auf dem Server (erwartet als Mount nach /etc/caddy/Caddyfile)."
    info "Caddyfile: $CADDYFILE, Netzwerk: $NET"

    info "Tee-App mit dem Netzwerk $NET verbinden"
    cat > "$APP_DIR/docker-compose.override.yml" <<YAML
# Angelegt von scripts/setup-proxy.sh: verbindet die App mit dem Netzwerk des Caddy-Containers
# $CNAME, damit dieser sie unter dem Namen tee-etiketten erreicht.
services:
  app:
    networks:
      default: {}
      proxy:
        aliases: [tee-etiketten]
networks:
  proxy:
    external: true
    name: $NET
YAML
    (cd "$APP_DIR" && docker compose up -d)

    BACKUP=""
    if grep -qF "$DOMAIN" "$CADDYFILE"; then
      info "$DOMAIN steht schon in der Caddyfile, keine Änderung"
    else
      BACKUP="$CADDYFILE.bak-$(date +%Y%m%d%H%M%S)"
      cp "$CADDYFILE" "$BACKUP"
      cat >> "$CADDYFILE" <<CADDY

# Tee-Etiketten (eingetragen von sticker-plot/scripts/setup-proxy.sh)
$DOMAIN {
	encode gzip
	request_body {
		max_size 64MB
	}
	reverse_proxy tee-etiketten:3000
}
CADDY
      info "Block für $DOMAIN ergänzt, Sicherung: $BACKUP"
    fi

    if ! docker exec "$CID" caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile; then
      # Datei inhaltlich zurückschreiben (gleiche Datei, damit der Mount erhalten bleibt)
      [[ -n "$BACKUP" ]] && cat "$BACKUP" > "$CADDYFILE"
      fail "Caddy lehnt die Konfiguration ab, Änderung zurückgenommen."
    fi
    docker exec "$CID" caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
    info "Caddy neu geladen, das Zertifikat für $DOMAIN wird jetzt automatisch geholt"
    echo
    echo "Hinweis: Überschreibt die andere App ihre Caddyfile bei eigenen Updates (z. B. aus ihrem"
    echo "Git-Repository), den obigen Block auch dort eintragen. Die Netzwerkverbindung der Tee-App"
    echo "bleibt dauerhaft bestehen (docker-compose.override.yml)."
    ;;
  "")
    fail "Auf Port 80 läuft kein Webserver. Dann einfach install-server.sh ausführen, es richtet Caddy ein."
    ;;
  *)
    fail "Unbekannter Webserver '$OWNER' auf Port 80. Bitte die Ausgabe von: ss -ltnp '( sport = :80 or sport = :443 )' an den Entwickler schicken."
    ;;
esac

info "Fertig: https://$DOMAIN"
