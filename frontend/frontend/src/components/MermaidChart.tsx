"use client";

import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  flowchart: {
    curve: "basis",
  },
});

interface MermaidProps {
  chart: string;
}

export default function MermaidChart({ chart }: MermaidProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current && chart) {
      containerRef.current.innerHTML = "";
      const uniqueId = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
      
      mermaid.render(uniqueId, chart).then(({ svg }) => {
        if (containerRef.current) {
          containerRef.current.innerHTML = svg;
        }
      }).catch((err) => {
        console.error("Mermaid rendering failed:", err);
      });
    }
  }, [chart]);

  return <div ref={containerRef} className="flex justify-center py-4 overflow-x-auto" />;
}
