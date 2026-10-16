"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Activity, 
  Terminal, 
  Zap, 
  FileCode2, 
  GitBranch, 
  LogOut, 
  Github, 
  FolderGit2
} from "lucide-react";
import MermaidChart from "../components/MermaidChart";
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
  mermaid_graph: string;
  total_python_files_indexed: number;
}

export default function Dashboard() {
  const { user, token, signout, loading: authLoading } = useAuth();
  const router = useRouter();

  // Real repo input states
  const [repoUrl, setRepoUrl] = useState("https://github.com/encode/uvicorn");
  const [symbol, setSymbol] = useState("Config");
  const [originFile, setOriginFile] = useState("config.py");

  const [report, setReport] = useState<BlastReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Route protection
  useEffect(() => {
    if (!authLoading && !token) {
      router.push("/signin");
    }
  }, [token, authLoading, router]);

  const runRealAudit = async () => {
    if (!repoUrl || !symbol) return;
    setLoading(true);
    setErrorMessage("");

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
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
          "Authorization": `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ 
          repo_url: repoUrl, 
          symbol: symbol, 
          origin_file: originFile 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Audit execution failed");
      setReport(data);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || !token) {
    return <div className="min-h-screen flex items-center justify-center font-mono text-sm text-slate-500">Checking session...</div>;
  }

  return (
    <div className="relative min-h-screen bg-[#07090e] text-slate-100 font-sans selection:bg-rose-500/30 selection:text-rose-200 overflow-x-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(225,29,72,0.15),transparent)] pointer-events-none" />

      <main className="relative max-w-6xl mx-auto px-6 py-10 space-y-8">
        
        {/* Navigation Bar */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-amber-600 p-[1px]">
              <div className="w-full h-full bg-slate-950 rounded-[11px] flex items-center justify-center">
                <ShieldAlert className="w-5 h-5 text-rose-500" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-white">SpecGuard</h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400">
                  REAL CODEBASE AUDITOR
                </span>
              </div>
              <p className="text-xs text-slate-400">Live Git Clone & AST Traversal Engine</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-[10px] text-slate-500 font-mono block">LOGGED IN AS</span>
              <span className="text-xs font-semibold text-slate-200">{user}</span>
            </div>
            <button
              onClick={signout}
              className="flex items-center gap-1.5 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 px-3 py-1.5 rounded-lg transition"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" /> Sign Out
            </button>
          </div>
        </header>

        {/* Real Codebase Target Panel */}
        <section className="rounded-2xl bg-slate-900/60 border border-slate-800 p-6 shadow-2xl backdrop-blur-md space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold flex items-center gap-2 text-slate-200">
              <Github className="w-4 h-4 text-rose-400" /> Target Public GitHub Repository
            </h2>
            <span className="text-[11px] font-mono text-slate-500">Clones live code without mock data</span>
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
                  placeholder="https://github.com/encode/uvicorn"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none"
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
                  placeholder="e.g. Config or parse_headers"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none"
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
                  placeholder="e.g. config.py"
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs font-mono text-slate-200 focus:border-rose-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-lg">
              {errorMessage}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={runRealAudit}
              disabled={loading}
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
              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Assessed Risk</span>
                <div className={`mt-1 text-xl font-bold ${report.risk_level === "CRITICAL" ? "text-rose-400" : "text-emerald-400"}`}>
                  {report.risk_level}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Blast Score</span>
                <div className="mt-1 text-xl font-bold text-slate-100 font-mono">
                  {report.impact_score}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Affected Files</span>
                <div className="mt-1 text-xl font-bold text-indigo-400 font-mono">
                  {report.affected_files.length}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-900/50 border border-slate-800">
                <span className="text-[10px] text-slate-400 font-mono uppercase">Real Files Traversed</span>
                <div className="mt-1 text-xl font-bold text-amber-400 font-mono">
                  {report.total_python_files_indexed} .py files
                </div>
              </div>
            </div>

            {/* Mermaid Graph */}
            {report.mermaid_graph && (
              <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden p-5">
                <span className="text-xs font-semibold text-slate-300 block mb-3">
                  Real Codebase Dependency Graph (Mermaid SVG)
                </span>
                <div className="bg-slate-950 p-4 rounded-lg">
                  <MermaidChart chart={report.mermaid_graph} />
                </div>
              </div>
            )}

            {/* Downstream Call Sites from actual cloned files */}
            <div className="rounded-xl bg-slate-900/60 border border-slate-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-slate-800 text-xs font-semibold text-slate-300">
                Live Source Reference Matches ({report.impact_sites.length})
              </div>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950 text-slate-400 border-b border-slate-800 font-mono sticky top-0">
                    <tr>
                      <th className="py-2.5 px-4">Cloned File Path</th>
                      <th className="py-2.5 px-3">Line</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-4">Source Code</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 font-mono text-[11px]">
                    {report.impact_sites.map((site, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-4 text-emerald-400">{site.file_path}</td>
                        <td className="py-2.5 px-3 text-slate-400">{site.line_number}</td>
                        <td className="py-2.5 px-3 text-slate-500">{site.context_type}</td>
                        <td className="py-2.5 px-4 text-rose-300">{site.code_snippet}</td>
                      </tr>
                    ))}
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