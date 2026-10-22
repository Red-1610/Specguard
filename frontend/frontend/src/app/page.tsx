"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, 
  Activity, 
  Zap, 
  FileCode2, 
  GitBranch, 
  LogOut, 
  Github, 
  FolderGit2,
  Copy,
  Check,
  Search,
  Layers,
  Sparkles,
  Bot,
  AlertTriangle,
  CheckCircle2,
  TestTube2,
  HelpCircle
} from "lucide-react";
import BubbleGraph from "../components/BubbleGraph";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/lib/supabase";

interface ImpactSite {
  file_path: string;
  line_number: number;
  context_type: string;
  symbol: string;
  code_snippet: string;
}

interface BlastReport {
  repository: string;
  root_symbol: string;
  impact_score: number;
  risk_level: string;
  affected_files: string[];
  impact_sites: ImpactSite[];
  mermaid_graph?: string;
  total_python_files_indexed: number;
}

interface AgentAnalysis {
  model_used: string;
  executive_summary: string;
  breaking_change_risks: string[];
  recommended_tests: string[];
  suggested_mitigations: string[];
}

const getApiUrl = () => {
  const raw = process.env.NEXT_PUBLIC_API_URL || "";
  if (typeof window !== "undefined" && window.location.protocol === "https:" && raw.startsWith("http://")) {
    return "";
  }
  return raw || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://127.0.0.1:8000" : "");
};

export default function Dashboard() {
  const { user, token, signout, loading: authLoading } = useAuth();
  const router = useRouter();

  // Target repository inputs
  const [repoUrl, setRepoUrl] = useState("");
  const [symbol, setSymbol] = useState("");
  const [originFile, setOriginFile] = useState("");

  const [report, setReport] = useState<BlastReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Table filtering and copy states
  const [tableFilter, setTableFilter] = useState("");
  const [copiedType, setCopiedType] = useState<"files" | "summary" | null>(null);

  // Amazon Bedrock Agent states
  const [changeIntent, setChangeIntent] = useState("");
  const [agentLoading, setAgentLoading] = useState(false);
  const [agentAnalysis, setAgentAnalysis] = useState<AgentAnalysis | null>(null);
  const [agentError, setAgentError] = useState("");
  const [copiedTest, setCopiedTest] = useState<string | null>(null);

  // Route protection
  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/signin");
    }
  }, [token, authLoading, router]);

  const runRealAudit = async () => {
    if (!repoUrl.trim() || !symbol.trim()) return;
    setLoading(true);
    setErrorMessage("");
    setAgentAnalysis(null);
    setAgentError("");

    try {
      const apiUrl = getApiUrl();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? token;
      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const res = await fetch(`${apiUrl}/api/audit/real-repo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          repo_url: repoUrl.trim(), 
          symbol: symbol.trim(), 
          origin_file: originFile.trim() 
        }),
      });

      const responseText = await res.text();
      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          `Backend returned unexpected HTTP ${res.status}: ${
            responseText.slice(0, 140) || res.statusText
          }`
        );
      }

      if (!res.ok) {
        throw new Error(data.detail || "Audit execution failed");
      }

      setReport(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to communicate with audit engine.");
    } finally {
      setLoading(false);
    }
  };

  const runBedrockAgent = async () => {
    if (!report) return;
    setAgentLoading(true);
    setAgentError("");

    try {
      const apiUrl = getApiUrl();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token ?? token;
      if (!accessToken) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const res = await fetch(`${apiUrl}/api/audit/explain-agent`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          repository: report.repository,
          root_symbol: report.root_symbol,
          affected_files: report.affected_files,
          impact_sites: report.impact_sites,
          impact_score: report.impact_score,
          risk_level: report.risk_level,
          change_intent: changeIntent.trim(),
        }),
      });

      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(`Agent returned HTTP ${res.status}: ${text.slice(0, 120)}`);
      }

      if (!res.ok) {
        throw new Error(data.detail || "Agent analysis failed");
      }

      setAgentAnalysis(data);
    } catch (err: any) {
      setAgentError(err.message || "Failed to invoke Bedrock Agent.");
    } finally {
      setAgentLoading(false);
    }
  };

  const handleCopyAffectedFiles = () => {
    if (!report) return;
    const content = report.affected_files.join("\n");
    void navigator.clipboard.writeText(content);
    setCopiedType("files");
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleCopySummary = () => {
    if (!report) return;
    const summary = `SpecGuard Blast Radius Report
Repository: ${report.repository}
Root Symbol: ${report.root_symbol}
Assessed Risk: ${report.risk_level}
Blast Score: ${report.impact_score}
Affected Files (${report.affected_files.length}):
${report.affected_files.map((f) => `- ${f}`).join("\n")}`;
    void navigator.clipboard.writeText(summary);
    setCopiedType("summary");
    setTimeout(() => setCopiedType(null), 1800);
  };

  const handleCopyTestCommand = (cmd: string) => {
    void navigator.clipboard.writeText(cmd);
    setCopiedTest(cmd);
    setTimeout(() => setCopiedTest(null), 1800);
  };

  const filteredSites = useMemo(() => {
    if (!report) return [];
    if (!tableFilter.trim()) return report.impact_sites;
    const q = tableFilter.toLowerCase();
    return report.impact_sites.filter(
      (site) =>
        site.file_path.toLowerCase().includes(q) ||
        site.context_type.toLowerCase().includes(q) ||
        site.code_snippet.toLowerCase().includes(q)
    );
  }, [report, tableFilter]);

  if (authLoading || !token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#07090e] font-mono text-xs text-slate-500">
        Checking authentication session...
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-rose-500/30 selection:text-rose-200 overflow-x-hidden">
      {/* Background Glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.15),transparent)] pointer-events-none" />

      <main className="relative max-w-6xl mx-auto px-6 py-8 space-y-8">
        
        {/* Navigation Bar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 p-[1px] shadow-lg shadow-rose-500/20">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-white">SpecGuard</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 font-semibold">
                  AST BLAST RADIUS ENGINE
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-semibold">
                  BEDROCK AI powered by AWS
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Git Clone, Static AST Traversal & Bedrock Break Prediction</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-mono block">LOGGED IN AS</span>
              <span className="text-xs font-semibold text-slate-200">{user}</span>
            </div>
            <button
              onClick={signout}
              className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg transition hover:text-rose-300 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" /> Sign Out
            </button>
          </div>
        </header>

        {/* Real Codebase Target Panel */}
        <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 shadow-2xl backdrop-blur-md space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
              <Github className="w-4 h-4 text-rose-400" /> Target Public GitHub Repository
            </h2>
            <span className="text-[11px] text-slate-400 font-mono">
              Live clone & AST reference extraction
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Repo Input */}
            <div className="md:col-span-1 space-y-1">
              <label className="text-[11px] font-mono text-slate-400">GitHub Repo URL or owner/repo</label>
              <div className="relative">
                <FolderGit2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  placeholder="https://github.com/owner/repo or owner/repo"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Symbol Identifier */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400">Target Identifier Symbol</label>
              <div className="relative">
                <GitBranch className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => setSymbol(e.target.value)}
                  placeholder="e.g. parse_headers or UserProfile"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none transition"
                />
              </div>
            </div>

            {/* Origin File */}
            <div className="space-y-1">
              <label className="text-[11px] font-mono text-slate-400">Origin File (To Exclude)</label>
              <div className="relative">
                <FileCode2 className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={originFile}
                  onChange={(e) => setOriginFile(e.target.value)}
                  placeholder="e.g. config.py or utils.py (optional)"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none transition"
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex justify-between items-center pt-1">
            <span className="text-[11px] text-slate-500 font-mono">
              Clones shallow tree & computes AST references without mock data
            </span>
            <button
              onClick={runRealAudit}
              disabled={loading || !repoUrl.trim() || !symbol.trim()}
              className="bg-gradient-to-r from-rose-600 to-rose-500 hover:from-rose-500 hover:to-rose-400 text-white font-medium px-6 py-2.5 rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/20 transition cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Activity className="w-4 h-4 animate-spin" />
                  <span>Cloning & Analyzing Live AST...</span>
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  <span>Analyze Real Codebase</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Real Blast Report View */}
        {report && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Stats Header */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Assessed Risk</span>
                <div className={`mt-1 text-xl font-bold font-mono ${
                  report.risk_level === "CRITICAL"
                    ? "text-rose-400"
                    : report.risk_level === "MEDIUM"
                    ? "text-amber-400"
                    : "text-emerald-400"
                }`}>
                  {report.risk_level}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Blast Score</span>
                <div className="mt-1 text-xl font-bold text-slate-100 font-mono">
                  {report.impact_score}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Affected Files</span>
                <div className="mt-1 text-xl font-bold text-indigo-400 font-mono">
                  {report.affected_files.length}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase tracking-wider">Real Files Traversed</span>
                <div className="mt-1 text-xl font-bold text-amber-400 font-mono">
                  {report.total_python_files_indexed} .py files
                </div>
              </div>
            </div>

            {/* Interactive bubble graph */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden p-6 shadow-xl backdrop-blur-md">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-rose-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Interactive Blast-Radius Graph
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAffectedFiles}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-700 hover:text-white transition"
                    title="Copy affected files list"
                  >
                    {copiedType === "files" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Affected Files</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopySummary}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-700 hover:text-white transition"
                    title="Copy full markdown report"
                  >
                    {copiedType === "summary" ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-400" />
                        <span className="text-emerald-400">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy Summary</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <BubbleGraph
                rootSymbol={report.root_symbol}
                originFile={originFile}
                affectedFiles={report.affected_files}
                impactSites={report.impact_sites}
              />

              <div className="mt-4 flex flex-wrap items-center justify-center gap-5 text-[10px] text-slate-500 font-mono">
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]" /> Root Symbol
                </span>
                <span className="flex items-center gap-1.5">
                  <i className="h-2.5 w-2.5 rounded-full bg-indigo-400" /> Downstream File
                </span>
                <span className="text-slate-500">· Click any bubble to inspect source lines</span>
              </div>
            </div>

            {/* 🤖 Amazon Bedrock AI Impact Agent Section */}
            <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-slate-950 via-slate-900/90 to-rose-950/20 p-6 shadow-2xl backdrop-blur-md space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400 shadow-md">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">AI Impact Agent</h3>
                      <span className="rounded-full border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 font-mono text-[9px] font-semibold text-rose-300">
                        Amazon Nova Pro · Converse API
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      Synthesizes AST references into breaking change predictions and targeted pytest suites
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={runBedrockAgent}
                  disabled={agentLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-rose-600/25 transition disabled:opacity-50 cursor-pointer"
                >
                  {agentLoading ? (
                    <>
                      <Activity className="h-3.5 w-3.5 animate-spin" />
                      <span>Synthesizing with Bedrock...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Run AI Impact Agent</span>
                    </>
                  )}
                </button>
              </div>

              {/* Optional Developer Change Intent Input */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono text-slate-400 flex items-center gap-1.5">
                  <span>Planned Change Description</span>
                  <span className="text-[10px] text-slate-500">(Optional context to guide break prediction)</span>
                </label>
                <input
                  type="text"
                  value={changeIntent}
                  onChange={(e) => setChangeIntent(e.target.value)}
                  placeholder="e.g. Modifying Config initializer arguments, making connection pooling async, or deprecating attributes"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-4 py-2 text-xs font-mono text-slate-200 placeholder-slate-600 focus:border-rose-500 focus:outline-none transition"
                />
              </div>

              {agentError && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-xs text-rose-300">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-400" />
                  <span>{agentError}</span>
                </div>
              )}

              {/* Agent Analysis Results */}
              {agentAnalysis && (
                <div className="space-y-4 pt-2 animate-in fade-in duration-300">
                  {/* Model Tag */}
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Engine: <strong className="text-rose-300">{agentAnalysis.model_used}</strong></span>
                    <span className="text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Synthesis Complete
                    </span>
                  </div>

                  {/* Executive Summary */}
                  <div className="rounded-xl border border-rose-500/20 bg-slate-950/70 p-4">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold block mb-1">
                      Executive Impact Summary
                    </span>
                    <p className="text-xs leading-relaxed text-slate-200">
                      {agentAnalysis.executive_summary}
                    </p>
                  </div>

                  {/* Two-column layout: Breaking Risks & Recommended Tests */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Breaking Change Vulnerabilities */}
                    <div className="rounded-xl border border-amber-500/20 bg-amber-950/10 p-4 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1.5">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Breaking Change Risks
                      </span>
                      <ul className="space-y-1.5 text-xs text-slate-300">
                        {agentAnalysis.breaking_change_risks.map((risk, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-amber-400 shrink-0" />
                            <span>{risk}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Recommended Regression Tests */}
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-4 space-y-2">
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold flex items-center gap-1.5">
                        <TestTube2 className="h-3.5 w-3.5 text-emerald-400" /> Recommended Test Commands
                      </span>
                      <div className="space-y-2 font-mono text-[11px]">
                        {agentAnalysis.recommended_tests.map((cmd, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-slate-300"
                          >
                            <span className="truncate text-emerald-300">{cmd}</span>
                            <button
                              type="button"
                              onClick={() => handleCopyTestCommand(cmd)}
                              className="shrink-0 text-slate-500 hover:text-slate-200 transition"
                              title="Copy test command"
                            >
                              {copiedTest === cmd ? (
                                <Check className="h-3.5 w-3.5 text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Mitigation Checklist */}
                  <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 space-y-2">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-bold block mb-1">
                      Remediation & Review Checklist
                    </span>
                    <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300">
                      {agentAnalysis.suggested_mitigations.map((mit, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-rose-400 shrink-0 mt-0.5" />
                          <span>{mit}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
            </div>

            {/* Downstream Call Sites from actual cloned files */}
            <div className="rounded-2xl bg-slate-900/60 border border-slate-800 overflow-hidden shadow-xl backdrop-blur-md">
              <div className="px-6 py-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FileCode2 className="w-4 h-4 text-rose-400" />
                  <span className="text-xs font-semibold text-slate-200">
                    Live Source Reference Matches ({report.impact_sites.length})
                  </span>
                </div>
                {report.impact_sites.length > 0 && (
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
                    <input
                      type="text"
                      value={tableFilter}
                      onChange={(e) => setTableFilter(e.target.value)}
                      placeholder="Filter by file, type or code..."
                      className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-[11px] text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Cloned File Path</th>
                      <th className="py-2.5 px-3 font-semibold">Line</th>
                      <th className="py-2.5 px-3 font-semibold">Context</th>
                      <th className="py-2.5 px-4 font-semibold">Source Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                    {filteredSites.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-8 text-center text-slate-500">
                          {tableFilter ? "No references match your filter query." : "No references detected."}
                        </td>
                      </tr>
                    ) : (
                      filteredSites.map((site, idx) => (
                        <tr key={`${site.file_path}-${site.line_number}-${idx}`} className="hover:bg-slate-800/30 transition">
                          <td className="py-2.5 px-4 text-emerald-400">{site.file_path}</td>
                          <td className="py-2.5 px-3 text-slate-400">{site.line_number}</td>
                          <td className="py-2.5 px-3 text-slate-400">
                            <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] text-indigo-300 border border-slate-700/60">
                              {site.context_type}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 text-rose-300 whitespace-pre overflow-x-auto max-w-xl">
                            {site.code_snippet}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}