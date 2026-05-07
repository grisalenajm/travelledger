FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── development ───────────────────────────────────────────
FROM base AS development
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

# ── builder ───────────────────────────────────────────────
FROM base AS builder
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── production ────────────────────────────────────────────
FROM base AS production
COPY --from=builder /install /usr/local
COPY . .
RUN groupadd --system --gid 1001 appgroup \
    && useradd --system --uid 1001 --gid 1001 appuser \
    && chown -R appuser:appgroup /app
USER appuser
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
