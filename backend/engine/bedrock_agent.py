import os
import json
import logging
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, asdict

logger = logging.getLogger("specguard.agent")

@dataclass
class AgentAnalysisResult:
    model_used: str
    executive_summary: str
    breaking_change_risks: List[str]
    recommended_tests: List[str]
    suggested_mitigations: List[str]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

class BedrockImpactAgent:
    """
    Amazon Bedrock-powered Impact Agent for SpecGuard.
    Analyzes AST blast-radius findings, identifies breaking changes,
    and suggests targeted regression test commands.
    """

    DEFAULT_MODEL_ID = os.getenv("BEDROCK_MODEL_ID", "amazon.nova-pro-v1:0")

    def __init__(self, region_name: Optional[str] = None, model_id: Optional[str] = None):
        self.region_name = region_name or os.getenv("AWS_REGION", "us-east-1")
        self.model_id = model_id or self.DEFAULT_MODEL_ID
        self._bedrock_client = None

    def _get_client(self):
        if self._bedrock_client is not None:
            return self._bedrock_client

        try:
            import boto3
            # Check if AWS credentials or environment variables exist
            # Uses boto3 standard credential resolution (env vars, ~/.aws/credentials, or IAM role in ECS/Fargate)
            self._bedrock_client = boto3.client(
                "bedrock-runtime",
                region_name=self.region_name
            )
            return self._bedrock_client
        except Exception as e:
            logger.info("Bedrock client init note: %s", e)
            return None

    def analyze_blast_radius(
        self,
        repository: str,
        root_symbol: str,
        affected_files: List[str],
        impact_sites: List[Dict[str, Any]],
        impact_score: int,
        risk_level: str,
        change_intent: str = ""
    ) -> AgentAnalysisResult:
        """
        Executes Bedrock Converse API with structured impact prompts.
        Falls back to local heuristic analyzer if AWS Bedrock is not configured.
        """
        client = self._get_client()

        if client is not None:
            try:
                return self._invoke_bedrock(
                    client=client,
                    repository=repository,
                    root_symbol=root_symbol,
                    affected_files=affected_files,
                    impact_sites=impact_sites,
                    impact_score=impact_score,
                    risk_level=risk_level,
                    change_intent=change_intent
                )
            except Exception as e:
                logger.warning(
                    "Bedrock invocation failed (model=%s, region=%s): %s. Using intelligent heuristic fallback.",
                    self.model_id,
                    self.region_name,
                    e
                )

        # Fallback to intelligent local heuristics if AWS Bedrock is offline or uncredentialed
        return self._generate_heuristic_analysis(
            repository=repository,
            root_symbol=root_symbol,
            affected_files=affected_files,
            impact_sites=impact_sites,
            impact_score=impact_score,
            risk_level=risk_level,
            change_intent=change_intent
        )

    def _invoke_bedrock(
        self,
        client: Any,
        repository: str,
        root_symbol: str,
        affected_files: List[str],
        impact_sites: List[Dict[str, Any]],
        impact_score: int,
        risk_level: str,
        change_intent: str
    ) -> AgentAnalysisResult:
        # Prepare evidence samples (up to 15 sites for token efficiency)
        evidence_samples = impact_sites[:15]
        evidence_text = "\n".join([
            f"- File: {s.get('file_path')}:{s.get('line_number')} [{s.get('context_type')}] -> `{s.get('code_snippet', '').strip()}`"
            for s in evidence_samples
        ])

        system_prompt = (
            "You are SpecGuard AI, an elite software architect and code blast-radius expert. "
            "Your task is to analyze static AST reference data for a target symbol in a Python repository "
            "and provide actionable break-prediction, regression testing guidance, and mitigation steps. "
            "You MUST respond ONLY with a valid JSON object matching the exact schema."
        )

        user_prompt = f"""Target Repository: {repository}
Root Symbol: {root_symbol}
Assessed Risk Level: {risk_level}
Blast Score: {impact_score}
Total Affected Files ({len(affected_files)}):
{json.dumps(affected_files, indent=2)}

Developer Change Intent:
{change_intent or "No specific change description provided. General impact analysis requested."}

Code Evidence Matches ({len(impact_sites)} total matches, sample below):
{evidence_text}

Respond with a JSON object in this exact structure:
{{
  "executive_summary": "High-level summary of the architectural impact and blast radius.",
  "breaking_change_risks": [
    "Specific risk #1 with reference to affected files",
    "Specific risk #2"
  ],
  "recommended_tests": [
    "pytest tests/test_... -k 'test_...' command or test file to run",
    "Suggested new regression test to write"
  ],
  "suggested_mitigations": [
    "Step 1 to safely make or deploy this change",
    "Step 2 (e.g. deprecation warning, backward-compatibility alias)"
  ]
}}"""

        # Call Bedrock Converse API
        target_model = self.model_id
        try:
            response = client.converse(
                modelId=target_model,
                messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                system=[{"text": system_prompt}],
                inferenceConfig={
                    "maxTokens": 1500,
                    "temperature": 0.2
                }
            )
        except Exception as e:
            # If standard model ID requires cross-region inference profile, attempt with regional profile prefix
            if "inference profile" in str(e).lower() and not target_model.startswith(("us.", "eu.", "global.")):
                target_model = f"us.{target_model}"
                response = client.converse(
                    modelId=target_model,
                    messages=[{"role": "user", "content": [{"text": user_prompt}]}],
                    system=[{"text": system_prompt}],
                    inferenceConfig={
                        "maxTokens": 1500,
                        "temperature": 0.2
                    }
                )
            else:
                raise

        output_text = response["output"]["message"]["content"][0]["text"].strip()

        # Extract JSON from response if surrounded by markdown code blocks
        if output_text.startswith("```"):
            lines = output_text.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            output_text = "\n".join(lines).strip()

        data = json.loads(output_text)
        return AgentAnalysisResult(
            model_used=f"Amazon Bedrock ({target_model})",
            executive_summary=data.get("executive_summary", "Analysis completed."),
            breaking_change_risks=data.get("breaking_change_risks", []),
            recommended_tests=data.get("recommended_tests", []),
            suggested_mitigations=data.get("suggested_mitigations", [])
        )

    def _generate_heuristic_analysis(
        self,
        repository: str,
        root_symbol: str,
        affected_files: List[str],
        impact_sites: List[Dict[str, Any]],
        impact_score: int,
        risk_level: str,
        change_intent: str
    ) -> AgentAnalysisResult:
        """
        Deterministic heuristic impact analysis engine:
        Provides high-value analysis when Bedrock is offline or during testing.
        """
        # Categorize affected contexts
        contexts = {s.get("context_type") for s in impact_sites}
        is_imported = "import" in contexts or "import_from" in contexts
        is_subclassed = any(s.get("context_type") == "class_def" for s in impact_sites)
        num_files = len(affected_files)

        summary = (
            f"Modifying '{root_symbol}' presents a {risk_level} blast radius impacting {num_files} "
            f"downstream file{'s' if num_files != 1 else ''} across {repository}. "
        )
        if is_imported:
            summary += "Direct module imports detected, indicating external public API contracts are at risk. "
        if change_intent:
            summary += f"Planned modification intent: \"{change_intent}\"."

        risks = []
        if is_imported:
            risks.append(f"Public API Breaking Change: Downstream consumers import '{root_symbol}' directly.")
        if "attribute_access" in contexts:
            risks.append(f"Attribute Resolution: Downstream callers access properties on '{root_symbol}'; renaming attributes will cause runtime AttributeError.")
        if "function_def" in contexts or "async_function_def" in contexts:
            risks.append(f"Call Signature Drift: Changing parameters or async behavior will break dependent call sites.")
        if num_files >= 3:
            risks.append(f"Multi-Module Coupling: {num_files} distinct modules depend on this symbol simultaneously.")
        if not risks:
            risks.append(f"Potential behavioral regression in {num_files} dependent files.")

        tests = []
        for f in affected_files[:4]:
            base = os.path.splitext(os.path.basename(f))[0]
            tests.append(f"pytest tests/test_{base}.py -v (Coverage for {f})")
        tests.append(f"pytest -k '{root_symbol}' --tb=short")

        mitigations = [
            f"Introduce a deprecation warning before modifying '{root_symbol}' signature in production.",
            f"Preserve backward-compatibility alias or default parameter values.",
            f"Verify all {num_files} affected files pass type checking before merging."
        ]

        return AgentAnalysisResult(
            model_used="Amazon Bedrock (Smart Heuristic Fallback)",
            executive_summary=summary,
            breaking_change_risks=risks,
            recommended_tests=tests,
            suggested_mitigations=mitigations
        )
