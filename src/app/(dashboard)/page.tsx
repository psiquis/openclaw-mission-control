"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { StatsCard } from "@/components/StatsCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import {
  Activity, CheckCircle, XCircle, Zap, Bot, MessageSquare, Users,
  Cpu, MemoryStick, HardDrive, Network, Server, ShieldCheck, Wifi, Monitor,
  Play, Square, RotateCw, Loader2, Terminal as TerminalIcon, X as XIcon,
  ArrowDown, ArrowUp, Blocks, CalendarClock,
} from "lucide-react";
import Link from "next/link";

// ---- Types (from system page) ----

interface SystemdService {
  name: string; status: string; description: string; backend?: string;
  uptime?: number | null; restarts?: number; pid?: number | null;
  mem?: number | null; cpu?: number | null;
}

interface TailscaleDevice { ip: string; hostname: string; os: string; online: boolean; }
interface FirewallRule { port: string; action: string; from: string; comment: string; }

interface SystemData {
  cpu: { usage: number; cores: number[]; loadAvg: number[] };
  ram: { total: number; used: number; free: number; cached: number };
  disk: { total: number; used: number; free: number; percent: number };
  network: { rx: number; tx: number };
  systemd: SystemdService[];
  tailscale: { active: boolean; ip: string; devices: TailscaleDevice[] };
  firewall: { active: boolean; rules: FirewallRule[]; ruleCount: number };
}

interface Stats { total: number; today: number; success: number; error: number; byType: Record<string, number>; }
interface Agent { id: string; name: string; emoji: string; color: string; model: string; status: "online" | "offline"; botToken?: string; }
interface LogsModal { name: string; backend: string; content: string; loading: boolean; }

// ---- Helpers ----

function formatUptime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ---- Mini Sparkline Chart ----

function Sparkline({ data, color, height = 40, max }: { data: number[]; color: string; height?: number; max?: number }) {
  const maxVal = max ?? Math.max(...data, 1);
  const w = 200;
  const points = data.map((v, i) => {
    const x = (i / Math.max(data.length - 1, 1)) * w;
    const y = height - (v / maxVal) * (height - 4);
    return `${x},${y}`;
  }).join(" ");
  const areaPoints = `0,${height} ${points} ${w},${height}`;

  return (
    <svg viewBox={`0 0 ${w} ${height}`} className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`grad-${color.replace(/[^a-z0-9]/gi, '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${color.replace(/[^a-z0-9]/gi, '')})`} />
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

// ---- Main Component ----

const HISTORY_SIZE = 60;

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, today: 0, success: 0, error: 0, byType: {} });
  const [agents, setAgents] = useState<Agent[]>([]);
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [sysTab, setSysTab] = useState<"hardware" | "services">("hardware");
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({});
  const [logsModal, setLogsModal] = useState<LogsModal | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // History for sparklines
  const [cpuHistory, setCpuHistory] = useState<number[]>([]);
  const [ramHistory, setRamHistory] = useState<number[]>([]);
  const [netRxHistory, setNetRxHistory] = useState<number[]>([]);
  const [netTxHistory, setNetTxHistory] = useState<number[]>([]);

  // Initial data load
  useEffect(() => {
    Promise.all([
      fetch("/api/activities/stats").then(r => r.json()),
      fetch("/api/agents").then(r => r.json()),
    ]).then(([actStats, agentsData]) => {
      setStats({ total: actStats.total || 0, today: actStats.today || 0, success: actStats.byStatus?.success || 0, error: actStats.byStatus?.error || 0, byType: actStats.byType || {} });
      setAgents(agentsData.agents || []);
    }).catch(console.error);
  }, []);

  // System monitor polling
  useEffect(() => {
    const fetchSystem = async () => {
      try {
        const res = await fetch("/api/system/monitor");
        if (res.ok) {
          const data: SystemData = await res.json();
          setSystemData(data);
          setCpuHistory(prev => [...prev.slice(-(HISTORY_SIZE - 1)), data.cpu.usage]);
          const ramPct = (data.ram.used / data.ram.total) * 100;
          setRamHistory(prev => [...prev.slice(-(HISTORY_SIZE - 1)), ramPct]);
          setNetRxHistory(prev => [...prev.slice(-(HISTORY_SIZE - 1)), data.network.rx]);
          setNetTxHistory(prev => [...prev.slice(-(HISTORY_SIZE - 1)), data.network.tx]);
        }
      } catch { /* ignore */ }
    };
    fetchSystem();
    const iv = setInterval(fetchSystem, 3000);
    return () => clearInterval(iv);
  }, []);

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleServiceAction = async (svc: SystemdService, action: "restart" | "stop" | "start" | "logs") => {
    const key = `${svc.name}-${action}`;
    setActionLoading(prev => ({ ...prev, [key]: true }));
    try {
      if (action === "logs") setLogsModal({ name: svc.name, backend: svc.backend || "pm2", content: "", loading: true });
      const res = await fetch("/api/system/services", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: svc.name, backend: svc.backend || "pm2", action }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Action failed");
      if (action === "logs") setLogsModal({ name: svc.name, backend: svc.backend || "pm2", content: data.output, loading: false });
      else { showToast(`${svc.name}: ${action} successful`); setTimeout(async () => { const r = await fetch("/api/system/monitor"); if (r.ok) setSystemData(await r.json()); }, 2000); }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Action failed";
      if (action === "logs") setLogsModal({ name: svc.name, backend: svc.backend || "pm2", content: `Error: ${msg}`, loading: false });
      else showToast(`${svc.name}: ${msg}`, "error");
    } finally { setActionLoading(prev => ({ ...prev, [key]: false })); }
  };

  const cpuColor = systemData ? (systemData.cpu.usage < 60 ? "var(--success)" : systemData.cpu.usage < 85 ? "var(--warning)" : "var(--error)") : "var(--text-muted)";
  const ramPercent = systemData ? (systemData.ram.used / systemData.ram.total) * 100 : 0;
  const ramColor = ramPercent < 60 ? "var(--success)" : ramPercent < 85 ? "var(--warning)" : "var(--error)";
  const diskColor = systemData ? (systemData.disk.percent < 60 ? "var(--success)" : systemData.disk.percent < 85 ? "var(--warning)" : "var(--error)") : "var(--text-muted)";

  return (
    <div className="p-4 md:p-8">
      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", top: "1rem", right: "1rem", zIndex: 1000, padding: "0.75rem 1.25rem", borderRadius: "0.75rem", backgroundColor: toast.type === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${toast.type === "success" ? "var(--success)" : "var(--error)"}`, color: toast.type === "success" ? "var(--success)" : "var(--error)", fontSize: "0.85rem", fontWeight: 500 }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "-1px" }}>
            Dashboard
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Overview of your OpenClaw agent fleet</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "var(--success)" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: "var(--success)" }} />
            Live
          </span>
        </div>
      </div>

      {/* Activity Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatsCard title="Total Activities" value={stats.total.toLocaleString()} icon={<Activity className="w-5 h-5" />} iconColor="var(--info)" />
        <StatsCard title="Today" value={stats.today.toLocaleString()} icon={<Zap className="w-5 h-5" />} iconColor="var(--accent)" />
        <StatsCard title="Successful" value={stats.success.toLocaleString()} icon={<CheckCircle className="w-5 h-5" />} iconColor="var(--success)" />
        <StatsCard title="Errors" value={stats.error.toLocaleString()} icon={<XCircle className="w-5 h-5" />} iconColor="var(--error)" />
      </div>

      {/* System Metrics with Sparklines */}
      {systemData && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {/* CPU */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4" style={{ color: cpuColor }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>CPU</span>
              </div>
              <span className="text-lg font-bold font-mono" style={{ color: cpuColor }}>{systemData.cpu.usage}%</span>
            </div>
            <Sparkline data={cpuHistory} color={cpuColor} max={100} />
            <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span>{systemData.cpu.cores.length} cores</span>
              <span>Load: {systemData.cpu.loadAvg[0].toFixed(2)}</span>
            </div>
          </div>

          {/* RAM */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <MemoryStick className="w-4 h-4" style={{ color: ramColor }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>RAM</span>
              </div>
              <span className="text-lg font-bold font-mono" style={{ color: ramColor }}>{ramPercent.toFixed(0)}%</span>
            </div>
            <Sparkline data={ramHistory} color={ramColor} max={100} />
            <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span>{systemData.ram.used.toFixed(1)}GB used</span>
              <span>{systemData.ram.total.toFixed(1)}GB total</span>
            </div>
          </div>

          {/* Disk */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4" style={{ color: diskColor }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Disk</span>
              </div>
              <span className="text-lg font-bold font-mono" style={{ color: diskColor }}>{systemData.disk.percent.toFixed(0)}%</span>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--card-elevated)" }}>
              <div className="h-full transition-all duration-500" style={{ width: `${systemData.disk.percent}%`, backgroundColor: diskColor }} />
            </div>
            <div className="flex justify-between mt-2 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span>{systemData.disk.used.toFixed(1)}GB used</span>
              <span>{systemData.disk.total.toFixed(1)}GB total</span>
            </div>
          </div>

          {/* Network */}
          <div className="p-4 rounded-xl" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Network className="w-4 h-4" style={{ color: "var(--info)" }} />
                <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>Network</span>
              </div>
            </div>
            <div className="space-y-1">
              <Sparkline data={netRxHistory} color="#22C55E" height={18} />
              <Sparkline data={netTxHistory} color="#6366F1" height={18} />
            </div>
            <div className="flex justify-between mt-1 text-[10px]" style={{ color: "var(--text-muted)" }}>
              <span><ArrowDown className="w-3 h-3 inline" style={{ color: "var(--success)" }} /> {systemData.network.rx.toFixed(2)} MB/s</span>
              <span><ArrowUp className="w-3 h-3 inline" style={{ color: "var(--accent)" }} /> {systemData.network.tx.toFixed(2)} MB/s</span>
            </div>
          </div>
        </div>
      )}

      {/* Agents + System Tabs */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-6">
        {/* Agents */}
        <div className="xl:col-span-1 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Agents</h2>
            </div>
            <Link href="/agents" className="text-xs font-medium" style={{ color: "var(--accent)" }}>View all</Link>
          </div>
          <div className="p-3 space-y-2">
            {agents.map(agent => (
              <div key={agent.id} className="flex items-center gap-3 p-2 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: agent.status === "online" ? "var(--success)" : "var(--text-muted)" }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold truncate" style={{ color: "var(--text-primary)" }}>{agent.name}</div>
                  <div className="text-[10px] truncate" style={{ color: "var(--text-muted)" }}>
                    <Bot className="w-3 h-3 inline mr-1" />{agent.model.split('/').pop()}
                  </div>
                </div>
                {agent.botToken && <MessageSquare className="w-3 h-3 flex-shrink-0" style={{ color: "#0088cc" }} />}
              </div>
            ))}
          </div>
        </div>

        {/* Services & Infrastructure */}
        <div className="xl:col-span-2 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex gap-2">
              {(["hardware", "services"] as const).map(t => (
                <button key={t} onClick={() => setSysTab(t)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors" style={{ backgroundColor: sysTab === t ? "var(--accent-soft)" : "transparent", color: sysTab === t ? "var(--accent)" : "var(--text-secondary)" }}>
                  {t === "hardware" ? <Cpu className="w-3 h-3" /> : <Server className="w-3 h-3" />}
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {sysTab === "hardware" && systemData && (
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* VPN */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <Wifi className="w-4 h-4" style={{ color: systemData.tailscale.active ? "var(--success)" : "var(--error)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Tailscale VPN</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: systemData.tailscale.active ? "var(--success-bg)" : "var(--error-bg)", color: systemData.tailscale.active ? "var(--success)" : "var(--error)" }}>{systemData.tailscale.active ? "Active" : "Down"}</span>
                </div>
                <div className="text-xs mb-2" style={{ color: "var(--text-muted)" }}>IP: <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{systemData.tailscale.ip}</span></div>
                <div className="space-y-1">
                  {systemData.tailscale.devices.map((dev, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{dev.hostname} <span style={{ color: "var(--text-muted)" }}>({dev.os})</span></span>
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: dev.online ? "var(--success)" : "var(--text-muted)" }} />
                    </div>
                  ))}
                </div>
              </div>
              {/* Firewall */}
              <div className="p-3 rounded-lg" style={{ backgroundColor: "var(--card-elevated)" }}>
                <div className="flex items-center gap-2 mb-3">
                  <ShieldCheck className="w-4 h-4" style={{ color: systemData.firewall.active ? "var(--success)" : "var(--error)" }} />
                  <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>Firewall (UFW)</span>
                  <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: systemData.firewall.active ? "var(--success-bg)" : "var(--error-bg)", color: systemData.firewall.active ? "var(--success)" : "var(--error)" }}>{systemData.firewall.active ? "Active" : "Down"}</span>
                </div>
                <div className="space-y-1">
                  {systemData.firewall.rules.slice(0, 6).map((rule, i) => (
                    <div key={i} className="flex items-center justify-between text-[10px]">
                      <span className="font-mono font-medium" style={{ color: "var(--text-secondary)" }}>{rule.port}</span>
                      <span style={{ color: "var(--text-muted)" }}>{rule.from}</span>
                    </div>
                  ))}
                  {systemData.firewall.rules.length > 6 && <div className="text-[10px]" style={{ color: "var(--text-muted)" }}>+{systemData.firewall.rules.length - 6} more rules</div>}
                </div>
              </div>
            </div>
          )}

          {sysTab === "services" && systemData && (
            <div className="p-4 overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Service</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Status</th>
                    <th className="text-left py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Info</th>
                    <th className="text-right py-2 px-2 font-medium" style={{ color: "var(--text-muted)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {systemData.systemd.map(svc => {
                    const isActionable = svc.backend === "pm2" || svc.backend === "systemd";
                    return (
                      <tr key={svc.name} style={{ borderBottom: "1px solid var(--border)" }}>
                        <td className="py-2 px-2"><span className="font-mono font-medium" style={{ color: "var(--text-primary)" }}>{svc.name}</span></td>
                        <td className="py-2 px-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: svc.status === "active" ? "var(--success-bg)" : svc.status === "failed" ? "var(--error-bg)" : "var(--card-elevated)", color: svc.status === "active" ? "var(--success)" : svc.status === "failed" ? "var(--error)" : "var(--text-muted)" }}>{svc.status === "not_deployed" ? "not deployed" : svc.status}</span>
                        </td>
                        <td className="py-2 px-2" style={{ color: "var(--text-muted)" }}>
                          {svc.uptime != null && svc.status === "active" && <span>up {formatUptime(svc.uptime)}{svc.mem != null ? ` · ${formatBytes(svc.mem)}` : ""}</span>}
                        </td>
                        <td className="py-2 px-2">
                          {isActionable && (
                            <div className="flex justify-end gap-1">
                              <button onClick={() => handleServiceAction(svc, "restart")} disabled={actionLoading[`${svc.name}-restart`]} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }} title="Restart">
                                {actionLoading[`${svc.name}-restart`] ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => handleServiceAction(svc, svc.status === "active" ? "stop" : "start")} disabled={svc.status === "not_deployed"} style={{ background: "none", border: "none", cursor: "pointer", color: svc.status === "active" ? "var(--error)" : "var(--success)", padding: "2px" }} title={svc.status === "active" ? "Stop" : "Start"}>
                                {svc.status === "active" ? <Square className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                              </button>
                              <button onClick={() => handleServiceAction(svc, "logs")} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: "2px" }} title="Logs">
                                <TerminalIcon className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed + Quick Links */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Recent Activity</h2>
            </div>
            <Link href="/activity" className="text-xs font-medium" style={{ color: "var(--accent)" }}>View all</Link>
          </div>
          <div className="p-0"><ActivityFeed limit={5} /></div>
        </div>

        <div className="rounded-xl overflow-hidden" style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}>
          <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: "1px solid var(--border)" }}>
            <Blocks className="w-4 h-4" style={{ color: "var(--accent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Quick Links</h2>
          </div>
          <div className="p-3 grid grid-cols-2 gap-2">
            {[
              { href: "/cron", icon: CalendarClock, label: "Cron Jobs", color: "#a78bfa" },
              { href: "/actions", icon: Zap, label: "Actions", color: "var(--accent)" },
              { href: "/skills", icon: Blocks, label: "Skills", color: "#4ade80" },
              { href: "/memory", icon: Activity, label: "Memory", color: "#f59e0b" },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link key={href} href={href} className="p-2.5 rounded-lg transition-all hover:scale-[1.02]" style={{ backgroundColor: "var(--card-elevated)", border: "1px solid var(--border)" }}>
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color }} />
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Logs Modal */}
      {logsModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 1000, backgroundColor: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }}>
          <div style={{ width: "95vw", maxWidth: "900px", height: "80vh", backgroundColor: "#0d1117", borderRadius: "1rem", border: "1px solid var(--border)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
              <TerminalIcon className="w-4 h-4" style={{ color: "var(--accent)" }} />
              <span style={{ color: "#c9d1d9", fontFamily: "monospace", fontSize: "0.9rem" }}>{logsModal.name} logs</span>
              <button onClick={() => setLogsModal(null)} style={{ marginLeft: "auto", padding: "0.375rem", background: "none", border: "none", cursor: "pointer", color: "#8b949e" }}><XIcon className="w-4 h-4" /></button>
            </div>
            <div style={{ flex: 1, overflow: "auto", padding: "1rem" }}>
              {logsModal.loading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}><Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--accent)" }} /></div>
              ) : (
                <pre style={{ fontFamily: "monospace", fontSize: "0.8rem", color: "#c9d1d9", whiteSpace: "pre-wrap", wordBreak: "break-all", lineHeight: 1.6 }}>{logsModal.content || "No output"}</pre>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
