"""Async priority task queue."""

import asyncio
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Callable, Coroutine


class TaskStatus(str, Enum):
    PENDING   = 'pending'
    RUNNING   = 'running'
    DONE      = 'done'
    FAILED    = 'failed'
    CANCELLED = 'cancelled'


@dataclass(order=True)
class Task:
    priority: int                          # lower = higher priority
    created_at: datetime = field(compare=False, default_factory=lambda: datetime.now(timezone.utc))
    id: str              = field(compare=False, default_factory=lambda: str(uuid.uuid4())[:8])
    name: str            = field(compare=False, default='')
    func: Callable       = field(compare=False, default=None)
    args: tuple          = field(compare=False, default_factory=tuple)
    kwargs: dict         = field(compare=False, default_factory=dict)
    max_retries: int     = field(compare=False, default=3)
    timeout: float       = field(compare=False, default=30.0)
    retries: int         = field(compare=False, default=0)
    status: TaskStatus   = field(compare=False, default=TaskStatus.PENDING)
    result: Any          = field(compare=False, default=None)
    error: str           = field(compare=False, default=None)


class AsyncTaskQueue:
    def __init__(self):
        self._queue: asyncio.PriorityQueue = asyncio.PriorityQueue()
        self._tasks: dict[str, Task] = {}

    async def enqueue(
        self,
        func: Callable[..., Coroutine],
        *args,
        name: str = '',
        priority: int = 5,
        max_retries: int = 3,
        timeout: float = 30.0,
        **kwargs,
    ) -> Task:
        task = Task(
            priority=priority,
            name=name or func.__name__,
            func=func,
            args=args,
            kwargs=kwargs,
            max_retries=max_retries,
            timeout=timeout,
        )
        self._tasks[task.id] = task
        await self._queue.put(task)
        return task

    async def dequeue(self) -> Task:
        return await self._queue.get()

    def task_done(self):
        self._queue.task_done()

    def get_task(self, task_id: str) -> Task | None:
        return self._tasks.get(task_id)

    def get_all_tasks(self) -> list[Task]:
        return list(self._tasks.values())

    @property
    def size(self) -> int:
        return self._queue.qsize()
