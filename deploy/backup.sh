#!/bin/sh
# Copia de seguridad diaria: base de datos + adjuntos. Conserva 14 días.
# Cron sugerido (root):  17 3 * * * /opt/taskzen/backup.sh >> /var/log/taskzen-backup.log 2>&1
set -eu
cd /opt/taskzen
DEST=/opt/taskzen/backups
STAMP=$(date +%Y%m%d-%H%M%S)
mkdir -p "$DEST"

docker compose exec -T postgres pg_dump -U taskzen -d taskzen --no-owner | gzip > "$DEST/db-$STAMP.sql.gz"
docker run --rm -v taskzen_uploads:/data:ro -v "$DEST":/out alpine tar czf "/out/uploads-$STAMP.tar.gz" -C /data .

# Un volcado vacío indica un fallo silencioso: no lo dejamos pasar.
[ "$(stat -c %s "$DEST/db-$STAMP.sql.gz")" -gt 1000 ] || { echo "backup de BD sospechosamente pequeño" >&2; exit 1; }

find "$DEST" -type f -mtime +14 -delete
echo "$(date -Is) backup ok: db-$STAMP"
