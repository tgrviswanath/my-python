"""Transformer implementations for the data pipeline."""

from typing import Any, Callable
from pipeline import Record


class FilterTransformer:
    """Keep records where predicate returns True."""
    def __init__(self, predicate: Callable[[Record], bool]):
        self.predicate = predicate

    def transform(self, record: Record) -> Record | None:
        return record if self.predicate(record) else None


class MapTransformer:
    """Apply a function to transform each record."""
    def __init__(self, func: Callable[[Record], Record]):
        self.func = func

    def transform(self, record: Record) -> Record | None:
        return self.func(record)


class RenameTransformer:
    """Rename fields: {'old_name': 'new_name'}."""
    def __init__(self, mapping: dict[str, str]):
        self.mapping = mapping

    def transform(self, record: Record) -> Record | None:
        return {self.mapping.get(k, k): v for k, v in record.items()}


class SelectTransformer:
    """Keep only specified fields."""
    def __init__(self, fields: list[str]):
        self.fields = set(fields)

    def transform(self, record: Record) -> Record | None:
        return {k: v for k, v in record.items() if k in self.fields}


class CastTransformer:
    """Cast field values to specified types: {'age': int, 'score': float}."""
    def __init__(self, casts: dict[str, type]):
        self.casts = casts

    def transform(self, record: Record) -> Record | None:
        result = dict(record)
        for field, cast_type in self.casts.items():
            if field in result and result[field] is not None:
                try:
                    result[field] = cast_type(result[field])
                except (ValueError, TypeError):
                    result[field] = None
        return result


class AddFieldTransformer:
    """Add a computed field."""
    def __init__(self, field_name: str, func: Callable[[Record], Any]):
        self.field_name = field_name
        self.func = func

    def transform(self, record: Record) -> Record | None:
        return {**record, self.field_name: self.func(record)}


class DeduplicateTransformer:
    """Remove duplicate records based on a key field."""
    def __init__(self, key: str):
        self.key = key
        self._seen: set = set()

    def transform(self, record: Record) -> Record | None:
        key_val = record.get(self.key)
        if key_val in self._seen:
            return None
        self._seen.add(key_val)
        return record
