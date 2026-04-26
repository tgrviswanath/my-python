"""Tests for the data pipeline."""

import sys
from pathlib import Path
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from pipeline import Pipeline, PipelineStats
from extractors import ListExtractor, CSVExtractor
from transformers import (
    FilterTransformer, MapTransformer, RenameTransformer,
    SelectTransformer, CastTransformer, AddFieldTransformer,
    DeduplicateTransformer,
)
from loaders import ListLoader


def make_pipeline(data, transformers=None, loader=None):
    loader = loader or ListLoader()
    return Pipeline(
        extractor=ListExtractor(data),
        transformers=transformers or [],
        loader=loader,
        skip_errors=True,
    ), loader


class TestExtractors:
    def test_list_extractor(self):
        data = [{'a': 1}, {'a': 2}, {'a': 3}]
        pipeline, loader = make_pipeline(data)
        stats = pipeline.run()
        assert stats.extracted == 3
        assert stats.loaded == 3
        assert loader.records == data

    def test_empty_extractor(self):
        pipeline, loader = make_pipeline([])
        stats = pipeline.run()
        assert stats.extracted == 0
        assert stats.loaded == 0


class TestTransformers:
    def test_filter_transformer(self):
        data = [{'x': i} for i in range(10)]
        pipeline, loader = make_pipeline(
            data,
            transformers=[FilterTransformer(lambda r: r['x'] % 2 == 0)]
        )
        stats = pipeline.run()
        assert stats.loaded == 5
        assert all(r['x'] % 2 == 0 for r in loader.records)

    def test_map_transformer(self):
        data = [{'x': 1}, {'x': 2}, {'x': 3}]
        pipeline, loader = make_pipeline(
            data,
            transformers=[MapTransformer(lambda r: {**r, 'x': r['x'] * 2})]
        )
        pipeline.run()
        assert loader.records == [{'x': 2}, {'x': 4}, {'x': 6}]

    def test_rename_transformer(self):
        data = [{'old_name': 'Alice', 'age': 30}]
        pipeline, loader = make_pipeline(
            data,
            transformers=[RenameTransformer({'old_name': 'name'})]
        )
        pipeline.run()
        assert 'name' in loader.records[0]
        assert 'old_name' not in loader.records[0]

    def test_select_transformer(self):
        data = [{'a': 1, 'b': 2, 'c': 3}]
        pipeline, loader = make_pipeline(
            data,
            transformers=[SelectTransformer(['a', 'c'])]
        )
        pipeline.run()
        assert loader.records[0] == {'a': 1, 'c': 3}

    def test_cast_transformer(self):
        data = [{'age': '30', 'score': '95.5', 'name': 'Alice'}]
        pipeline, loader = make_pipeline(
            data,
            transformers=[CastTransformer({'age': int, 'score': float})]
        )
        pipeline.run()
        r = loader.records[0]
        assert r['age'] == 30
        assert r['score'] == 95.5
        assert r['name'] == 'Alice'

    def test_add_field_transformer(self):
        data = [{'first': 'Alice', 'last': 'Smith'}]
        pipeline, loader = make_pipeline(
            data,
            transformers=[AddFieldTransformer('full_name', lambda r: f"{r['first']} {r['last']}")]
        )
        pipeline.run()
        assert loader.records[0]['full_name'] == 'Alice Smith'

    def test_deduplicate_transformer(self):
        data = [{'id': 1, 'x': 'a'}, {'id': 2, 'x': 'b'}, {'id': 1, 'x': 'c'}]
        pipeline, loader = make_pipeline(
            data,
            transformers=[DeduplicateTransformer('id')]
        )
        stats = pipeline.run()
        assert stats.loaded == 2
        assert stats.skipped == 1

    def test_chained_transformers(self):
        data = [{'name': 'alice', 'age': '25', 'score': '90'},
                {'name': 'bob',   'age': '17', 'score': '85'},
                {'name': 'carol', 'age': '30', 'score': '95'}]
        pipeline, loader = make_pipeline(data, transformers=[
            CastTransformer({'age': int, 'score': float}),
            FilterTransformer(lambda r: r['age'] >= 18),
            MapTransformer(lambda r: {**r, 'name': r['name'].title()}),
            AddFieldTransformer('grade', lambda r: 'A' if r['score'] >= 90 else 'B'),
        ])
        stats = pipeline.run()
        assert stats.loaded == 2
        assert stats.skipped == 1
        names = [r['name'] for r in loader.records]
        assert 'Alice' in names
        assert 'Carol' in names


class TestPipelineStats:
    def test_stats_accuracy(self):
        data = [{'x': i} for i in range(10)]
        pipeline, loader = make_pipeline(
            data,
            transformers=[FilterTransformer(lambda r: r['x'] < 5)]
        )
        stats = pipeline.run()
        assert stats.extracted == 10
        assert stats.loaded == 5
        assert stats.skipped == 5
        assert stats.errors == 0
        assert stats.duration_seconds > 0

    def test_error_handling_skip(self):
        def bad_transform(r):
            if r['x'] == 5:
                raise ValueError('Bad value')
            return r

        data = [{'x': i} for i in range(10)]
        pipeline, loader = make_pipeline(
            data,
            transformers=[MapTransformer(bad_transform)]
        )
        stats = pipeline.run()
        assert stats.errors == 1
        assert stats.loaded == 9

    def test_throughput(self):
        data = [{'x': i} for i in range(1000)]
        pipeline, loader = make_pipeline(data)
        stats = pipeline.run()
        assert stats.throughput > 0


if __name__ == '__main__':
    pytest.main([__file__, '-v'])
