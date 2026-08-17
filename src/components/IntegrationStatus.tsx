"use client";

import { MessageCircle, Cpu, Brain, CheckCircle, XCircle } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  status: "connected" | "disconnected";
  icon: string;
  detail: string | null;
}

interface IntegrationStatusProps {
  integrations: Integration[] | null;
}

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  MessageCircle,
  Cpu,
  Brain,
};

const statusConfig = {
  connected: {
    icon: CheckCircle,
    color: "var(--positive, #10b981)",
    bg: "rgba(16, 185, 129, 0.08)",
    border: "rgba(16, 185, 129, 0.25)",
    label: "Conectado",
  },
  disconnected: {
    icon: XCircle,
    color: "var(--text-muted)",
    bg: "rgba(255, 255, 255, 0.02)",
    border: "var(--border)",
    label: "Desconectado",
  },
};

export function IntegrationStatus({ integrations }: IntegrationStatusProps) {
  if (!integrations) {
    return (
      <div className="rounded-xl p-6 animate-pulse" style={{ backgroundColor: "var(--card)" }}>
        <div className="h-6 rounded w-1/3 mb-4" style={{ backgroundColor: "var(--border)" }} />
        <div className="space-y-3">
          <div className="h-16 rounded" style={{ backgroundColor: "var(--border)" }} />
          <div className="h-16 rounded" style={{ backgroundColor: "var(--border)" }} />
          <div className="h-16 rounded" style={{ backgroundColor: "var(--border)" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)" }}>
      <h2
        className="text-xl font-semibold mb-6 flex items-center gap-2"
        style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
      >
        <MessageCircle className="w-5 h-5" style={{ color: "var(--accent)" }} />
        Integraciones
      </h2>

      <div className="space-y-3">
        {integrations.map((integration) => {
          const Icon = iconMap[integration.icon] || MessageCircle;
          const status = statusConfig[integration.status];
          const StatusIcon = status.icon;

          return (
            <div
              key={integration.id}
              className="flex items-center justify-between p-4 rounded-lg"
              style={{ backgroundColor: status.bg, border: `1px solid ${status.border}` }}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="p-2 rounded-lg flex-shrink-0" style={{ backgroundColor: "var(--surface-hover, rgba(255,255,255,0.05))" }}>
                  <Icon className="w-5 h-5" style={{ color: "var(--text-secondary)" }} />
                </div>
                <div className="min-w-0">
                  <div className="font-medium truncate" style={{ color: "var(--text-primary)" }}>
                    {integration.name}
                  </div>
                  {integration.detail && (
                    <div className="text-xs truncate" style={{ color: "var(--text-muted)" }}>
                      {integration.detail}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0" style={{ color: status.color }}>
                <StatusIcon className="w-4 h-4" />
                <span className="text-sm font-medium">{status.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
