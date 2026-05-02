"""
Streaming ETL Pipeline.

Usage:
    pipeline = Pipeline(
        extractor=CSVExtractor('data.csv'),
        transformers=[
            FilterTransformer(lambda r: r['age'] > 18),
            MapTransformer(lambda r: {**r, 'age': int(r['age'])}),
            RenameTransformer({'full_name': 'name'}),
        ],
        loader=JSONLoader('output.json'),
    )
    stats = pipeline.run()
"""

from __future__ import annotations
import logging
import time
from dataclasses import dataclass, field
from typing import Iterator, Protocol, TypeVar, Generic, Any

logger = logging.getLogger(__name__)

Record = dict[str, Any]


class Extractor(Protocol):
    def extract(self) -> Iterator[Record]: ...


class Transformer(Protocol):
    def transform(self, record: Record) -> Record | None: ...


class Loader(Protocol):
    def load(self, record: Record) -> None: ...
    def flush(self) -> None: ...


@dataclass
class PipelineStats:
    extracted: int = 0
    transformed: int = 0
    loaded: int = 0
    skipped: int = 0
    errors: int = 0
    duration_seconds: float = 0.0

    @property
    def throughput(self) -> float:
        if self.duration_seconds == 0:
            return 0.0
        return self.loaded / self.duration_seconds


class Pipeline:
    def __init__(
        self,
        extractor: Extractor,
        transformers: list[Transformer],
        loader: Loader,
        skip_errors: bool = True,
        batch_size: int = 1000,
    ):
        self.extractor = extractor
        self.transformers = transformers
        self.loader = loader
        self.skip_errors = skip_errors
        self.batch_size = batch_size

    def _apply_transformers(self, record: Record) -> Record | None:
        for transformer in self.transformers:
            result = transformer.transform(record)
            if result is None:
                return None  # filtered out
            record = result
        return record

    def run(self) -> PipelineStats:
        stats = PipelineStats()
        start = time.perf_counter()

        try:
            for record in self.extractor.extract():
                stats.extracted += 1
                try:
                    transformed = self._apply_transformers(record)
                    if transformed is None:
                        stats.skipped += 1
                        continue
                    stats.transformed += 1
                    self.loader.load(transformed)
                    stats.loaded += 1

                    if stats.loaded % self.batch_size == 0:
                        logger.info(f'Processed {stats.loaded} records...')

                except Exception as e:
                    stats.errors += 1
                    logger.error(f'Error processing record: {e}')
                    if not self.skip_errors:
                        raise

        finally:
            self.loader.flush()
            stats.duration_seconds = time.perf_counter() - start

        logger.info(
            f'Pipeline complete: extracted={stats.extracted}, '
            f'loaded={stats.loaded}, skipped={stats.skipped}, '
            f'errors={stats.errors}, '
            f'throughput={stats.throughput:.0f} rec/s'
        )
        return stats
