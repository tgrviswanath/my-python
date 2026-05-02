"""FastAPI Task Manager — main application."""

from contextlib import asynccontextmanager
from typing import Optional
from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from models import Task, TaskCreate, TaskUpdate, TaskList, Priority, Status, ErrorResponse
from database import InMemoryDatabase, db as _db


# ── Dependency Injection ──────────────────────────────────────────────────────

def get_db() -> InMemoryDatabase:
    return _db


# ── Lifespan ──────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: seed some data
    database = get_db()
    database.create(TaskCreate(title='Setup project', priority=Priority.HIGH, status=Status.DONE))
    database.create(TaskCreate(title='Write tests', priority=Priority.HIGH, tags=['testing']))
    database.create(TaskCreate(title='Deploy to staging', priority=Priority.MEDIUM))
    yield
    # Shutdown: cleanup if needed


# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title='Task Manager API',
    description='A production-grade task management REST API',
    version='1.0.0',
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=['http://localhost:3000'],
    allow_methods=['*'],
    allow_headers=['*'],
)


# ── Routes ────────────────────────────────────────────────────────────────────

@app.get('/health')
async def health():
    return {'status': 'ok', 'task_count': get_db().count()}


@app.post('/tasks', response_model=Task, status_code=201)
async def create_task(data: TaskCreate, database: InMemoryDatabase = Depends(get_db)):
    """Create a new task."""
    return database.create(data)


@app.get('/tasks', response_model=TaskList)
async def list_tasks(
    status:    Optional[Status]   = Query(None, description='Filter by status'),
    priority:  Optional[Priority] = Query(None, description='Filter by priority'),
    tag:       Optional[str]      = Query(None, description='Filter by tag'),
    page:      int                = Query(1, ge=1, description='Page number'),
    page_size: int                = Query(20, ge=1, le=100, description='Items per page'),
    database:  InMemoryDatabase   = Depends(get_db),
):
    """List tasks with optional filtering and pagination."""
    tasks, total = database.list(status=status, priority=priority, tag=tag, page=page, page_size=page_size)
    return TaskList(tasks=tasks, total=total, page=page, page_size=page_size)


@app.get('/tasks/{task_id}', response_model=Task)
async def get_task(task_id: int, database: InMemoryDatabase = Depends(get_db)):
    """Get a task by ID."""
    task = database.get(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail=f'Task {task_id} not found')
    return task


@app.patch('/tasks/{task_id}', response_model=Task)
async def update_task(
    task_id: int,
    data: TaskUpdate,
    database: InMemoryDatabase = Depends(get_db),
):
    """Partially update a task."""
    task = database.update(task_id, data)
    if task is None:
        raise HTTPException(status_code=404, detail=f'Task {task_id} not found')
    return task


@app.delete('/tasks/{task_id}', status_code=204)
async def delete_task(task_id: int, database: InMemoryDatabase = Depends(get_db)):
    """Delete a task."""
    if not database.delete(task_id):
        raise HTTPException(status_code=404, detail=f'Task {task_id} not found')


@app.get('/tasks/stats/summary')
async def task_stats(database: InMemoryDatabase = Depends(get_db)):
    """Get task statistics."""
    tasks, total = database.list(page_size=10000)
    by_status   = {}
    by_priority = {}
    for t in tasks:
        by_status[t.status.value]     = by_status.get(t.status.value, 0) + 1
        by_priority[t.priority.value] = by_priority.get(t.priority.value, 0) + 1
    return {'total': total, 'by_status': by_status, 'by_priority': by_priority}


if __name__ == '__main__':
    import uvicorn
    uvicorn.run('main:app', host='0.0.0.0', port=8000, reload=True)
