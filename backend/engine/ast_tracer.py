import ast
import os
from typing import Dict, List, Set, Any
from dataclasses import dataclass, asdict

@dataclass
class ImpactSite:
    file_path: str
    line_number: int
    context_type: str
    symbol: str
    code_snippet: str

@dataclass
class BlastRadiusReport:
    root_symbol: str
    impact_score: int
    risk_level: str
    affected_files: List[str]
    impact_sites: List[ImpactSite]
    mermaid_graph: str

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class SymbolVisitor(ast.NodeVisitor):
    def __init__(self, file_path: str, source_lines: List[str]):
        self.file_path = file_path
        self.source_lines = source_lines
        self.references: List[ImpactSite] = []

    def _get_snippet(self, lineno: int) -> str:
        if 1 <= lineno <= len(self.source_lines):
            return self.source_lines[lineno - 1].strip()
        return ""

    def visit_Attribute(self, node: ast.Attribute):
        snippet = self._get_snippet(node.lineno)
        self.references.append(
            ImpactSite(
                file_path=self.file_path,
                line_number=node.lineno,
                context_type="attribute_access",
                symbol=node.attr,
                code_snippet=snippet
            )
        )
        self.generic_visit(node)

    def visit_Name(self, node: ast.Name):
        snippet = self._get_snippet(node.lineno)
        self.references.append(
            ImpactSite(
                file_path=self.file_path,
                line_number=node.lineno,
                context_type="symbol_reference",
                symbol=node.id,
                code_snippet=snippet
            )
        )
        self.generic_visit(node)

    def visit_FunctionDef(self, node: ast.FunctionDef):
        snippet = self._get_snippet(node.lineno)
        self.references.append(
            ImpactSite(
                file_path=self.file_path,
                line_number=node.lineno,
                context_type="function_def",
                symbol=node.name,
                code_snippet=snippet
            )
        )
        self.generic_visit(node)

class ASTTracer:
    def __init__(self, workspace_root: str):
        self.workspace_root = workspace_root
        self.file_index: Dict[str, List[ImpactSite]] = {}
        self._index_workspace()

    def _index_workspace(self):
        for root, _, files in os.walk(self.workspace_root):
            for file in files:
                if file.endswith(".py"):
                    full_path = os.path.join(root, file)
                    rel_path = os.path.relpath(full_path, self.workspace_root)
                    try:
                        with open(full_path, "r", encoding="utf-8") as f:
                            content = f.read()
                        source_lines = content.splitlines()
                        tree = ast.parse(content, filename=rel_path)
                        visitor = SymbolVisitor(rel_path, source_lines)
                        visitor.visit(tree)
                        self.file_index[rel_path] = visitor.references
                    except Exception:
                        continue

    def trace_symbol(self, target_symbol: str, origin_file: str = "") -> BlastRadiusReport:
        impacted_sites: List[ImpactSite] = []
        affected_files_set: Set[str] = set()

        for file_path, sites in self.file_index.items():
            if origin_file and (file_path == origin_file or os.path.basename(file_path) == os.path.basename(origin_file)):
                continue

            for site in sites:
                if site.symbol == target_symbol:
                    impacted_sites.append(site)
                    affected_files_set.add(file_path)

        affected_files = sorted(list(affected_files_set))
        num_hits = len(impacted_sites)

        if len(affected_files) >= 3 or num_hits >= 5:
            risk = "CRITICAL"
        elif len(affected_files) >= 1 or num_hits >= 2:
            risk = "MEDIUM"
        else:
            risk = "LOW"

        mermaid = self._generate_mermaid(target_symbol, origin_file, impacted_sites)

        return BlastRadiusReport(
            root_symbol=target_symbol,
            impact_score=num_hits * 10,
            risk_level=risk,
            affected_files=affected_files,
            impact_sites=impacted_sites,
            mermaid_graph=mermaid
        )

    def _generate_mermaid(self, symbol: str, origin_file: str, sites: List[ImpactSite]) -> str:
        origin_label = origin_file if origin_file else "Modified_Definition"
        lines = ["flowchart TD"]
        lines.append(f'    Root["{origin_label} :: {symbol}"]:::origin')

        file_groups: Dict[str, List[ImpactSite]] = {}
        for site in sites:
            file_groups.setdefault(site.file_path, []).append(site)

        for idx, (f_path, hits) in enumerate(file_groups.items()):
            node_id = f"Node_{idx}"
            hit_desc = f"{len(hits)} reference(s)"
            lines.append(f'    {node_id}["{f_path}<br/>({hit_desc})"]')
            lines.append(f'    Root -->|affects| {node_id}')

        lines.append("    classDef origin fill:#f43f5e,stroke:#9f1239,stroke-width:2px,color:#fff;")
        return "\n".join(lines)
