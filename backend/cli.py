#!/usr/bin/env python3
"""
SpecGuard CLI — Deterministic AST Blast-Radius Code Auditor.
Usage:
  python cli.py --symbol Config --repo https://github.com/encode/uvicorn --origin config.py
  python cli.py --symbol parse_headers --path ./my_project
  python cli.py --symbol Config --repo encode/uvicorn --format json
  python cli.py --symbol Config --path ./my_project --exit-code
"""

import sys
import os
import json
import shutil
import tempfile
import argparse
import subprocess
from typing import Optional
from dataclasses import asdict

# Ensure backend package can be imported regardless of execution path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from engine.ast_tracer import ASTTracer, BlastRadiusReport
from engine.bedrock_agent import BedrockImpactAgent

# ANSI Colors
CYAN = "\033[96m"
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BOLD = "\033[1m"
DIM = "\033[2m"
RESET = "\033[0m"

BANNER = f"""{RED}{BOLD}
   ███████╗██████╗ ███████╗ ██████╗  ██████╗ ██╗   ██╗ █████╗ ██████╗ ██████╗ 
   ██╔════╝██╔══██╗██╔════╝██╔════╝ ██╔════╝ ██║   ██║██╔══██╗██╔══██╗██╔══██╗
   ███████╗██████╔╝█████╗  ██║      ██║  ███╗██║   ██║███████║██████╔╝██║  ██║
   ╚════██║██╔═══╝ ██╔══╝  ██║      ██║   ██║██║   ██║██╔══██║██╔══██╗██║  ██║
   ███████║██║     ███████╗╚██████╔╝╚██████╔╝╚██████╔╝██║  ██║██║  ██║██████╔╝
   ╚══════╝╚═╝     ╚══════╝ ╚═════╝  ╚═════╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚═════╝ 
{RESET}{DIM}               AI-Assisted AST Blast-Radius Impact Analyzer{RESET}
"""

def clone_repo(repo_url: str, pat: Optional[str] = None) -> str:
    """Clones repository into a temporary directory."""
    norm_url = repo_url.strip().rstrip("/")
    if not norm_url.startswith("http://") and not norm_url.startswith("https://"):
        norm_url = f"https://github.com/{norm_url}"
    if not norm_url.endswith(".git"):
        norm_url = f"{norm_url}.git"

    clone_url = norm_url
    if pat and "github.com" in norm_url and not norm_url.startswith("https://x-access-token:"):
        clone_url = norm_url.replace("https://github.com/", f"https://x-access-token:{pat}@github.com/")

    temp_dir = tempfile.mkdtemp(prefix="specguard_cli_")
    cmd = ["git", "clone", "--depth", "1", "--", clone_url, temp_dir]

    sys.stderr.write(f"{CYAN}Cloning {norm_url} (shallow --depth 1)...{RESET}\n")
    proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, timeout=60)
    if proc.returncode != 0:
        shutil.rmtree(temp_dir, ignore_errors=True)
        err = proc.stderr.strip() or "Repository not found or private."
        raise RuntimeError(f"Git clone failed: {err}")

    return temp_dir

def render_pretty(report: BlastRadiusReport, target_desc: str, total_files: int):
    print(BANNER)
    print(f"{BOLD}Target:{RESET} {target_desc}")
    print(f"{BOLD}Root Symbol:{RESET} {CYAN}{report.root_symbol}{RESET}")
    print(f"{BOLD}Python Files Indexed:{RESET} {total_files}")
    print("─" * 70)

    # Risk badge
    if report.risk_level == "CRITICAL":
        risk_color = RED
    elif report.risk_level == "MEDIUM":
        risk_color = YELLOW
    else:
        risk_color = GREEN

    print(f"Assessed Risk: {risk_color}{BOLD}{report.risk_level}{RESET}  │  Blast Score: {BOLD}{report.impact_score}{RESET}  │  Affected Files: {BOLD}{len(report.affected_files)}{RESET}  │  Total References: {BOLD}{len(report.impact_sites)}{RESET}")
    print("─" * 70)

    if not report.affected_files:
        print(f"\n{GREEN}✓ No downstream references found.{RESET}")
        print(f"{DIM}The symbol appears unused outside the specified origin.{RESET}\n")
        return

    print(f"\n{BOLD}Affected Files ({len(report.affected_files)}):{RESET}")
    file_groups = {}
    for site in report.impact_sites:
        file_groups.setdefault(site.file_path, []).append(site)

    for f_path in report.affected_files:
        hits = file_groups.get(f_path, [])
        print(f"  • {BOLD}{f_path}{RESET} {DIM}({len(hits)} reference{'s' if len(hits) != 1 else ''}){RESET}")

    print(f"\n{BOLD}Live Source Reference Matches ({len(report.impact_sites)}):{RESET}")
    for idx, site in enumerate(report.impact_sites, start=1):
        print(f"\n  {DIM}[{idx}]{RESET} {CYAN}{site.file_path}{RESET}:{BOLD}{site.line_number}{RESET} {DIM}({site.context_type}){RESET}")
        print(f"      {site.code_snippet}")

    print("\n" + "─" * 70 + "\n")

def render_markdown(report: BlastRadiusReport, target_desc: str) -> str:
    lines = [
        f"### SpecGuard Blast Radius Report: `{report.root_symbol}`",
        "",
        f"- **Target:** `{target_desc}`",
        f"- **Assessed Risk:** **{report.risk_level}** (Score: {report.impact_score})",
        f"- **Affected Files:** {len(report.affected_files)}",
        f"- **Total References:** {len(report.impact_sites)}",
        "",
        "#### Affected Files",
        "",
    ]
    for f in report.affected_files:
        count = sum(1 for s in report.impact_sites if s.file_path == f)
        lines.append(f"- `{f}` ({count} reference{'s' if count != 1 else ''})")

    lines.append("")
    lines.append("#### Evidence Sites")
    lines.append("")
    lines.append("| File | Line | Type | Snippet |")
    lines.append("| :--- | :--- | :--- | :--- |")
    for s in report.impact_sites:
        clean_snippet = s.code_snippet.replace("|", "\\|")
        lines.append(f"| `{s.file_path}` | {s.line_number} | `{s.context_type}` | `{clean_snippet}` |")

    return "\n".join(lines)

def main():
    parser = argparse.ArgumentParser(
        description="SpecGuard CLI: Static AST blast-radius code impact analyzer for Python repositories."
    )
    target_group = parser.add_mutually_exclusive_group(required=True)
    target_group.add_argument(
        "--repo", "-r",
        help="Public GitHub repository URL (e.g. 'https://github.com/encode/uvicorn' or 'encode/uvicorn')"
    )
    target_group.add_argument(
        "--path", "-p",
        help="Path to a local codebase directory to index directly"
    )

    parser.add_argument(
        "--symbol", "-s",
        required=True,
        help="Target identifier symbol to trace (class, function, variable, or module)"
    )
    parser.add_argument(
        "--origin", "-o",
        default="",
        help="Origin file defining the symbol to exclude from downstream references (e.g. 'config.py')"
    )
    parser.add_argument(
        "--format", "-f",
        choices=["pretty", "json", "markdown"],
        default="pretty",
        help="Output format (default: 'pretty')"
    )
    parser.add_argument(
        "--github-token", "-t",
        default=os.getenv("GITHUB_PAT"),
        help="GitHub Personal Access Token for authenticated clone (or set GITHUB_PAT env var)"
    )
    parser.add_argument(
        "--agent", "-a",
        action="store_true",
        help="Run Amazon Bedrock AI Agent to synthesize break predictions and test recommendations"
    )
    parser.add_argument(
        "--intent", "-i",
        default="",
        help="Optional description of your planned code changes (passed to Bedrock agent)"
    )
    parser.add_argument(
        "--exit-code",
        action="store_true",
        help="Return exit code 1 if risk is CRITICAL, 2 if MEDIUM, 0 if LOW (useful for CI/CD gates)"
    )

    args = parser.parse_args()

    temp_dir: Optional[str] = None
    target_path: str = ""
    target_desc: str = ""

    try:
        if args.repo:
            temp_dir = clone_repo(args.repo, pat=args.github_token)
            target_path = temp_dir
            target_desc = args.repo
        else:
            target_path = os.path.abspath(args.path)
            if not os.path.isdir(target_path):
                sys.stderr.write(f"{RED}Error: Directory does not exist: {target_path}{RESET}\n")
                sys.exit(1)
            target_desc = target_path

        sys.stderr.write(f"{DIM}Parsing Abstract Syntax Trees and resolving symbols...{RESET}\n")
        tracer = ASTTracer(target_path)
        report = tracer.trace_symbol(args.symbol, origin_file=args.origin)

        agent_result = None
        if args.agent:
            sys.stderr.write(f"{CYAN}Running Amazon Bedrock AI Impact Agent...{RESET}\n")
            agent = BedrockImpactAgent()
            agent_result = agent.analyze_blast_radius(
                repository=target_desc,
                root_symbol=args.symbol,
                affected_files=report.affected_files,
                impact_sites=[s.to_dict() if hasattr(s, "to_dict") else asdict(s) for s in report.impact_sites],
                impact_score=report.impact_score,
                risk_level=report.risk_level,
                change_intent=args.intent
            )

        if args.format == "json":
            out = report.to_dict()
            out["target"] = target_desc
            out["total_python_files_indexed"] = len(tracer.file_index)
            if agent_result:
                out["agent_analysis"] = agent_result.to_dict()
            print(json.dumps(out, indent=2))
        elif args.format == "markdown":
            md = render_markdown(report, target_desc)
            if agent_result:
                md += f"\n\n### 🤖 AI Impact Analysis ({agent_result.model_used})\n\n"
                md += f"**Executive Summary:** {agent_result.executive_summary}\n\n"
                md += "#### Breaking Change Risks:\n" + "\n".join(f"- {r}" for r in agent_result.breaking_change_risks) + "\n\n"
                md += "#### Recommended Tests:\n" + "\n".join(f"- `{t}`" for t in agent_result.recommended_tests) + "\n\n"
                md += "#### Suggested Mitigations:\n" + "\n".join(f"- {m}" for m in agent_result.suggested_mitigations)
            print(md)
        else:
            render_pretty(report, target_desc, len(tracer.file_index))
            if agent_result:
                print(f"{CYAN}{BOLD}═" * 70)
                print(f"  🤖 AMAZON BEDROCK IMPACT AGENT ({agent_result.model_used})")
                print("═" * 70 + f"{RESET}\n")
                print(f"{BOLD}Executive Summary:{RESET}\n{agent_result.executive_summary}\n")
                
                print(f"{BOLD}{YELLOW}Breaking Change Risks:{RESET}")
                for risk in agent_result.breaking_change_risks:
                    print(f"  ⚠️  {risk}")
                
                print(f"\n{BOLD}{GREEN}Recommended Regression Tests:{RESET}")
                for test in agent_result.recommended_tests:
                    print(f"  🧪 {test}")
                
                print(f"\n{BOLD}Suggested Mitigations & Checklist:{RESET}")
                for mit in agent_result.suggested_mitigations:
                    print(f"  ✓  {mit}")
                print("\n" + "─" * 70 + "\n")

        if args.exit_code:
            if report.risk_level == "CRITICAL":
                sys.exit(1)
            elif report.risk_level == "MEDIUM":
                sys.exit(2)
            else:
                sys.exit(0)

    except Exception as e:
        sys.stderr.write(f"{RED}SpecGuard Error: {e}{RESET}\n")
        sys.exit(1)
    finally:
        if temp_dir and os.path.exists(temp_dir):
            shutil.rmtree(temp_dir, ignore_errors=True)

if __name__ == "__main__":
    main()
