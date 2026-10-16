import re
from typing import Dict, List, Set

class DiffParser:
    HUNK_HEADER_REGEX = re.compile(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@")
    IDENTIFIER_REGEX = re.compile(r"\b([a-zA-Z_][a-zA-Z0-9_]*)\b")
    PY_KEYWORDS = {
        "def", "class", "return", "import", "from", "as", "if", "elif", "else",
        "for", "while", "break", "continue", "pass", "try", "except", "finally",
        "raise", "with", "yield", "lambda", "async", "await", "None", "True", "False"
    }

    @classmethod
    def parse_patch(cls, patch_text: str) -> Dict[str, any]:
        deleted_lines = []
        added_lines = []
        current_old_line = 0
        current_new_line = 0

        for line in patch_text.splitlines():
            hunk_match = cls.HUNK_HEADER_REGEX.match(line)
            if hunk_match:
                current_old_line = int(hunk_match.group(1))
                current_new_line = int(hunk_match.group(3))
                continue

            if line.startswith("-") and not line.startswith("---"):
                deleted_lines.append((current_old_line, line[1:].strip()))
                current_old_line += 1
            elif line.startswith("+") and not line.startswith("+++"):
                added_lines.append((current_new_line, line[1:].strip()))
                current_new_line += 1
            elif not line.startswith("\\"):
                current_old_line += 1
                current_new_line += 1

        deleted_tokens = cls._extract_candidate_identifiers(deleted_lines)
        added_tokens = cls._extract_candidate_identifiers(added_lines)
        altered_symbols = list((deleted_tokens - added_tokens) | (added_tokens - deleted_tokens))

        return {
            "deleted_lines": deleted_lines,
            "added_lines": added_lines,
            "altered_symbols": altered_symbols
        }

    @classmethod
    def _extract_candidate_identifiers(cls, line_tuples: List[tuple]) -> Set[str]:
        tokens = set()
        for _, content in line_tuples:
            matches = cls.IDENTIFIER_REGEX.findall(content)
            for m in matches:
                if m not in cls.PY_KEYWORDS:
                    tokens.add(m)
        return tokens