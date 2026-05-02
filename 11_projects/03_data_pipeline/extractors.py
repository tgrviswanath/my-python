"""Extractor implementations for the data pipeline."""

import csv
import json
from pathlib import Path
from typing import Iterator
from pipeline import Record


class CSVExtractor:
    def __init__(self, path: str | Path, encoding: str = 'utf-8'):
        self.path = Path(path)
        self.encoding = encoding

    def extract(self) -> Iterator[Record]:
        with open(self.path, encoding=self.encoding, newline='') as f:
            reader = csv.DictReader(f)
            for row in reader:
                yield dict(row)


class JSONLExtractor:
    """JSON Lines format — one JSON object per line."""
    def __init__(self, path: str | Path):
        self.path = Path(path)

    def extract(self) -> Iterator[Record]:
        with open(self.path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line:
                    yield json.loads(line)


class ListExtractor:
    """Extract from an in-memory list (useful for testing)."""
    def __init__(self, data: list[Record]):
        self.data = data

    def extract(self) -> Iterator[Record]:
        yield from self.data


class GeneratorExtractor:
    """Extract from a generator function."""
    def __init__(self, gen_func):
        self.gen_func = gen_func

    def extract(self) -> Iterator[Record]:
        yield from self.gen_func()
