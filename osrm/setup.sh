#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# OptiFleet B2B — OSRM Moldova Setup
# Rulează O SINGURĂ DATĂ pentru pregătirea datelor de rutare
# Durată: ~3-8 minute (în funcție de hardware)
# ═══════════════════════════════════════════════════════════════════

set -e  # Stop la orice eroare

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$SCRIPT_DIR/data"
OSM_FILE="$DATA_DIR/moldova-latest.osm.pbf"
OSRM_IMAGE="ghcr.io/project-osrm/osrm-backend:latest"

echo "🗺️  OptiFleet OSRM Moldova Setup"
echo "================================="

# Creare director date
mkdir -p "$DATA_DIR"

# Step 1: Descarcă harta Moldova de pe Geofabrik
if [ -f "$OSM_FILE" ]; then
    echo "✅ moldova-latest.osm.pbf already exists, skipping download"
    echo "   (șterge fișierul dacă vrei să redownloadezi)"
else
    echo "📥 Downloading Moldova OSM data from Geofabrik..."
    curl -L \
        "https://download.geofabrik.de/europe/moldova-latest.osm.pbf" \
        -o "$OSM_FILE" \
        --progress-bar
    echo "✅ Downloaded: $OSM_FILE"
fi

# Step 2: Extract (procesare OSM → format OSRM)
echo ""
echo "⚙️  Step 1/3: Extracting OSM data (profil car)..."
docker run --rm \
    -v "$DATA_DIR:/data" \
    "$OSRM_IMAGE" \
    osrm-extract \
    -p /opt/car.lua \
    /data/moldova-latest.osm.pbf
echo "✅ Extract complete"

# Step 3: Partition (pregătire pentru algoritmul MLD)
echo ""
echo "⚙️  Step 2/3: Partitioning graph (MLD algorithm)..."
docker run --rm \
    -v "$DATA_DIR:/data" \
    "$OSRM_IMAGE" \
    osrm-partition \
    /data/moldova-latest.osrm
echo "✅ Partition complete"

# Step 4: Customize (finalizare grafului de rutare)
echo ""
echo "⚙️  Step 3/3: Customizing routing graph..."
docker run --rm \
    -v "$DATA_DIR:/data" \
    "$OSRM_IMAGE" \
    osrm-customize \
    /data/moldova-latest.osrm
echo "✅ Customize complete"

echo ""
echo "🎉 OSRM Moldova setup COMPLET!"
echo ""
echo "Pornire server OSRM:"
echo "   docker-compose up -d osrm"
echo ""
echo "Test rapidă:"
echo "   curl 'http://localhost:5000/route/v1/driving/28.8638,47.0105;27.9290,47.7630'"
echo "   (Chișinău → Bălți: ~94km)"
