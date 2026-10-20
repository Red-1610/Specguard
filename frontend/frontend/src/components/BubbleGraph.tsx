"use client";

import React, { useMemo, useState } from "react";
import { FileCode2, Copy, Check, Search, ExternalLink, Sparkles } from "lucide-react";

interface ImpactSite {
  file_path: string;
  line_number: number;
  context_type: string;
  symbol: string;
  code_snippet: string;
}

interface BubbleGraphProps {
  rootSymbol: string;
  originFile: string;
  affectedFiles: string[];
  impactSites: ImpactSite[];
}

interface BubbleNode {
  filePath: string;
  fileName: string;
  dirName: string;
  x: number;
  y: number;
  hits: ImpactSite[];
}

/**
 * Calculates coordinates in [0, 100] percentage space.
 * Places bubbles in organic clustering orbits where adjacent bubbles gently touch and overlap,
 * forming an interconnected, floating soap-bubble cluster around the root symbol.
 */
function calculateBubblePositions(total: number): { x: number; y: number }[] {
  if (total === 0) return [];
  if (total === 1) {
    return [{ x: 50, y: 22 }];
  }

  const positions: { x: number; y: number }[] = [];

  if (total <= 5) {
    const radius = 23; // close enough that bubbles overlap neighbors and root
    for (let i = 0; i < total; i++) {
      const angle = -Math.PI / 2 + (i / total) * Math.PI * 2;
      const jitter = ((i * 7) % 5) - 2; // subtle organic radius variation
      positions.push({
        x: 50 + Math.cos(angle) * ((radius + jitter) * 1.12),
        y: 50 + Math.sin(angle) * (radius + jitter),
      });
    }
    return positions;
  }

  if (total <= 12) {
    const innerCount = Math.min(5, Math.floor(total * 0.45));
    const outerCount = total - innerCount;

    // Inner overlapping shell
    const innerRadius = 21;
    for (let i = 0; i < innerCount; i++) {
      const angle = -Math.PI / 2 + (i / innerCount) * Math.PI * 2;
      const jitter = ((i * 5) % 4) - 2;
      positions.push({
        x: 50 + Math.cos(angle) * ((innerRadius + jitter) * 1.15),
        y: 50 + Math.sin(angle) * (innerRadius + jitter),
      });
    }

    // Outer overlapping shell
    const outerRadius = 33;
    const offset = Math.PI / outerCount;
    for (let i = 0; i < outerCount; i++) {
      const angle = -Math.PI / 2 + (i / outerCount) * Math.PI * 2 + offset;
      const jitter = ((i * 7) % 5) - 2;
      positions.push({
        x: 50 + Math.cos(angle) * ((outerRadius + jitter) * 1.12),
        y: 50 + Math.sin(angle) * (outerRadius + jitter),
      });
    }
    return positions;
  }

  // 13+ bubbles: 3 layered overlapping cluster orbits
  const ring1Count = 5;
  const ring2Count = Math.min(10, Math.floor((total - ring1Count) * 0.5));
  const ring3Count = total - ring1Count - ring2Count;

  // Ring 1
  for (let i = 0; i < ring1Count; i++) {
    const angle = -Math.PI / 2 + (i / ring1Count) * Math.PI * 2;
    positions.push({
      x: 50 + Math.cos(angle) * 19 * 1.15,
      y: 50 + Math.sin(angle) * 19,
    });
  }

  // Ring 2
  const offset2 = Math.PI / ring2Count;
  for (let i = 0; i < ring2Count; i++) {
    const angle = -Math.PI / 2 + (i / ring2Count) * Math.PI * 2 + offset2;
    const jitter = ((i * 6) % 5) - 2;
    positions.push({
      x: 50 + Math.cos(angle) * ((29 + jitter) * 1.12),
      y: 50 + Math.sin(angle) * (29 + jitter),
    });
  }

  // Ring 3
  const offset3 = Math.PI / (ring3Count || 1) + 0.3;
  for (let i = 0; i < ring3Count; i++) {
    const angle = -Math.PI / 2 + (i / ring3Count) * Math.PI * 2 + offset3;
    const jitter = ((i * 8) % 6) - 3;
    positions.push({
      x: 50 + Math.cos(angle) * ((39 + jitter) * 1.1),
      y: 50 + Math.sin(angle) * (39 + jitter),
    });
  }

  return positions;
}

export default function BubbleGraph({
  rootSymbol,
  originFile,
  affectedFiles,
  impactSites,
}: BubbleGraphProps) {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [filterQuery, setFilterQuery] = useState("");
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const coords = useMemo(
    () => calculateBubblePositions(affectedFiles.length),
    [affectedFiles.length]
  );

  const nodes = useMemo<BubbleNode[]>(() => {
    return affectedFiles.map((filePath, index) => {
      const parts = filePath.split(/[\\/]/);
      const fileName = parts.pop() || filePath;
      const dirName = parts.length > 0 ? parts.join("/") : "";
      const pos = coords[index] || { x: 50, y: 50 };

      return {
        filePath,
        fileName,
        dirName,
        x: pos.x,
        y: pos.y,
        hits: impactSites.filter((site) => site.file_path === filePath),
      };
    });
  }, [affectedFiles, impactSites, coords]);

  const selectedNode = useMemo(
    () => nodes.find((node) => node.filePath === selectedFile) || null,
    [nodes, selectedFile]
  );

  const handleCopyPath = (path: string) => {
    void navigator.clipboard.writeText(path);
    setCopiedFile(path);
    setTimeout(() => setCopiedFile(null), 1800);
  };

  if (nodes.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 bg-slate-950/60 px-6 text-center">
        <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300 shadow-[0_0_24px_rgba(244,63,94,0.3)]">
          <span className="font-mono text-xs font-bold">{rootSymbol}</span>
        </div>
        <p className="text-sm font-semibold text-slate-200">
          No downstream references found
        </p>
        <p className="mt-1 max-w-md text-xs text-slate-500">
          {originFile
            ? `Symbol "${rootSymbol}" in ${originFile} is not referenced by any other indexed Python file.`
            : "The selected symbol has no external usages in this repository."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Filter & Counter bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2 text-slate-400 font-mono text-[11px]">
          <span className="flex h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
          <span>Root: <strong className="text-rose-300">{rootSymbol}</strong></span>
          <span className="text-slate-600">·</span>
          <span>{nodes.length} affected {nodes.length === 1 ? "file" : "files"}</span>
        </div>

        {nodes.length > 5 && (
          <div className="relative w-full sm:w-56">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-500" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search affected file..."
              className="w-full rounded-lg border border-slate-800 bg-slate-950 py-1.5 pl-8 pr-3 text-[11px] text-slate-200 placeholder-slate-500 focus:border-rose-500 focus:outline-none"
            />
          </div>
        )}
      </div>

      {/* Graph Canvas */}
      <div className="relative h-[480px] w-full overflow-hidden rounded-2xl border border-slate-800/90 bg-[#030712] shadow-inner select-none">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, #f43f5e 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />

        {/* SVG connection lines */}
        <svg
          className="pointer-events-none absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {nodes.map((node) => {
            const isSelected = selectedFile === node.filePath;
            const matchesFilter = filterQuery
              ? node.filePath.toLowerCase().includes(filterQuery.toLowerCase())
              : true;

            return (
              <g key={`edge-${node.filePath}`}>
                {/* Glow layer when selected */}
                {isSelected && (
                  <line
                    x1="50"
                    y1="50"
                    x2={node.x}
                    y2={node.y}
                    stroke="#f43f5e"
                    strokeWidth="1.6"
                    strokeOpacity="0.6"
                  />
                )}
                <line
                  x1="50"
                  y1="50"
                  x2={node.x}
                  y2={node.y}
                  stroke={
                    isSelected
                      ? "#fb7185"
                      : matchesFilter
                      ? "#4f46e5"
                      : "#1e293b"
                  }
                  strokeWidth={isSelected ? "1" : "0.5"}
                  strokeOpacity={isSelected ? "1" : "0.35"}
                  strokeDasharray={isSelected ? "none" : "2 2"}
                />
              </g>
            );
          })}
        </svg>

        {/* Center Root Bubble Orb */}
        <div className="animate-root-orb absolute left-1/2 top-1/2 z-20 flex h-32 w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-rose-500/80 bg-gradient-to-br from-rose-950/80 via-rose-900/60 to-slate-950/95 p-3 text-center shadow-[0_0_40px_rgba(244,63,94,0.45),inset_0_0_18px_rgba(255,255,255,0.25)] backdrop-blur-md select-none">
          {/* 3D Glass specular shine highlight */}
          <div className="absolute top-3 left-4 h-4 w-2.5 rounded-full bg-white/45 -rotate-45 pointer-events-none blur-[0.5px]" />
          <div className="absolute bottom-3 right-4 h-2 w-2 rounded-full bg-rose-400/30 pointer-events-none" />

          <span className="flex items-center gap-1 font-mono text-[9px] font-bold uppercase tracking-wider text-rose-300">
            <Sparkles className="h-2.5 w-2.5 text-rose-300" /> Root Symbol
          </span>
          <span
            className="mt-0.5 max-w-full truncate font-mono text-xs font-black text-white drop-shadow-sm px-1"
            title={rootSymbol}
          >
            {rootSymbol}
          </span>
          <span
            className="mt-1 max-w-full truncate text-[9px] font-medium text-rose-200/70 px-2"
            title={originFile || "origin file"}
          >
            {originFile || "origin file"}
          </span>
        </div>

        {/* Dependent Floating Overlapping Bubbles */}
        {nodes.map((node, index) => {
          const isSelected = selectedFile === node.filePath;
          const matchesFilter = filterQuery
            ? node.filePath.toLowerCase().includes(filterQuery.toLowerCase())
            : true;

          // 4 alternating organic float animations
          const floatAnim = [
            "animate-float-bubble-1",
            "animate-float-bubble-2",
            "animate-float-bubble-3",
            "animate-float-bubble-4",
          ][index % 4];

          // Dynamic bubble size based on reference hits
          const bubbleSize = Math.min(96, Math.max(76, 74 + node.hits.length * 3));
          const animDelay = `${((index * 0.55) % 4).toFixed(2)}s`;

          return (
            <button
              key={node.filePath}
              type="button"
              onClick={() => setSelectedFile(isSelected ? null : node.filePath)}
              className={`group absolute z-20 flex flex-col items-center justify-center rounded-full text-center transition-all duration-300 cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400 select-none ${floatAnim} ${
                isSelected
                  ? "!scale-115 border-2 border-rose-400/90 bg-gradient-to-br from-rose-500/45 via-rose-600/35 to-amber-500/30 text-rose-100 shadow-[0_0_36px_rgba(244,63,94,0.6),inset_0_0_18px_rgba(255,255,255,0.4)] backdrop-blur-md z-40 ring-2 ring-rose-400/60"
                  : matchesFilter
                  ? "border border-indigo-300/40 bg-gradient-to-br from-indigo-500/25 via-purple-500/18 to-sky-500/22 text-indigo-100 shadow-[inset_0_0_14px_rgba(255,255,255,0.2),0_8px_24px_rgba(99,102,241,0.22)] backdrop-blur-md hover:scale-110 hover:border-indigo-200 hover:shadow-[0_0_28px_rgba(129,140,248,0.5),inset_0_0_16px_rgba(255,255,255,0.3)] hover:z-30"
                  : "opacity-30 border border-slate-700/40 bg-slate-900/60 text-slate-500 hover:opacity-75"
              }`}
              style={{
                left: `${node.x}%`,
                top: `${node.y}%`,
                width: `${bubbleSize}px`,
                height: `${bubbleSize}px`,
                animationDelay: animDelay,
              }}
              title={`Inspect ${node.hits.length} reference(s) in ${node.filePath}`}
            >
              {/* 3D Glass / Soap Bubble Specular Reflection Arc */}
              <div className="absolute top-2.5 left-3.5 h-3.5 w-2 rounded-full bg-white/40 -rotate-45 pointer-events-none blur-[0.4px] transition-opacity group-hover:bg-white/60" />
              <div className="absolute bottom-2.5 right-3.5 h-1.5 w-1.5 rounded-full bg-white/20 pointer-events-none" />

              {/* Bubble Content */}
              <span
                className="max-w-[85%] truncate font-mono text-[10px] font-bold text-slate-100 px-1 leading-tight tracking-tight drop-shadow-sm"
                title={node.fileName}
              >
                {node.fileName}
              </span>

              {node.dirName && (
                <span
                  className="max-w-[80%] truncate text-[8px] text-indigo-200/70 font-mono scale-95"
                  title={node.dirName}
                >
                  {node.dirName.split("/").pop()}
                </span>
              )}

              <span
                className={`mt-1 inline-flex items-center px-1.5 py-0.2 rounded-full font-mono text-[9px] font-semibold border ${
                  isSelected
                    ? "bg-rose-500/40 text-rose-100 border-rose-400/50 shadow-sm"
                    : "bg-indigo-950/60 text-indigo-200 border-indigo-400/30"
                }`}
              >
                {node.hits.length} {node.hits.length === 1 ? "hit" : "hits"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected Node Evidence Panel */}
      {selectedNode ? (
        <div className="rounded-xl border border-rose-500/30 bg-rose-950/15 p-4 shadow-lg backdrop-blur-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-500/20 pb-3">
            <div className="flex items-center gap-2">
              <FileCode2 className="h-4 w-4 text-rose-400 shrink-0" />
              <div>
                <p className="font-mono text-xs font-bold text-rose-200">
                  {selectedNode.filePath}
                </p>
                <p className="text-[11px] text-slate-400">
                  {selectedNode.hits.length} reference{" "}
                  {selectedNode.hits.length === 1 ? "site" : "sites"} detected
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleCopyPath(selectedNode.filePath)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-300 transition hover:bg-slate-800 hover:text-white cursor-pointer"
                title="Copy relative file path"
              >
                {copiedFile === selectedNode.filePath ? (
                  <>
                    <Check className="h-3 w-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    <span>Copy path</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedFile(null)}
                className="rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-[11px] text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>

          <div className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
            {selectedNode.hits.map((site, idx) => (
              <div
                key={`${site.file_path}-${site.line_number}-${site.context_type}-${idx}`}
                className="rounded-lg border border-slate-800/80 bg-slate-950/80 p-2.5 font-mono text-[11px]"
              >
                <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                  <span className="text-slate-400">Line {site.line_number}</span>
                  <span className="rounded bg-rose-500/10 px-1.5 py-0.5 text-rose-300 border border-rose-500/20">
                    {site.context_type}
                  </span>
                </div>
                <p className="overflow-x-auto whitespace-pre text-rose-200 font-medium">
                  {site.code_snippet}
                </p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center font-mono text-[11px] text-slate-500">
          Click any floating bubble above to inspect its exact code references and line numbers.
        </p>
      )}
    </div>
  );
}
