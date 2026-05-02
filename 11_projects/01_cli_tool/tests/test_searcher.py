"""Tests for pygrep searcher."""

import pytest
from pathlib import Path
import tempfile
import os
import sys

sys.path.insert(0, str(Path(__file__).parent.parent))
from searcher import Searcher, FileResult


@pytest.fixture
def temp_dir():
    with tempfile.TemporaryDirectory() as tmpdir:
        yield Path(tmpdir)


@pytest.fixture
def sample_files(temp_dir):
    files = {
        'hello.py': 'def hello():\n    print("Hello, World!")\n\nhello()\n',
        'main.py': 'import hello\n\nif __name__ == "__main__":\n    hello.hello()\n',
        'notes.txt': 'TODO: fix the bug\nDone: write tests\nTODO: add docs\n',
        'binary.bin': b'\x00\x01\x02\x03',
    }
    for name, content in files.items():
        path = temp_dir / name
        if isinstance(content, bytes):
            path.write_bytes(content)
        else:
            path.write_text(content)
    return temp_dir


class TestSearcher:
    def test_basic_search(self, sample_files):
        s = Searcher('hello')
        results = s.search(sample_files, recursive=False)
        filenames = {r.path.name for r in results}
        assert 'hello.py' in filenames
        assert 'main.py' in filenames

    def test_case_insensitive(self, sample_files):
        s = Searcher('HELLO', ignore_case=True)
        results = s.search(sample_files, recursive=False)
        assert len(results) > 0

    def test_extension_filter(self, sample_files):
        s = Searcher('TODO', extensions=['txt'])
        results = s.search(sample_files, recursive=False)
        assert all(r.path.suffix == '.txt' for r in results)

    def test_no_match(self, sample_files):
        s = Searcher('XYZNOTFOUND')
        results = s.search(sample_files, recursive=False)
        assert results == []

    def test_binary_files_skipped(self, sample_files):
        s = Searcher('.')
        results = s.search(sample_files, recursive=False)
        filenames = {r.path.name for r in results}
        assert 'binary.bin' not in filenames

    def test_match_count(self, sample_files):
        s = Searcher('TODO')
        results = s.search(sample_files, recursive=False)
        assert len(results) == 1
        assert results[0].match_count == 2

    def test_context_lines(self, sample_files):
        s = Searcher('print', context_lines=1)
        results = s.search(sample_files, recursive=False)
        match = results[0].matches[0]
        assert len(match.context_before) == 1
        assert len(match.context_after) == 1

    def test_max_results(self, sample_files):
        s = Searcher('.', max_results=1)
        results = s.search(sample_files, recursive=False)
        for r in results:
            assert r.match_count <= 1

    def test_recursive_search(self, temp_dir):
        subdir = temp_dir / 'subdir'
        subdir.mkdir()
        (subdir / 'nested.py').write_text('nested_function()\n')
        (temp_dir / 'root.py').write_text('root_function()\n')

        s = Searcher('function')
        results = s.search(temp_dir, recursive=True)
        filenames = {r.path.name for r in results}
        assert 'nested.py' in filenames
        assert 'root.py' in filenames

    def test_regex_pattern(self, sample_files):
        s = Searcher(r'def \w+\(')
        results = s.search(sample_files, recursive=False)
        assert len(results) >= 1


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
