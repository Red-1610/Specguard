import os
import sys
import json
import tempfile
import subprocess
import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from engine.ast_tracer import ASTTracer

def test_ast_tracer_captures_all_node_types():
    with tempfile.TemporaryDirectory() as tmpdir:
        test_file = os.path.join(tmpdir, "service.py")
        with open(test_file, "w") as f:
            f.write("""from uvicorn.config import Config
import Config as AliasConfig

class Config:
    def __init__(self):
        self.active = True

async def start_server():
    c = Config()
    return c
""")

        tracer = ASTTracer(tmpdir)
        report = tracer.trace_symbol("Config")

        assert report.root_symbol == "Config"
        assert len(report.affected_files) == 1
        assert "service.py" in report.affected_files[0]
        assert len(report.impact_sites) >= 4

        context_types = {site.context_type for site in report.impact_sites}
        assert "import_from" in context_types
        assert "import" in context_types
        assert "class_def" in context_types
        assert "symbol_reference" in context_types

def test_origin_file_suppression():
    with tempfile.TemporaryDirectory() as tmpdir:
        origin_path = os.path.join(tmpdir, "config.py")
        consumer_path = os.path.join(tmpdir, "app.py")

        with open(origin_path, "w") as f:
            f.write("class Config:\n    pass\n")

        with open(consumer_path, "w") as f:
            f.write("from config import Config\nc = Config()\n")

        tracer = ASTTracer(tmpdir)
        report = tracer.trace_symbol("Config", origin_file="config.py")

        # config.py should be excluded, app.py should be included
        assert len(report.affected_files) == 1
        assert "app.py" in report.affected_files[0]
        assert not any("config.py" in f for f in report.affected_files)

def test_cli_local_scan_json_output():
    with tempfile.TemporaryDirectory() as tmpdir:
        main_py = os.path.join(tmpdir, "main.py")
        with open(main_py, "w") as f:
            f.write("class TargetSymbol:\n    pass\n")

        cli_script = os.path.join(os.path.dirname(os.path.dirname(__file__)), "cli.py")
        res = subprocess.run(
            ["python3", cli_script, "--path", tmpdir, "--symbol", "TargetSymbol", "--format", "json"],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )

        assert res.returncode == 0
        data = json.loads(res.stdout)
        assert data["root_symbol"] == "TargetSymbol"
        assert len(data["affected_files"]) == 1
        assert len(data["impact_sites"]) == 1
        assert data["impact_sites"][0]["context_type"] == "class_def"

def test_bedrock_impact_agent():
    from engine.bedrock_agent import BedrockImpactAgent
    agent = BedrockImpactAgent()
    res = agent.analyze_blast_radius(
        repository="https://github.com/encode/uvicorn",
        root_symbol="Config",
        affected_files=["uvicorn/main.py", "uvicorn/server.py"],
        impact_sites=[{
            "file_path": "uvicorn/main.py",
            "line_number": 12,
            "context_type": "import_from",
            "code_snippet": "from uvicorn.config import Config"
        }],
        impact_score=20,
        risk_level="MEDIUM",
        change_intent="Deprecating bind argument in Config"
    )

    assert "Bedrock" in res.model_used
    assert "Config" in res.executive_summary
    assert len(res.breaking_change_risks) >= 1
    assert len(res.recommended_tests) >= 1
    assert len(res.suggested_mitigations) >= 1
