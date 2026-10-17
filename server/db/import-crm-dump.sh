#!/usr/bin/env bash
# Загрузка дампа CRM в общую MariaDB crm_v1.
# Использование:
#   ./server/db/import-crm-dump.sh [path/to/crm_v1_frontend_dump.sql]
set -euo pipefail

DUMP="${1:-$HOME/Downloads/frontend_backend_package (1)/crm_v1_frontend_dump.sql}"
CONTAINER="${DB_CONTAINER:-acrm-mariadb}"
USER="${DB_USER:-crm}"
PASS="${DB_PASSWORD:-crm_pass}"
DB="${DB_NAME:-crm_v1}"

if [[ ! -f "$DUMP" ]]; then
  echo "Файл дампа не найден: $DUMP" >&2
  exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Контейнер $CONTAINER не запущен. Сначала: docker compose up -d" >&2
  exit 1
fi

echo "Импорт $DUMP → $CONTAINER/$DB …"
docker exec -i "$CONTAINER" mariadb -u"$USER" -p"$PASS" "$DB" < "$DUMP"
echo "Готово. Дальше: npm run db:setup  (web_* таблицы и аккаунты маркета)"
