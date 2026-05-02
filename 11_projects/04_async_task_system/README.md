# Project 04 — Async Task System

A production-grade async task queue using asyncio.

## Features
- Priority queue with async workers
- Task retry with exponential backoff
- Timeout handling
- Progress tracking
- Graceful shutdown

## Architecture
```
async_tasks/
├── queue.py         ← Priority task queue
├── worker.py        ← Async worker pool
├── tasks.py         ← Task definitions
└── scheduler.py     ← Task scheduler
```

## Trade-offs
- In-process queue: fast but not persistent (use Redis/Celery for production)
- asyncio: single-threaded but handles thousands of I/O-bound tasks
- For CPU-bound tasks: use ProcessPoolExecutor inside async
