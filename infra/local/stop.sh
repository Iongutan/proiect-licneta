#!/usr/bin/env bash
# Oprește serviciile locale. Datele rămân în volumul Docker „optifleet-db-data”.
set -euo pipefail
cd "$(dirname "$0")/supabase" && docker compose stop
