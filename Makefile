.PHONY: help up down migrate dev-backend dev-frontend dev install-backend test lint

help:
	@echo "HR OS Development Commands"
	@echo "──────────────────────────────────────────────"
	@echo "  make up              Start all infrastructure containers"
	@echo "  make down            Stop all containers"
	@echo "  make migrate         Run database migrations"
	@echo "  make dev-backend     Start FastAPI development server"
	@echo "  make dev-frontend    Start Next.js development server"
	@echo "  make dev             Start both backend and frontend"
	@echo "  make test            Run backend tests"
	@echo "  make install-backend Install backend Python dependencies"
	@echo "──────────────────────────────────────────────"

up:
	docker compose up -d
	@echo "Waiting for services to be healthy..."
	@sleep 5
	@echo "✓ PostgreSQL, Redis, Qdrant, MinIO, Temporal are running"
	@echo "  Temporal UI: http://localhost:8080"
	@echo "  MinIO Console: http://localhost:9001"
	@echo "  Mailhog: http://localhost:8025"

down:
	docker compose down

migrate:
	cd backend && python -m alembic upgrade head
	@echo "✓ Database migrations complete"

install-backend:
	cd backend && pip install -r requirements.txt

dev-backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level info

dev-frontend:
	cd frontend && npm run dev

test:
	cd backend && python -m pytest tests/ -v --tb=short

lint:
	cd backend && python -m flake8 app/ --max-line-length=120
