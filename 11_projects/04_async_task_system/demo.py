"""Demo: Async task system in action."""

import asyncio
import random
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s %(levelname)s %(message)s')

from queue import AsyncTaskQueue
from worker import WorkerPool


# ── Task definitions ──────────────────────────────────────────────────────────

async def fetch_data(url: str) -> dict:
    """Simulate an HTTP request."""
    await asyncio.sleep(random.uniform(0.1, 0.5))
    return {'url': url, 'status': 200, 'data': f'Response from {url}'}


async def process_record(record_id: int) -> dict:
    """Simulate data processing."""
    await asyncio.sleep(random.uniform(0.05, 0.2))
    return {'id': record_id, 'processed': True, 'value': record_id * 2}


async def flaky_task(task_id: int) -> str:
    """Task that sometimes fails (to demo retry)."""
    await asyncio.sleep(0.1)
    if random.random() < 0.5:
        raise ConnectionError(f'Task {task_id} connection failed')
    return f'Task {task_id} succeeded'


# ── Main demo ─────────────────────────────────────────────────────────────────

async def main():
    queue = AsyncTaskQueue()

    async with WorkerPool(queue, num_workers=3) as pool:
        # Enqueue tasks with different priorities
        tasks = []

        # High priority: fetch critical data
        for i in range(3):
            t = await queue.enqueue(
                fetch_data, f'https://api.example.com/critical/{i}',
                name=f'fetch_critical_{i}', priority=1,
            )
            tasks.append(t)

        # Normal priority: process records
        for i in range(5):
            t = await queue.enqueue(
                process_record, i,
                name=f'process_{i}', priority=5,
            )
            tasks.append(t)

        # Low priority: flaky tasks with retry
        for i in range(3):
            t = await queue.enqueue(
                flaky_task, i,
                name=f'flaky_{i}', priority=10, max_retries=2,
            )
            tasks.append(t)

        print(f'\nEnqueued {len(tasks)} tasks')
        print(f'Queue size: {queue.size}')

        # Wait for all tasks to complete
        await pool.wait_all()

    # Print results
    print('\n=== Results ===')
    all_tasks = queue.get_all_tasks()
    done    = [t for t in all_tasks if t.status.value == 'done']
    failed  = [t for t in all_tasks if t.status.value == 'failed']
    print(f'Done:   {len(done)}')
    print(f'Failed: {len(failed)}')

    for t in failed:
        print(f'  FAILED: {t.name} — {t.error}')


if __name__ == '__main__':
    asyncio.run(main())
