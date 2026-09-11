# syntax=docker/dockerfile:1
# ═══════════════════════════════════════════════════════════════════
# OptiFleet B2B — Python ML Service Dockerfile
# Multi-stage build: imagine finală mică, fără unelte de build
# ═══════════════════════════════════════════════════════════════════

# Stage 1: Builder
FROM python:3.12-slim AS builder

WORKDIR /build

# Instalare dependențe sistem (pentru compilare pachete native)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    libgeos-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiază și instalează dependențe Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt --target=/install

# Stage 2: Runtime
FROM python:3.12-slim AS runtime

WORKDIR /app

# Dependențe runtime (fără build tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copiază pachetele Python din builder
COPY --from=builder /install /usr/local/lib/python3.12/site-packages/

# Copiază codul sursă
COPY . .

# Utilizator non-root (securitate)
RUN useradd -m -u 1000 mlservice && chown -R mlservice:mlservice /app
USER mlservice

EXPOSE 8001

HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8001/health || exit 1

CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", \
     "--workers", "2", "--log-level", "info"]
