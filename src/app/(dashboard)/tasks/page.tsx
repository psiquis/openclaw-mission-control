"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, XCircle, ListChecks, GitBranch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface GwTask {
  taskId: string;
  runtime: string;
  agentId?: string;
  label?: string;
  task?: string;
  status: string;
  deliveryStatus?: string;
  notifyPolicy?: string;
  createdAt?: number;
  startedAt?: number;
  endedAt?: number;
}

interface GwFlow {
  flowId: string;
  syncMode?: string;
  ownerKey?: string;
  status?: string;
  goal?: string;
  revision?: number;
  createdAt?: number;
  updatedAt?: number;
}

const STATUS_COLOR: Record<string, string> = {
  running: "var(--info)",
  queued: "var(--warning)",
  waiting: "var(--warning)",
  succeeded: "var(--positive)",
  failed: "var(--negative)",
  timed_out: "var(--negative)",
  cancelled: "var(--text-muted)",
  lost: "var(--negative)",
  blocked: "var(--warning)",
};

function fmtDuration(start?: number, end?: number): string {
  if (!start) return "—";
  const ms = (end || Date.now()) - start;
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<GwTask[]>([]);
  const [flows, setFlows] = useState<GwFlow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [cancelling, setCancelling] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      const data = await res.json();
      setTasks(data.tasks || []);
      setFlows(data.flows || []);
      setError(data.errors?.length ? data.errors.join(" · ") : null);
    } catch {
      setError("No se pudo consultar el gateway");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 8000);
    return () => clearInterval(iv);
  }, [load]);

  const cancel = async (id: string, isFlow: boolean) => {
    if (!window.confirm("¿Cancelar esta tarea? Se detendrá la sesión hija.")) return;
    setCancelling(id);
    try {
      await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: isFlow ? "flow-cancel" : "cancel", id }),
      });
      await load();
    } finally {
      setCancelling(null);
    }
  };

  const filtered = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);
  const activeCount = tasks.filter((t) => ["running", "queued"].includes(t.status)).length;
  const statuses = Array.from(new Set(tasks.map((t) => t.status)));

  return (
    <div className="p-4 md:p-8">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 style={{ color: "var(--text-primary)" }}>Tareas en segundo plano</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Ledger del gateway: cron, subagentes, ACP y operaciones CLI · {activeCount} activas
          </p>
        </div>
        <div className="toggle-group">
          <button className={statusFilter === "all" ? "active" : ""} onClick={() => setStatusFilter("all")}>Todas</button>
          {statuses.slice(0, 5).map((st) => (
            <button key={st} className={statusFilter === st ? "active" : ""} onClick={() => setStatusFilter(st)}>{st}</button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 p-8 justify-center" style={{ color: "var(--text-muted)" }}>
          <Loader2 className="w-4 h-4 animate-spin" /> Consultando el gateway…
        </div>
      )}
      {error && !loading && (
        <div className="p-3 mb-4 rounded-lg text-sm" style={{ backgroundColor: "var(--negative-soft)", color: "var(--negative)" }}>{error}</div>
      )}

      {!loading && (
        <div className="rounded-lg overflow-hidden mb-6" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <ListChecks className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Tareas</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{filtered.length} de {tasks.length}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--border)" }}>
                  {["Tarea", "Agente", "Runtime", "Estado", "Inicio", "Duración", ""].map((h, i) => (
                    <th key={i} className="text-left py-2 px-3 font-medium" style={{ color: "var(--text-muted)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.slice(0, 60).map((t) => (
                  <tr key={t.taskId} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td className="py-2 px-3">
                      <span className="font-mono font-medium" style={{ color: "var(--text-primary)" }} title={t.taskId}>
                        {t.label || t.task || t.taskId.slice(0, 8)}
                      </span>
                    </td>
                    <td className="py-2 px-3" style={{ color: "var(--text-secondary)" }}>{t.agentId || "—"}</td>
                    <td className="py-2 px-3"><span className="badge badge-info">{t.runtime}</span></td>
                    <td className="py-2 px-3">
                      <span className="flex items-center gap-1.5" style={{ color: STATUS_COLOR[t.status] || "var(--text-secondary)" }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: STATUS_COLOR[t.status] || "var(--text-muted)" }} />
                        {t.status}
                      </span>
                    </td>
                    <td className="py-2 px-3" style={{ color: "var(--text-muted)" }}>
                      {t.startedAt ? formatDistanceToNow(new Date(t.startedAt), { addSuffix: true, locale: es }) : "—"}
                    </td>
                    <td className="py-2 px-3 font-mono" style={{ color: "var(--text-secondary)" }}>{fmtDuration(t.startedAt, t.endedAt)}</td>
                    <td className="py-2 px-3 text-right">
                      {["running", "queued"].includes(t.status) && (
                        <button
                          onClick={() => cancel(t.taskId, false)}
                          disabled={cancelling === t.taskId}
                          className="btn-danger"
                          style={{ height: 24, padding: "0 8px", fontSize: 11 }}
                          aria-label="Cancelar tarea"
                        >
                          {cancelling === t.taskId ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                          Cancelar
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-8 text-center" style={{ color: "var(--text-muted)" }}>Sin tareas con este filtro</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && flows.length > 0 && (
        <div className="rounded-lg overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <GitBranch className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Task Flows</h2>
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>{flows.length}</span>
          </div>
          <div className="p-3 space-y-1">
            {flows.slice(0, 20).map((f) => (
              <div key={f.flowId} className="flex items-center gap-3 p-2 rounded-md text-xs" style={{ backgroundColor: "var(--card-elevated)" }}>
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: STATUS_COLOR[f.status || ""] || "var(--text-muted)" }} />
                <span className="font-mono truncate" style={{ color: "var(--text-secondary)", flex: 1 }} title={f.ownerKey}>
                  {f.goal || f.ownerKey || f.flowId.slice(0, 12)}
                </span>
                <span style={{ color: "var(--text-muted)" }}>{f.syncMode}</span>
                <span style={{ color: STATUS_COLOR[f.status || ""] || "var(--text-secondary)" }}>{f.status}</span>
                {["running", "queued", "waiting"].includes(f.status || "") && (
                  <button onClick={() => cancel(f.flowId, true)} className="btn-danger" style={{ height: 22, padding: "0 8px", fontSize: 10.5 }}>
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
