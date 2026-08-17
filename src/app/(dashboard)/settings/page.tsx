"use client";

import { useEffect, useState } from "react";
import { Settings, RefreshCw } from "lucide-react";
import { SystemInfo } from "@/components/SystemInfo";
import { IntegrationStatus } from "@/components/IntegrationStatus";
import { QuickActions } from "@/components/QuickActions";
import { SecurityAudit } from "@/components/SecurityAudit";

interface SystemData {
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
  security: {
    summary: { critical: number; warn: number; info: number };
    findings: Array<{
      checkId: string;
      severity: "critical" | "warn" | "info";
      title: string;
      detail?: string;
      remediation?: string;
    }>;
  } | null;
  integrations: Array<{
    id: string;
    name: string;
    status: "connected" | "disconnected";
    icon: string;
    detail: string | null;
  }>;
  timestamp: string;
}

export default function SettingsPage() {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchSystemData = async () => {
    try {
      const res = await fetch("/api/system");
      const data = await res.json();
      setSystemData(data);
      setLastRefresh(new Date());
    } catch (error) {
      console.error("Failed to fetch system data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSystemData();
    const interval = setInterval(fetchSystemData, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setLoading(true);
    fetchSystemData();
  };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 md:mb-8">
        <div>
          <h1
            className="text-2xl md:text-3xl font-bold mb-1 md:mb-2 flex items-center gap-2 md:gap-3"
            style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
          >
            <Settings className="w-6 h-6 md:w-8 md:h-8" style={{ color: "var(--accent)" }} />
            Settings
          </h1>
          <p className="text-sm md:text-base" style={{ color: "var(--text-secondary)" }}>
            Estado del sistema, integraciones y configuración
          </p>
        </div>

        <button
          onClick={handleRefresh}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 w-full sm:w-auto"
          style={{
            backgroundColor: "var(--card)",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
          }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      {/* Last Refresh Time */}
      {lastRefresh && (
        <div className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>
          Última actualización: {lastRefresh.toLocaleTimeString()}
        </div>
      )}

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* System Info - Full width on first row */}
        <div className="lg:col-span-2">
          <SystemInfo data={systemData} />
        </div>

        {/* Security Audit - Full width */}
        <div className="lg:col-span-2">
          <SecurityAudit data={systemData?.security ?? null} />
        </div>

        {/* Integration Status */}
        <div>
          <IntegrationStatus integrations={systemData?.integrations || null} />
        </div>

        {/* Quick Actions */}
        <div>
          <QuickActions onActionComplete={handleRefresh} />
        </div>
      </div>

      {/* Footer Info */}
      <div
        className="mt-6 md:mt-8 p-3 md:p-4 rounded-xl"
        style={{
          backgroundColor: "rgba(26, 26, 26, 0.5)",
          border: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center justify-between text-sm" style={{ color: "var(--text-muted)" }}>
          <span>Mission Control v1.0.0</span>
          <span>OpenClaw Agent Dashboard</span>
        </div>
      </div>
    </div>
  );
}
