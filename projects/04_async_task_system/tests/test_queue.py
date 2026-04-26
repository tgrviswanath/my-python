"""Tests for the async task system."""

import asyncio
import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from queue import AsyncTaskQueue, Task, TaskStatus
from worker import WorkerPool


# ── Helpers ───────────────────────────────────────────────────────────────────

async def simple_task(value: int) -> int:
    await asyncio.sleep(0.01)
    return value * 2

async def failing_task():
    await asyncio.sleep(0.01)
    raise ValueError('Task failed intentionally')

async def slow_task(delay: float = 1.0):
    await asyncio.sleep(delay)
    return 'done'


# ── Tests ─────────────────────────────────────────────────────────────────────

class TestAsyncTaskQueue:
    @pytest.mark.asyncio
    async def test_enqueue_returns_task(self):
        q = AsyncTaskQueue()
        task = await q.enqueue(simple_task, 5, name='test')
        assert task.id is not None
        assert task.name == 'test'
        assert task.status == TaskStatus.PENDING
        assert q.size == 1

    @pytest.mark.asyncio
    async def test_priority_ordering(self):
        q = AsyncTaskQueue()
        t_low  = await q.enqueue(simple_task, 1, priority=10)
        t_high = await q.enqueue(simple_task, 2, priority=1)
        t_med  = await q.enqueue(simple_task, 3, priority=5)

        first  = await q.dequeue()
        second = await q.dequeue()
        third  = await q.dequeue()

        assert first.priority == 1   # highest priority first
        assert second.priority == 5
        assert third.priority == 10

    @pytest.mark.asyncio
    async def test_get_task_by_id(self):
        q = AsyncTaskQueue()
        task = await q.enqueue(simple_task, 42)
        retrieved = q.get_task(task.id)
        assert retrieved is task

    @pytest.mark.asyncio
    async def test_get_nonexistent_task(self):
        q = AsyncTaskQueue()
        assert q.get_task('nonexistent') is None


class TestWorkerPool:
    @pytest.mark.asyncio
    async def test_basic_execution(self):
        q = AsyncTaskQueue()
        async with WorkerPool(q, num_workers=2) as pool:
            tasks = []
            for i in range(5):
                t = await q.enqueue(simple_task, i, name=f'task_{i}')
                tasks.append(t)
            await asyncio.wait_for(pool.wait_all(), timeout=5.0)

        for i, task in enumerate(tasks):
            assert task.status == TaskStatus.DONE
            assert task.result == i * 2

    @pytest.mark.asyncio
    async def test_failed_task_retries(self):
        q = AsyncTaskQueue()
        async with WorkerPool(q, num_workers=1) as pool:
            task = await q.enqueue(
                failing_task,
                name='failing',
                max_retries=2,
            )
            # Give time for retries
            await asyncio.sleep(0.5)

        assert task.status == TaskStatus.FAILED
        assert task.retries == 2

    @pytest.mark.asyncio
    async def test_task_timeout(self):
        q = AsyncTaskQueue()
        async with WorkerPool(q, num_workers=1) as pool:
            task = await q.enqueue(
                slow_task, 5.0,  # 5 second task
                name='slow',
                timeout=0.1,     # 0.1 second timeout
                max_retries=0,
            )
            await asyncio.sleep(0.5)

        assert task.status == TaskStatus.FAILED
        assert 'Timeout' in task.error

    @pytest.mark.asyncio
    async def test_concurrent_workers(self):
        q = AsyncTaskQueue()
        start = asyncio.get_event_loop().time()

        async with WorkerPool(q, num_workers=4) as pool:
            # 4 tasks each taking 0.1s — with 4 workers should take ~0.1s total
            for _ in range(4):
                await q.enqueue(slow_task, 0.1)
            await asyncio.wait_for(pool.wait_all(), timeout=2.0)

        elapsed = asyncio.get_event_loop().time() - start
        # Should be much less than 4 * 0.1 = 0.4s
        assert elapsed < 0.3, f'Expected parallel execution, took {elapsed:.2f}s'

    @pytest.mark.asyncio
    async def test_empty_queue(self):
        q = AsyncTaskQueue()
        async with WorkerPool(q, num_workers=2) as pool:
            # No tasks — should complete immediately
            await asyncio.wait_for(pool.wait_all(), timeout=1.0)

    @pytest.mark.asyncio
    async def test_get_all_tasks(self):
        q = AsyncTaskQueue()
        async with WorkerPool(q, num_workers=2) as pool:
            for i in range(3):
                await q.enqueue(simple_task, i)
            await asyncio.wait_for(pool.wait_all(), timeout=5.0)

        all_tasks = q.get_all_tasks()
        assert len(all_tasks) == 3
        assert all(t.status == TaskStatus.DONE for t in all_tasks)


if __name__ == '__main__':
    pytest.main([__file__, '-v', '--asyncio-mode=auto'])
