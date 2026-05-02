"""In-memory database for the Task Manager API."""

from datetime import datetime, timezone
from typing import Optional
from models import Task, TaskCreate, TaskUpdate, Priority, Status


class InMemoryDatabase:
    """Thread-safe in-memory task store."""

    def __init__(self):
        self._tasks: dict[int, Task] = {}
        self._next_id = 1

    def _now(self) -> datetime:
        return datetime.now(timezone.utc)

    def create(self, data: TaskCreate) -> Task:
        task = Task(
            id=self._next_id,
            created_at=self._now(),
            updated_at=self._now(),
            **data.model_dump(),
        )
        self._tasks[self._next_id] = task
        self._next_id += 1
        return task

    def get(self, task_id: int) -> Optional[Task]:
        return self._tasks.get(task_id)

    def list(
        self,
        status: Optional[Status] = None,
        priority: Optional[Priority] = None,
        tag: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[Task], int]:
        tasks = list(self._tasks.values())

        if status:
            tasks = [t for t in tasks if t.status == status]
        if priority:
            tasks = [t for t in tasks if t.priority == priority]
        if tag:
            tasks = [t for t in tasks if tag.lower() in t.tags]

        total = len(tasks)
        start = (page - 1) * page_size
        return tasks[start:start + page_size], total

    def update(self, task_id: int, data: TaskUpdate) -> Optional[Task]:
        task = self._tasks.get(task_id)
        if task is None:
            return None
        updates = data.model_dump(exclude_unset=True)
        updated = task.model_copy(update={**updates, 'updated_at': self._now()})
        self._tasks[task_id] = updated
        return updated

    def delete(self, task_id: int) -> bool:
        if task_id in self._tasks:
            del self._tasks[task_id]
            return True
        return False

    def count(self) -> int:
        return len(self._tasks)


# Global instance (in production, use dependency injection)
db = InMemoryDatabase()
