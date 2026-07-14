# HR Agent Backend — Dockerfile for Production Deployment
# Suitable for Railway, Render, Fly.io, etc.

# ── Base Image ────────────────────────────────────────────────────────────────
FROM python:3.12-slim

# ── System Dependencies ────────────────────────────────────────────────────────
# Install system packages required for build-essential, postgresql client, and libmagic (required by python-magic)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    libmagic1 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ── Environment Variables ──────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# ── Working Directory ──────────────────────────────────────────────────────────
WORKDIR /app

# ── Python Dependencies ────────────────────────────────────────────────────────
# Copy and install python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy Application Code ──────────────────────────────────────────────────────
# Copy alembic configurations and source code
COPY alembic.ini .
COPY alembic/ ./alembic/
COPY app/ ./app/
COPY scripts/ ./scripts/

# ── Ports & Startup ────────────────────────────────────────────────────────────
# Expose default port
EXPOSE 8080

# Start server reading PORT from environment variable (Railway overrides this dynamically)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
