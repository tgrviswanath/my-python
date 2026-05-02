"""Output formatting for pygrep."""

import json
import sys
from pathlib import Path
from searcher import FileResult


class Colors:
    RESET   = '\033[0m'
    BOLD    = '\033[1m'
    RED     = '\033[31m'
    GREEN   = '\033[32m'
    YELLOW  = '\033[33m'
    BLUE    = '\033[34m'
    CYAN    = '\033[36m'


class Formatter:
    def __init__(
        self,
        show_line_numbers: bool = False,
        colorize: bool = False,
        json_output: bool = False,
        files_only: bool = False,
        count_only: bool = False,
    ):
        self.show_line_numbers = show_line_numbers
        self.colorize = colorize and sys.stdout.isatty()
        self.json_output = json_output
        self.files_only = files_only
        self.count_only = count_only

    def _color(self, text: str, color: str) -> str:
        if self.colorize:
            return f'{color}{text}{Colors.RESET}'
        return text

    def output(self, results: list[FileResult]) -> None:
        if self.json_output:
            self._output_json(results)
        elif self.files_only:
            for r in results:
                print(r.path)
        elif self.count_only:
            for r in results:
                print(f'{r.path}:{r.match_count}')
        else:
            self._output_text(results)

    def _output_text(self, results: list[FileResult]) -> None:
        for file_result in results:
            filename = self._color(str(file_result.path), Colors.BOLD + Colors.GREEN)
            for match in file_result.matches:
                # Context before
                for ctx_line in match.context_before:
                    prefix = f'{filename}-' if len(results) > 1 else '-'
                    print(f'{prefix}{ctx_line}')

                # Match line
                prefix = f'{filename}:' if len(results) > 1 else ''
                if self.show_line_numbers:
                    lineno = self._color(str(match.line_number), Colors.CYAN)
                    print(f'{prefix}{lineno}:{match.line}')
                else:
                    print(f'{prefix}{match.line}')

                # Context after
                for ctx_line in match.context_after:
                    prefix = f'{filename}-' if len(results) > 1 else '-'
                    print(f'{prefix}{ctx_line}')

    def _output_json(self, results: list[FileResult]) -> None:
        data = [
            {
                'file': str(r.path),
                'match_count': r.match_count,
                'matches': [
                    {
                        'line_number': m.line_number,
                        'line': m.line,
                        'context_before': m.context_before,
                        'context_after': m.context_after,
                    }
                    for m in r.matches
                ],
            }
            for r in results
        ]
        print(json.dumps(data, indent=2))
