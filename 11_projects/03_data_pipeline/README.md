# Project 03 — Data Processing Pipeline

A streaming ETL pipeline: Extract → Transform → Load.

## Architecture
```
pipeline/
├── pipeline.py      ← Core pipeline engine
├── extractors.py    ← Data sources (CSV, JSON, API)
├── transformers.py  ← Data transformations
├── loaders.py       ← Data sinks (file, DB, stdout)
└── tests/
    └── test_pipeline.py
```

## Design Patterns Used
- **Iterator/Generator**: lazy streaming (no full dataset in memory)
- **Strategy**: pluggable extractors/transformers/loaders
- **Chain of Responsibility**: transformer pipeline
- **Context Manager**: resource cleanup

## Trade-offs
- Streaming vs batch: streaming uses O(1) memory but can't sort/group without buffering
- Type safety: uses TypeVar + Protocol for generic pipeline
- Error handling: configurable skip-on-error vs fail-fast
