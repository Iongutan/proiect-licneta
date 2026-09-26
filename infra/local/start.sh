#!/usr/bin/env bash
# Pornește din nou serviciile locale (după setup.sh).
set -euo pipefail
cd "$(dirname "$0")/supabase" && docker compose up -d
echo "Studio: http://localhost:8000   Aplicația: npm --prefix frontend run dev"
