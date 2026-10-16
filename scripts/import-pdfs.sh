#!/usr/bin/env bash
#
# Importiert alte Etiketten-PDFs aus einem Ordner auf dem Server in die App.
#
#   sudo bash /opt/sticker-plot/scripts/import-pdfs.sh /pfad/zu/pdfs [--direkt]
#
# Ohne --direkt erscheinen die Ergebnisse unter Verwaltung → Import zur Prüfung.
# Mit --direkt werden sicher erkannte, neue Sorten sofort angelegt.
set -euo pipefail
APP_DIR="${APP_DIR:-/opt/sticker-plot}"
SRC="${1:-}"
shift || true
[[ -n "$SRC" && -d "$SRC" ]] || { echo "Aufruf: $0 <ordner-mit-pdfs> [--direkt]" >&2; exit 1; }
cd "$APP_DIR"
TARGET="/app/data/import-$(date +%Y%m%d%H%M%S)"
docker compose exec -T app mkdir -p "$TARGET"
docker compose cp "$SRC/." "app:$TARGET"
docker compose exec -T app node build/cli/import-pdfs.js "$TARGET" "$@"
docker compose exec -T app rm -rf "$TARGET"
