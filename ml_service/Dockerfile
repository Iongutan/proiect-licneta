# syntax=docker/dockerfile:1
# OptiFleet ML — serviciu intern stateless (DBSCAN, CVRP, intenție Qwen3)
FROM python:3.12-slim AS builder
WORKDIR /build
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
 && pip install --no-cache-dir --prefix=/install -r requirements.txt

FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends libgomp1 \
 && rm -rf /var/lib/apt/lists/* \
 && useradd --create-home --uid 10001 ml
COPY --from=builder /install /usr/local
WORKDIR /app
COPY --chown=ml:ml main.py pytest.ini ./
COPY --chown=ml:ml optifleet_ml ./optifleet_ml
COPY --chown=ml:ml tests ./tests
USER ml
EXPOSE 8001
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/health', timeout=3)"
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--no-server-header"]
