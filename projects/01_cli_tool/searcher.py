"""Core search logic for pygrep."""

import re
from dataclasses import dataclass, field
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Iterator


@dataclass
class Match:
    line_number: int
    line: str
    context_before: list[str] = field(default_factory=list)
    context_after: list[str] = field(default_factory=list)


@dataclass
class FileResult:
    path: Path
    matches: list[Match] = field(default_factory=list)

    @property
    def match_count(self) -> int:
        return len(self.matches)


class Searcher:
    def __init__(
        self,
        pattern: str,
        ignore_case: bool = False,
        extensions: list[str] | None = None,
        context_lines: int = 0,
        max_results: int | None = None,
    ):
        flags = re.IGNORECASE if ignore_case else 0
        self.regex = re.compile(pattern, flags)
        self.extensions = {f'.{e.lstrip(".")}' for e in extensions} if extensions else None
        self.context_lines = context_lines
        self.max_results = max_results

    def _should_search(self, path: Path) -> bool:
        if not path.is_file():
            return False
        if self.extensions and path.suffix not in self.extensions:
            return False
        # Skip binary files
        try:
            with open(path, 'rb') as f:
                chunk = f.read(1024)
                if b'\x00' in chunk:
                    return False
        except (PermissionError, OSError):
            return False
        return True

    def _search_file(self, path: Path) -> FileResult:
        result = FileResult(path=path)
        try:
            lines = path.read_text(encoding='utf-8', errors='replace').splitlines()
        except (PermissionError, OSError):
            return result

        for i, line in enumerate(lines):
            if self.regex.search(line):
                before = lines[max(0, i - self.context_lines):i]
                after  = lines[i + 1:i + 1 + self.context_lines]
                result.matches.append(Match(
                    line_number=i + 1,
                    line=line,
                    context_before=before,
                    context_after=after,
                ))
                if self.max_results and result.match_count >= self.max_results:
                    break
        return result

    def _collect_files(self, path: Path, recursive: bool) -> Iterator[Path]:
        if path.is_file():
            if self._should_search(path):
                yield path
        elif path.is_dir():
            glob = '**/*' if recursive else '*'
            for p in path.glob(glob):
                if self._should_search(p):
                    yield p

    def search(self, path: Path, recursive: bool = False) -> list[FileResult]:
        files = list(self._collect_files(path, recursive))
        results = []

        # Parallel search for large file sets
        if len(files) > 10:
            with ThreadPoolExecutor(max_workers=4) as executor:
                futures = {executor.submit(self._search_file, f): f for f in files}
                for future in as_completed(futures):
                    result = future.result()
                    if result.matches:
                        results.append(result)
        else:
            for f in files:
                result = self._search_file(f)
                if result.matches:
                    results.append(result)

        return sorted(results, key=lambda r: r.path)
