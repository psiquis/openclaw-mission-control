"use client";

import { useEffect, useState } from "react";
import { HeartPulse, ChevronDown, ChevronRight, FileEdit } from "lucide-react";
import Link from "next/link";

interface HbData {
  config: Record<string, unknown> | null;
  configured: boolean;
  heartbeatMd: string | null;
  defaults: { every: string; target: string };
}

export function HeartbeatCard() {
  const [data, setData] = useState<HbData | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch("/api/heartbeat").then((r) => r.json()).then(setData).catch(() => {});
  }, []);

  if (!data) return null;
  const every = (data.config?.every as string) || `${data.defaults.every} (por defecto)`;
  const target = (data.config?.target as string) || `${data.defaults.target} (por defecto)`;

  return (
    <div className="rounded-lg mb-4 overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left"
        style={{ color: "var(--text-primary)", background: "none", border: "none", cursor: "pointer" }}
      >
        {open ? <ChevronDown className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: "var(--text-muted)" }} />}
        <HeartPulse className="w-4 h-4" style={{ color: "var(--positive)" }} />
        <span className="text-sm font-semibold">Heartbeat</span>
        <span className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          cada {every} · destino {target}
        </span>
      </button>
      {open && (
        <div className="p-4" style={{ borderTop: "1px solid var(--border)" }}>
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)", lineHeight: 1.6 }}>
            El gateway despierta al agente principal periódicamente para revisar lo pendiente.
            Sigue las instrucciones de <span className="font-mono">HEARTBEAT.md</span>; si no hay nada, responde HEARTBEAT_OK en silencio.
          </p>
          {data.heartbeatMd ? (
            <pre className="p-3 rounded-md text-xs font-mono" style={{ backgroundColor: "var(--card-elevated)", color: "var(--text-secondary)", whiteSpace: "pre-wrap", maxHeight: 180, overflowY: "auto" }}>
              {data.heartbeatMd}
            </pre>
          ) : (
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>No hay HEARTBEAT.md en el workspace.</p>
          )}
          <Link href="/files" className="btn-outline mt-3" style={{ height: 28, fontSize: 12, display: "inline-flex" }}>
            <FileEdit style={{ width: 13, height: 13 }} /> Editar en Files
          </Link>
        </div>
      )}
    </div>
  );
}
