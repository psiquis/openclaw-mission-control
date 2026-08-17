"use client";

import { Server, Clock, Cpu, Brain, FolderOpen, HardDrive } from "lucide-react";

interface SystemInfoProps {
  data: {
    agent: {
      name: string | null;
      id: string;
    };
    system: {
      missionControlUptimeFormatted: string;
      nodeVersion: string;
      workspacePath: string;
      platform: string;
      hostname: string;
      memory: {
        total: number;
        free: number;
        used: number;
      };
    };
    gateway: {
      reachable: boolean;
      status: string;
      state: string;
      pid: number | null;
      restarts: number;
      version: string | null;
      latencyMs: number | null;
      model: string;
    } | null;
  } | null;
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return `${gb.toFixed(1)} GB`;
}

export function SystemInfo({ data }: SystemInfoProps) {
  if (!data) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={{ backgroundColor: "var(--card)" }}>
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: "var(--border)" }}></div>
        <div className="space-y-3">
          <div className="h-4 rounded w-2/3" style={{ backgroundColor: "var(--border)" }}></div>
          <div className="h-4 rounded w-1/2" style={{ backgroundColor: "var(--border)" }}></div>
          <div className="h-4 rounded w-3/4" style={{ backgroundColor: "var(--border)" }}></div>
        </div>
      </div>
    );
  }

  const { gateway } = data;
  const gwOk = gateway?.reachable && gateway.status === "running";

  const infoItems = [
    {
      icon: Server,
      label: "Agente",
      value: data.agent.name || "Sin definir",
      sublabel: data.agent.name
        ? `agente OpenClaw "${data.agent.id}"`
        : `edita IDENTITY.md en el workspace de "${data.agent.id}"`,
    },
    {
      icon: Clock,
      label: "Mission Control",
      value: data.system.missionControlUptimeFormatted,
      sublabel: `${data.system.hostname} · en ejecución`,
    },
    {
      icon: Cpu,
      label: "Node.js",
      value: data.system.nodeVersion,
      sublabel: data.system.platform,
    },
    {
      icon: Brain,
      label: "Modelo activo",
      value: gateway ? gateway.model.split("/").pop() || gateway.model : "—",
      sublabel: gateway?.model.includes("/") ? gateway.model.split("/")[0] : "proveedor",
    },
    {
      icon: FolderOpen,
      label: "Workspace",
      value: data.system.workspacePath.split("/").pop() || "workspace",
      sublabel: data.system.workspacePath,
    },
    {
      icon: HardDrive,
      label: "Memoria del sistema",
      value: `${formatBytes(data.system.memory.used)} / ${formatBytes(data.system.memory.total)}`,
      sublabel: `${formatBytes(data.system.memory.free)} libres`,
    },
  ];

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)" }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h2
          className="text-xl font-semibold flex items-center gap-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
          <Server className="w-5 h-5" style={{ color: "var(--accent)" }} />
          System Information
        </h2>

        {gateway && (
          <div
            className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full"
            style={{
              backgroundColor: gwOk ? "rgba(16, 185, 129, 0.1)" : "rgba(239, 68, 68, 0.1)",
              color: gwOk ? "var(--positive, #10b981)" : "var(--negative, #ef4444)",
              border: `1px solid ${gwOk ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: gwOk ? "var(--positive, #10b981)" : "var(--negative, #ef4444)" }}
            />
            Gateway {gwOk ? "activo" : gateway.status} · PID {gateway.pid ?? "—"} · {gateway.restarts}{" "}
            reinicio{gateway.restarts === 1 ? "" : "s"} · v{gateway.version || "?"}
            {gateway.latencyMs != null && ` · ${gateway.latencyMs}ms`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {infoItems.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="flex items-start gap-4 p-4 rounded-lg"
              style={{
                backgroundColor: "rgba(26, 26, 26, 0.5)",
                border: "1px solid rgba(42, 42, 42, 0.5)",
              }}
            >
              <div className="p-2 rounded-lg" style={{ backgroundColor: "rgba(255, 59, 48, 0.1)" }}>
                <Icon className="w-5 h-5" style={{ color: "var(--accent)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>
                  {item.label}
                </div>
                <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                  {item.value}
                </div>
                <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                  {item.sublabel}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
