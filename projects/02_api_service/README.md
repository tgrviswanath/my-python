# Project 02 — API Service: Task Manager

A production-grade REST API built with FastAPI.

## Features
- CRUD operations for tasks
- Pydantic validation
- Dependency injection
- JWT authentication (structure)
- Async endpoints
- OpenAPI docs at `/docs`

## Architecture
```
api_service/
├── main.py          ← FastAPI app + startup
├── models.py        ← Pydantic schemas
├── database.py      ← In-memory DB (swap for SQLAlchemy)
├── routes/
│   ├── tasks.py     ← Task endpoints
│   └── auth.py      ← Auth endpoints
├── dependencies.py  ← DI: get_db, get_current_user
└── tests/
    └── test_api.py
```

## Run
```bash
pip install fastapi uvicorn httpx pytest pytest-asyncio
uvicorn main:app --reload
# API docs: http://localhost:8000/docs
```

## Trade-offs
- In-memory storage: fast but not persistent (swap for PostgreSQL + SQLAlchemy)
- No real JWT: add python-jose for production
- Sync DB operations: use asyncpg/databases for true async

## Scaling
- Add Redis for caching
- Use connection pooling for DB
- Deploy behind nginx + multiple uvicorn workers
