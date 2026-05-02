"""Async worker pool for task execution."""

import asyncio
import logging
from queue import AsyncTaskQueue, Task, TaskStatus

logger = logging.getLogger(__name__)


class AsyncWorker:
    def __init__(self, worker_id: int, queue: AsyncTaskQueue):
        self.worker_id = worker_id
        self.queue = queue
        self._running = False
        self._current_task: Task | None = None

    async def run(self):
        self._running = True
        logger.info(f'Worker {self.worker_id} started')
        while self._running:
            try:
                task = await asyncio.wait_for(self.queue.dequeue(), timeout=1.0)
                await self._execute(task)
                self.queue.task_done()
            except asyncio.TimeoutError:
                continue  # check _running flag
            except Exception as e:
                logger.error(f'Worker {self.worker_id} error: {e}')

    async def _execute(self, task: Task):
        self._current_task = task
        task.status = TaskStatus.RUNNING
        logger.info(f'Worker {self.worker_id} executing task {task.id} ({task.name})')

        try:
            task.result = await asyncio.wait_for(
                task.func(*task.args, **task.kwargs),
                timeout=task.timeout,
            )
            task.status = TaskStatus.DONE
            logger.info(f'Task {task.id} completed: {task.result}')

        except asyncio.TimeoutError:
            task.error = f'Timeout after {task.timeout}s'
            await self._handle_failure(task)

        except Exception as e:
            task.error = str(e)
            await self._handle_failure(task)

        finally:
            self._current_task = None

    async def _handle_failure(self, task: Task):
        if task.retries < task.max_retries:
            task.retries += 1
            delay = 2 ** task.retries  # exponential backoff
            logger.warning(f'Task {task.id} failed, retry {task.retries}/{task.max_retries} in {delay}s')
            await asyncio.sleep(delay)
            task.status = TaskStatus.PENDING
            await self.queue._queue.put(task)
        else:
            task.status = TaskStatus.FAILED
            logger.error(f'Task {task.id} failed permanently: {task.error}')

    def stop(self):
        self._running = False


class WorkerPool:
    def __init__(self, queue: AsyncTaskQueue, num_workers: int = 4):
        self.queue = queue
        self.num_workers = num_workers
        self.workers: list[AsyncWorker] = []
        self._tasks: list[asyncio.Task] = []

    async def start(self):
        for i in range(self.num_workers):
            worker = AsyncWorker(i, self.queue)
            self.workers.append(worker)
            task = asyncio.create_task(worker.run())
            self._tasks.append(task)
        logger.info(f'Worker pool started with {self.num_workers} workers')

    async def stop(self):
        for worker in self.workers:
            worker.stop()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        logger.info('Worker pool stopped')

    async def wait_all(self):
        await self.queue._queue.join()

    async def __aenter__(self):
        await self.start()
        return self

    async def __aexit__(self, *args):
        await self.stop()
