# syntax=docker/dockerfile:1
# ═══════════════════════════════════════════════════════════════════
# OptiFleet B2B — Rust API Dockerfile
# Multi-stage: build în imagine mare, rulare în imagine minimală
# Imagine finală: ~15MB (vs ~1GB pentru Python echivalent)
# ═══════════════════════════════════════════════════════════════════

# Stage 1: Builder
FROM rust:latest AS builder

WORKDIR /build

# Optimizare cache: compilare dependențe separat de cod sursă
COPY Cargo.toml ./
# Creează src dummy pentru generate-lockfile și pre-compilare dependențe
RUN mkdir src && echo "fn main() {}" > src/main.rs
RUN cargo generate-lockfile
# Compilare dependențe (cached dacă Cargo.toml nu se schimbă)
RUN cargo build --release

# Acum copiează sursele reale — invalidează cache-ul binarului nostru
# dar NU al dependențelor (rămân compiled)
COPY src ./src
RUN touch src/main.rs && cargo build --release

# Stage 2: Runtime minimal
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiază DOAR binarul compilat (~8MB)
COPY --from=builder /build/target/release/optifleet-api /app/optifleet-api

# Utilizator non-root
RUN useradd -m -u 1000 apiuser && chown -R apiuser:apiuser /app
USER apiuser

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/v1/health || exit 1

CMD ["/app/optifleet-api"]
