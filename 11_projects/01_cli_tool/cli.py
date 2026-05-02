#!/usr/bin/env python3
"""
pygrep — A Python grep-like CLI tool.

Usage:
    python cli.py "pattern" [path] [options]
    python cli.py "def " . --ext py --recursive --color
    python cli.py "TODO" . -r -n -C 2
"""

import argparse
import sys
from pathlib import Path
from searcher import Searcher
from formatter import Formatter


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog='pygrep',
        description='Search for patterns in files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument('pattern', help='Search pattern (regex supported)')
    parser.add_argument('path', nargs='?', default='.', help='Path to search (default: .)')
    parser.add_argument('-r', '--recursive', action='store_true', help='Search recursively')
    parser.add_argument('-i', '--ignore-case', action='store_true', help='Case-insensitive search')
    parser.add_argument('-n', '--line-numbers', action='store_true', help='Show line numbers')
    parser.add_argument('-C', '--context', type=int, default=0, metavar='N', help='Show N context lines')
    parser.add_argument('--ext', nargs='+', default=None, metavar='EXT', help='File extensions to search (e.g. py js)')
    parser.add_argument('--color', action='store_true', help='Colorize output')
    parser.add_argument('--json', action='store_true', help='Output as JSON')
    parser.add_argument('-l', '--files-only', action='store_true', help='Only print filenames')
    parser.add_argument('-c', '--count', action='store_true', help='Print match count per file')
    parser.add_argument('--max-results', type=int, default=None, help='Maximum results to show')
    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    searcher = Searcher(
        pattern=args.pattern,
        ignore_case=args.ignore_case,
        extensions=args.ext,
        context_lines=args.context,
        max_results=args.max_results,
    )

    formatter = Formatter(
        show_line_numbers=args.line_numbers,
        colorize=args.color,
        json_output=args.json,
        files_only=args.files_only,
        count_only=args.count,
    )

    path = Path(args.path)
    if not path.exists():
        print(f'pygrep: {path}: No such file or directory', file=sys.stderr)
        return 2

    results = searcher.search(path, recursive=args.recursive)
    formatter.output(results)

    total_matches = sum(len(r.matches) for r in results)
    return 0 if total_matches > 0 else 1


if __name__ == '__main__':
    sys.exit(main())
