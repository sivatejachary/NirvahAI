# Multi-Tenant Autonomous AI HR Operating System

## Architecture
- **Backend**: Python / FastAPI / SQLAlchemy / Alembic / LangGraph
- **Frontend**: Next.js 14 / TypeScript / Tailwind CSS
- **Database**: PostgreSQL (source of truth) + Qdrant (vectors) + Redis (state/locks)
- **Storage**: MinIO (S3-compatible)
- **Orchestration**: Temporal (durable workflows)
- **Observability**: OpenTelemetry / Prometheus / Grafana

## Directory Layout
```
hr-agent/
├── backend/          FastAPI application
├── frontend/         Next.js application
├── infra/            Docker, CI/CD, infrastructure config
└── shared/           Shared schemas, event contracts
```

## Getting Started
```bash
cp .env.example .env
docker-compose up -d
make migrate
make dev
```
