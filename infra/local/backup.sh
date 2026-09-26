#!/usr/bin/env bash
# Backup complet al bazei de date locale într-un fișier comprimat.
# Păstrează ultimele 14 copii. Copiază periodic folderul backups/ pe un disc extern.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$HERE/backups"
file="$HERE/backups/optifleet-$(date +%Y%m%d-%H%M%S).dump"
docker exec supabase-db pg_dump -U postgres -d postgres -Fc --no-owner > "$file"
[[ -s "$file" ]] || { echo "Backup eșuat"; rm -f "$file"; exit 1; }
ls -1t "$HERE"/backups/optifleet-*.dump | tail -n +15 | xargs -r rm -f
echo "Backup: $file ($(du -h "$file" | cut -f1))"
echo "Restaurare: docker exec -i supabase-db pg_restore -U postgres -d postgres --clean --if-exists < \"$file\""
