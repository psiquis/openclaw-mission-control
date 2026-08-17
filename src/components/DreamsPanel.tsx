"use client";

import { useState } from "react";
import { Moon, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { MarkdownPreview } from "@/components/MarkdownPreview";

export function DreamsPanel() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [diary, setDiary] = useState<string | null>(null);
  const [phases, setPhases] = useState<Record<string, string[]>>({});
  const [loaded, setLoaded] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !loaded) {
      setLoading(true);
      try {
        const res = await fetch("/api/dreams");
        const data = await res.json();
        setDiary(data.diary);
        setPhases(data.phases || {});
        setLoaded(true);
      } catch { /* sin datos */ }
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg mb-4 overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer" }}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
        <Moon className="w-4 h-4" style={{ color: "var(--accent-fg)" }} />
        <span className="text-sm font-semibold">Diario de sueños</span>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          consolidación nocturna de memoria (dreaming)
        </span>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)" }}>
          {loading && (
            <div className="flex items-center gap-2 p-6 justify-center text-sm" style={{ color: "var(--text-muted)" }}>
              <Loader2 className="w-4 h-4 animate-spin" /> Leyendo DREAMS.md…
            </div>
          )}
          {!loading && !diary && (
            <div className="p-6 text-center text-sm" style={{ color: "var(--text-muted)" }}>
              Aún no hay diario. El sweep de dreaming corre cada noche a las 03:00.
            </div>
          )}
          {!loading && diary && (
            <div className="p-4" style={{ maxHeight: "480px", overflowY: "auto" }}>
              <div className="flex gap-2 mb-3 flex-wrap">
                {(["light", "rem", "deep"] as const).map((ph) => (
                  <span key={ph} className="badge badge-info" title={`Reportes de fase ${ph}`}>
                    {ph}: {(phases[ph] || []).length} reportes
                  </span>
                ))}
              </div>
              <MarkdownPreview content={diary} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
