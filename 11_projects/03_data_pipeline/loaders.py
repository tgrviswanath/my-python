"""Loader implementations for the data pipeline."""

import csv
import json
import sys
from pathlib import Path
from pipeline import Record


class StdoutLoader:
    def load(self, record: Record) -> None:
        print(record)

    def flush(self) -> None:
        pass


class JSONLLoader:
    """Write records as JSON Lines."""
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._file = None

    def load(self, record: Record) -> None:
        if self._file is None:
            self._file = open(self.path, 'w', encoding='utf-8')
        self._file.write(json.dumps(record) + '\n')

    def flush(self) -> None:
        if self._file:
            self._file.flush()
            self._file.close()
            self._file = None


class CSVLoader:
    def __init__(self, path: str | Path):
        self.path = Path(path)
        self._file = None
        self._writer = None
        self._fieldnames = None

    def load(self, record: Record) -> None:
        if self._writer is None:
            self._fieldnames = list(record.keys())
            self._file = open(self.path, 'w', newline='', encoding='utf-8')
            self._writer = csv.DictWriter(self._file, fieldnames=self._fieldnames)
            self._writer.writeheader()
        self._writer.writerow(record)

    def flush(self) -> None:
        if self._file:
            self._file.flush()
            self._file.close()
            self._file = None


class ListLoader:
    """Collect records into a list (useful for testing)."""
    def __init__(self):
        self.records: list[Record] = []

    def load(self, record: Record) -> None:
        self.records.append(record)

    def flush(self) -> None:
        pass
