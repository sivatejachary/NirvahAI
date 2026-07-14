# HR Agent Backend — Dockerfile for Production Deployment
FROM python:3.12-slim

# ── Environment Variables ──────────────────────────────────────────────────────
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

# ── Working Directory ──────────────────────────────────────────────────────────
WORKDIR /app

# ── Python Dependencies ────────────────────────────────────────────────────────
# Copy and install python requirements (relative to service root directory)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ── Copy Application Code ──────────────────────────────────────────────────────
# Copy all source files in the service root directory (relative to context)
COPY . .

# ── Ports & Startup ────────────────────────────────────────────────────────────
EXPOSE 8080

# Start server reading PORT from environment variable (Railway overrides this dynamically)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
