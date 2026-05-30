FROM python:3.12-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

# ── development ───────────────────────────────────────────
FROM base AS development
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt watchfiles
COPY . .
CMD ["python", "main.py"]

# ── builder ───────────────────────────────────────────────
FROM base AS builder
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# ── production ────────────────────────────────────────────
FROM base AS production
COPY --from=builder /install /usr/local
COPY . .
EXPOSE 8080
CMD ["python", "main.py"]
