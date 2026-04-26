# Project 01 — CLI Tool: `pygrep`

A production-grade command-line file search tool (like `grep`) built with Python.

## Features
- Recursive file search with regex patterns
- Colored output, line numbers, context lines
- Multiple file type filters
- JSON output mode
- Performance: parallel file scanning

## Architecture
```
pygrep/
├── cli.py          ← argparse entry point
├── searcher.py     ← core search logic
├── formatter.py    ← output formatting
├── utils.py        ← helpers
└── tests/
    └── test_searcher.py
```

## Trade-offs
- Uses `re` module (pure Python) vs `ripgrep` (Rust, 10x faster)
- Single-threaded for simplicity; `ThreadPoolExecutor` for parallel scanning
- Memory: reads files line-by-line (streaming, not loading all into RAM)

## Scaling Considerations
- For very large codebases: use `mmap` for memory-mapped file reading
- Distributed search: split file list across workers
- Index-based search: build inverted index for repeated queries
