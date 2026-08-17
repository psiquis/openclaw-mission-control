"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Loader2, Play, Pencil, History, Workflow as WorkflowIcon, ExternalLink, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface CronJob {
  id: string;
  agentId: string;
  name: string;
  enabled: boolean;
  scheduleDisplay?: string;
  timezone?: string;
  nextRun?: string | null;
  lastRun?: string | null;
  description?: string;
  deliveryChannel?: string;
  category?: string;
}

interface GwTask {
  taskId: string;
  sourceId?: string;
  status: string;
  startedAt?: number;
  endedAt?: number;
  agentId?: string;
}

interface N8nWf {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
}

const STATUS_COLOR: Record<string, string> = {
  running: "var(--info)",
  queued: "var(--warning)",
  succeeded: "var(--positive)",
  failed: "var(--negative)",
  timed_out: "var(--negative)",
  cancelled: "var(--text-muted)",
};

export default function WorkflowsPage() {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [lastRuns, setLastRuns] = useState<Record<string, GwTask>>({});
  const [n8n, setN8n] = useState<{ connected: boolean; workflows?: N8nWf[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [cronRes, tasksRes, n8nRes] = await Promise.all([
        fetch("/api/cron").then((r) => r.json()).catch(() => []),
        fetch("/api/tasks").then((r) => r.json()).catch(() => ({ tasks: [] })),
        fetch("/api/n8n").then((r) => r.json()).catch(() => null),
      ]);
      if (Array.isArray(cronRes)) setJobs(cronRes);
      const bySource: Record<string, GwTask> = {};
      for (const t of (tasksRes.tasks || []) as GwTask[]) {
        if (t.sourceId && !bySource[t.sourceId]) bySource[t.sourceId] = t;
      }
      setLastRuns(bySource);
      if (n8nRes) setN8n(n8nRes);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 15000);
    return () => clearInterval(iv);
  }, [load]);

  const runNow = async (job: CronJob) => {
    setRunning(job.id);
    try {
      const res = await fetch("/api/cron/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: job.id }),
      });
      setToast(res.ok ? `Lanzado: ${job.name}` : `Error al lanzar ${job.name}`);
      setTimeout(() => setToast(null), 3000);
      setTimeout(load, 2500);
    } finally {
      setRunning(null);
    }
  };

  const active = jobs.filter((j) => j.enabled).length;
  const failing = Object.values(lastRuns).filter((t) => ["failed", "timed_out"].includes(t.status)).length;

  return (
    <div className="p-4 md:p-8">
      {toast && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 1000, padding: "0.6rem 1rem", borderRadius: 8, backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border-strong)", color: "var(--text-primary)", fontSize: 13 }}>
          {toast}
        </div>
      )}

      <div className="mb-6">
        <h1 style={{ color: "var(--text-primary)" }}>Automatizaciones</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Todo lo que corre solo en delorian: tareas programadas de OpenClaw y flujos de n8n
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 p-8 justify-center" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando automatizaciones…
        </div>
      )}

      {!loading && (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[
              { label: "Cron jobs", value: jobs.length },
              { label: "Activos", value: active },
              { label: "Con fallos recientes", value: failing, warn: failing > 0 },
              { label: "Flujos n8n", value: n8n?.connected ? (n8n.workflows || []).length : "—" },
            ].map((s) => (
              <div key={s.label} className="rounded-lg p-4" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
                <div className="text-[11.5px] font-medium mb-1" style={{ color: "var(--text-muted)" }}>{s.label}</div>
                <div className="text-[22px] font-medium tabular" style={{ fontFamily: "var(--font-mono)", color: s.warn ? "var(--negative)" : "var(--text-primary)" }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Cron jobs de OpenClaw */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
            {jobs.map((job) => {
              const last = lastRuns[job.id];
              return (
                <div key={job.id} className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)", opacity: job.enabled ? 1 : 0.6 }}>
                  <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
                    <Zap className="w-4 h-4 flex-shrink-0" style={{ color: "var(--accent-fg)" }} />
                    <span className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>{job.name}</span>
                    <span className="badge badge-info">{job.agentId}</span>
                    {!job.enabled && <span className="badge" style={{ backgroundColor: "var(--surface-hover)", color: "var(--text-muted)" }}>pausado</span>}
                    {job.deliveryChannel && <span className="text-[11px] ml-auto" style={{ color: "var(--text-muted)" }}>→ {job.deliveryChannel}</span>}
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs mb-3">
                      <span style={{ color: "var(--text-muted)" }}>Programación</span>
                      <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{job.scheduleDisplay || "—"}</span>
                      <span style={{ color: "var(--text-muted)" }}>Próxima ejecución</span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {job.nextRun ? formatDistanceToNow(new Date(job.nextRun), { addSuffix: true, locale: es }) : "—"}
                      </span>
                      <span style={{ color: "var(--text-muted)" }}>Última ejecución</span>
                      <span className="flex items-center gap-1.5">
                        {last ? (
                          <>
                            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[last.status] || "var(--text-muted)" }} />
                            <span style={{ color: STATUS_COLOR[last.status] || "var(--text-secondary)" }}>{last.status}</span>
                            {last.startedAt && (
                              <span style={{ color: "var(--text-muted)" }}>
                                · {formatDistanceToNow(new Date(last.startedAt), { addSuffix: true, locale: es })}
                              </span>
                            )}
                          </>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>sin registro reciente</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => runNow(job)} disabled={running === job.id} className="btn-primary" style={{ height: 28, padding: "0 12px", fontSize: 12 }}>
                        {running === job.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />} Ejecutar
                      </button>
                      <Link href="/tasks" className="btn-outline" style={{ height: 28, padding: "0 12px", fontSize: 12 }}>
                        <History className="w-3 h-3" /> Historial
                      </Link>
                      <Link href="/cron" className="btn-outline" style={{ height: 28, padding: "0 12px", fontSize: 12 }}>
                        <Pencil className="w-3 h-3" /> Editar
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* n8n */}
          <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
              <WorkflowIcon className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Flujos de n8n</h2>
              <a
                href="https://delorian.tailb22f88.ts.net:8443"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto text-xs flex items-center gap-1"
                style={{ color: "var(--text-muted)" }}
              >
                Abrir n8n <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            {n8n?.connected ? (
              <div className="p-3 space-y-1">
                {(n8n.workflows || []).map((w) => (
                  <div key={w.id} className="flex items-center gap-3 p-2 rounded-md text-xs" style={{ backgroundColor: "var(--card-elevated)" }}>
                    <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: w.active ? "var(--positive)" : "var(--text-muted)" }} />
                    <span style={{ color: "var(--text-primary)", flex: 1 }}>{w.name}</span>
                    <span style={{ color: "var(--text-muted)" }}>{w.active ? "activo" : "inactivo"}</span>
                    {w.updatedAt && (
                      <span style={{ color: "var(--text-muted)" }}>
                        {formatDistanceToNow(new Date(w.updatedAt), { addSuffix: true, locale: es })}
                      </span>
                    )}
                  </div>
                ))}
                {(n8n.workflows || []).length === 0 && (
                  <div className="p-4 text-center text-xs" style={{ color: "var(--text-muted)" }}>Sin flujos en n8n</div>
                )}
              </div>
            ) : (
              <div className="p-4 text-xs" style={{ color: "var(--text-secondary)", lineHeight: 1.7 }}>
                n8n corre en este servidor pero el panel aún no tiene acceso a su API.
                Para conectarlo: en n8n abre <span className="font-mono">Settings → n8n API</span>, crea una API key,
                y añádela como <span className="font-mono">N8N_API_KEY</span> al entorno de mission-control
                (p. ej. en el ecosystem de pm2). Mientras tanto puedes abrir n8n directamente con el enlace de arriba.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
