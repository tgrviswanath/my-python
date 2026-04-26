"""
Production-grade logging utility.

Usage:
    from utils.logger import get_logger
    logger = get_logger(__name__)
    logger.info('Starting process', extra={'user_id': 1})
"""

import logging
import logging.handlers
import json
import sys
import traceback
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'level':     record.levelname,
            'logger':    record.name,
            'message':   record.getMessage(),
            'module':    record.module,
            'function':  record.funcName,
            'line':      record.lineno,
        }

        # Add extra fields
        for key, val in record.__dict__.items():
            if key not in logging.LogRecord.__dict__ and not key.startswith('_'):
                log_data[key] = val

        # Add exception info
        if record.exc_info:
            log_data['exception'] = {
                'type':    record.exc_info[0].__name__ if record.exc_info[0] else None,
                'message': str(record.exc_info[1]),
                'traceback': traceback.format_exception(*record.exc_info),
            }

        return json.dumps(log_data, default=str)


class ColorFormatter(logging.Formatter):
    """Colored console formatter for development."""

    COLORS = {
        'DEBUG':    '\033[36m',   # cyan
        'INFO':     '\033[32m',   # green
        'WARNING':  '\033[33m',   # yellow
        'ERROR':    '\033[31m',   # red
        'CRITICAL': '\033[35m',   # magenta
    }
    RESET = '\033[0m'

    def format(self, record: logging.LogRecord) -> str:
        color = self.COLORS.get(record.levelname, '')
        record.levelname = f'{color}{record.levelname:8}{self.RESET}'
        return super().format(record)


def get_logger(
    name: str,
    level: str = 'INFO',
    log_file: str | None = None,
    json_format: bool = False,
) -> logging.Logger:
    """
    Get a configured logger.

    Args:
        name:        Logger name (use __name__)
        level:       Log level (DEBUG/INFO/WARNING/ERROR/CRITICAL)
        log_file:    Optional file path for file handler
        json_format: Use JSON format (for production/log aggregation)

    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger  # already configured

    logger.setLevel(getattr(logging, level.upper(), logging.INFO))

    # Console handler
    console = logging.StreamHandler(sys.stdout)
    if json_format:
        console.setFormatter(JSONFormatter())
    else:
        fmt = '%(asctime)s %(levelname)s %(name)s:%(lineno)d — %(message)s'
        console.setFormatter(ColorFormatter(fmt, datefmt='%H:%M:%S'))
    logger.addHandler(console)

    # File handler (rotating)
    if log_file:
        Path(log_file).parent.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=10 * 1024 * 1024,  # 10 MB
            backupCount=5,
            encoding='utf-8',
        )
        file_handler.setFormatter(JSONFormatter())
        logger.addHandler(file_handler)

    logger.propagate = False
    return logger


# Default application logger
log = get_logger('app')


if __name__ == '__main__':
    # Demo
    logger = get_logger('demo', level='DEBUG')
    logger.debug('Debug message')
    logger.info('Info message')
    logger.warning('Warning message')
    logger.error('Error message')

    try:
        1 / 0
    except ZeroDivisionError:
        logger.exception('Caught an exception')

    # JSON format
    json_logger = get_logger('demo.json', json_format=True)
    json_logger.info('Structured log', extra={'user_id': 42, 'action': 'login'})
