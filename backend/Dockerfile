# HR Agent Backend — Dockerfile for Production Deployment
FROM python:3.12-slim

# ── Environment Variables ──────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# ── Working Directory ──────────────────────────────────────────────────────────
WORKDIR /app

# ── Python Dependencies ────────────────────────────────────────────────────────
# Copy and install python requirements relative to repository root context
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy Application Code ──────────────────────────────────────────────────────
# Copy alembic configurations and source code directories without trailing slashes
COPY backend/alembic.ini .
COPY backend/alembic ./alembic
COPY backend/app ./app
COPY backend/scripts ./scripts

# ── Ports & Startup ────────────────────────────────────────────────────────────
EXPOSE 8080

# Start server reading PORT from environment variable (Railway overrides this dynamically)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
