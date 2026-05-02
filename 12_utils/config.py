"""
Configuration management utility.

Supports: environment variables, .env files, YAML/JSON config files.
Priority: env vars > .env file > config file > defaults

Usage:
    from utils.config import Config

    config = Config()
    db_url = config.get('DATABASE_URL', default='sqlite:///app.db')
    debug  = config.get_bool('DEBUG', default=False)
    port   = config.get_int('PORT', default=8000)
"""

import json
import os
from pathlib import Path
from typing import Any, TypeVar

T = TypeVar('T')


class ConfigError(Exception):
    pass


class Config:
    """
    Layered configuration manager.

    Priority (highest to lowest):
    1. Environment variables
    2. .env file
    3. config.json / config.yaml
    4. Defaults
    """

    def __init__(
        self,
        env_file: str | None = '.env',
        config_file: str | None = None,
        prefix: str = '',
    ):
        self._data: dict[str, str] = {}
        self._prefix = prefix.upper()

        # Load config file first (lowest priority)
        if config_file:
            self._load_config_file(config_file)

        # Load .env file
        if env_file and Path(env_file).exists():
            self._load_env_file(env_file)

        # Environment variables override everything
        self._data.update(os.environ)

    def _load_env_file(self, path: str) -> None:
        """Parse a .env file."""
        with open(path, encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith('#'):
                    continue
                if '=' not in line:
                    continue
                key, _, value = line.partition('=')
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if key:
                    self._data[key] = value

    def _load_config_file(self, path: str) -> None:
        """Load JSON config file."""
        p = Path(path)
        if not p.exists():
            return
        with open(p, encoding='utf-8') as f:
            data = json.load(f)
        # Flatten nested dict with __ separator
        self._flatten(data, prefix='')

    def _flatten(self, d: dict, prefix: str) -> None:
        for key, val in d.items():
            full_key = f'{prefix}__{key}'.upper() if prefix else key.upper()
            if isinstance(val, dict):
                self._flatten(val, full_key)
            else:
                self._data[full_key] = str(val)

    def _resolve_key(self, key: str) -> str:
        """Apply prefix and normalize key."""
        key = key.upper()
        if self._prefix and not key.startswith(self._prefix):
            return f'{self._prefix}_{key}'
        return key

    def get(self, key: str, default: str | None = None, required: bool = False) -> str | None:
        """Get a string config value."""
        resolved = self._resolve_key(key)
        value = self._data.get(resolved)
        if value is None:
            if required:
                raise ConfigError(f'Required config key not found: {resolved}')
            return default
        return value

    def get_int(self, key: str, default: int | None = None) -> int | None:
        val = self.get(key)
        if val is None:
            return default
        try:
            return int(val)
        except ValueError:
            raise ConfigError(f'Config key {key}={val!r} is not a valid integer')

    def get_float(self, key: str, default: float | None = None) -> float | None:
        val = self.get(key)
        if val is None:
            return default
        try:
            return float(val)
        except ValueError:
            raise ConfigError(f'Config key {key}={val!r} is not a valid float')

    def get_bool(self, key: str, default: bool | None = None) -> bool | None:
        val = self.get(key)
        if val is None:
            return default
        return val.lower() in ('true', '1', 'yes', 'on')

    def get_list(self, key: str, separator: str = ',', default: list | None = None) -> list[str]:
        val = self.get(key)
        if val is None:
            return default or []
        return [item.strip() for item in val.split(separator) if item.strip()]

    def require(self, key: str) -> str:
        """Get a required config value — raises if missing."""
        return self.get(key, required=True)

    def as_dict(self) -> dict[str, str]:
        """Return all config as dict (masks secrets)."""
        result = {}
        for k, v in self._data.items():
            if any(secret in k.lower() for secret in ('password', 'secret', 'token', 'key')):
                result[k] = '***'
            else:
                result[k] = v
        return result

    def __repr__(self) -> str:
        return f'Config(keys={list(self._data.keys())[:5]}...)'


if __name__ == '__main__':
    # Demo
    config = Config()
    print(f'PATH: {config.get("PATH", "not set")[:50]}...')
    print(f'DEBUG: {config.get_bool("DEBUG", default=False)}')
    print(f'PORT: {config.get_int("PORT", default=8000)}')
    print(f'TAGS: {config.get_list("TAGS", default=["python", "api"])}')
