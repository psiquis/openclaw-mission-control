"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck, ChevronDown, ChevronUp, AlertTriangle, AlertCircle } from "lucide-react";

interface Finding {
  checkId: string;
  severity: "critical" | "warn" | "info";
  title: string;
  detail?: string;
  remediation?: string;
}

interface SecurityData {
  summary: { critical: number; warn: number; info: number };
  findings: Finding[];
}

interface SecurityAuditProps {
  data: SecurityData | null;
}

const severityConfig = {
  critical: { color: "var(--negative, #ef4444)", bg: "rgba(239, 68, 68, 0.08)", border: "rgba(239, 68, 68, 0.3)", label: "Crítico", icon: AlertCircle },
  warn: { color: "var(--warning, #f59e0b)", bg: "rgba(245, 158, 11, 0.08)", border: "rgba(245, 158, 11, 0.3)", label: "Aviso", icon: AlertTriangle },
  info: { color: "var(--text-muted)", bg: "rgba(255, 255, 255, 0.02)", border: "var(--border)", label: "Info", icon: AlertCircle },
};

export function SecurityAudit({ data }: SecurityAuditProps) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!data) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={{ backgroundColor: "var(--card)" }}>
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: "var(--border)" }} />
        <div className="h-16 rounded" style={{ backgroundColor: "var(--border)" }} />
      </div>
    );
  }

  const { summary, findings } = data;
  const hasIssues = summary.critical > 0 || summary.warn > 0;

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2
          className="text-xl font-semibold flex items-center gap-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
          {hasIssues ? (
            <ShieldAlert className="w-5 h-5" style={{ color: "var(--warning, #f59e0b)" }} />
          ) : (
            <ShieldCheck className="w-5 h-5" style={{ color: "var(--positive, #10b981)" }} />
          )}
          Seguridad
        </h2>

        <div className="flex items-center gap-2 text-xs">
          {summary.critical > 0 && (
            <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(239, 68, 68, 0.12)", color: "var(--negative, #ef4444)" }}>
              {summary.critical} crítico{summary.critical === 1 ? "" : "s"}
            </span>
          )}
          {summary.warn > 0 && (
            <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(245, 158, 11, 0.12)", color: "var(--warning, #f59e0b)" }}>
              {summary.warn} aviso{summary.warn === 1 ? "" : "s"}
            </span>
          )}
          {!hasIssues && (
            <span className="px-2.5 py-1 rounded-full font-medium" style={{ backgroundColor: "rgba(16, 185, 129, 0.12)", color: "var(--positive, #10b981)" }}>
              Sin hallazgos
            </span>
          )}
        </div>
      </div>

      {findings.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          El último `openclaw security audit` no encontró avisos ni problemas críticos.
        </p>
      ) : (
        <div className="space-y-2">
          {findings.map((f) => {
            const cfg = severityConfig[f.severity];
            const Icon = cfg.icon;
            const isOpen = !!expanded[f.checkId];
            return (
              <div key={f.checkId} className="rounded-lg overflow-hidden" style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}>
                <button
                  onClick={() => setExpanded((e) => ({ ...e, [f.checkId]: !e[f.checkId] }))}
                  className="w-full flex items-center gap-3 p-3 text-left"
                >
                  <Icon className="w-4 h-4 flex-shrink-0" style={{ color: cfg.color }} />
                  <span className="text-xs font-medium flex-shrink-0" style={{ color: cfg.color }}>
                    {cfg.label}
                  </span>
                  <span className="text-sm flex-1 truncate" style={{ color: "var(--text-primary)" }}>
                    {f.title}
                  </span>
                  {isOpen ? (
                    <ChevronUp className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  ) : (
                    <ChevronDown className="w-4 h-4 flex-shrink-0" style={{ color: "var(--text-muted)" }} />
                  )}
                </button>
                {isOpen && (f.detail || f.remediation) && (
                  <div className="px-3 pb-3 text-xs space-y-2" style={{ color: "var(--text-secondary)" }}>
                    {f.detail && <p style={{ whiteSpace: "pre-wrap" }}>{f.detail}</p>}
                    {f.remediation && (
                      <p style={{ color: "var(--text-muted)" }}>
                        <span className="font-medium" style={{ color: "var(--text-secondary)" }}>
                          Remediación:{" "}
                        </span>
                        {f.remediation}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs mt-4" style={{ color: "var(--text-muted)" }}>
        Generado por <span className="font-mono">openclaw security audit</span>. Ejecuta el comando en el host para el informe completo.
      </p>
    </div>
  );
}
