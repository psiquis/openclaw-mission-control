"use client";

import { useState } from "react";
import {
  RefreshCw,
  Trash2,
  FileText,
  Key,
  Loader2,
  CheckCircle,
  AlertCircle,
  X,
} from "lucide-react";
import { ChangePasswordModal } from "./ChangePasswordModal";

interface QuickActionsProps {
  onActionComplete?: () => void;
}

interface ActionButton {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  action: () => Promise<void> | void;
}

export function QuickActions({ onActionComplete }: QuickActionsProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [logsModal, setLogsModal] = useState<{ loading: boolean; content: string } | null>(null);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const showNotification = (type: "success" | "error", message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  const handleRestartGateway = async () => {
    if (
      !window.confirm(
        "¿Reiniciar el gateway de OpenClaw? Los bots de Telegram y todas las sesiones activas se interrumpirán unos segundos."
      )
    ) {
      return;
    }
    setLoadingAction("restart");
    try {
      const res = await fetch("/api/system/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "openclaw-gateway", backend: "systemd", action: "restart" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Fallo al reiniciar el gateway");
      showNotification("success", "Gateway reiniciado. Puede tardar unos segundos en volver a responder.");
      setTimeout(() => onActionComplete?.(), 3000);
    } catch (err) {
      showNotification("error", err instanceof Error ? err.message : "No se pudo reiniciar el gateway");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleClearActivityLog = async () => {
    setLoadingAction("clear_log");
    try {
      const res = await fetch("/api/system", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear_activity_log" }),
      });
      if (!res.ok) throw new Error("Failed to clear log");
      showNotification("success", "Registro de actividad borrado");
      onActionComplete?.();
    } catch {
      showNotification("error", "No se pudo borrar el registro de actividad");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleViewLogs = async () => {
    setLogsModal({ loading: true, content: "" });
    try {
      const res = await fetch("/api/system/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "openclaw-gateway", backend: "systemd", action: "logs" }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "No se pudieron leer los logs");
      setLogsModal({ loading: false, content: json.output || "Sin salida" });
    } catch (err) {
      setLogsModal({ loading: false, content: err instanceof Error ? err.message : "Error al leer los logs" });
    }
  };

  const actions: ActionButton[] = [
    { id: "restart", label: "Reiniciar Gateway", icon: RefreshCw, action: handleRestartGateway },
    { id: "clear_log", label: "Borrar registro de actividad", icon: Trash2, action: handleClearActivityLog },
    { id: "view_logs", label: "Ver logs del Gateway", icon: FileText, action: handleViewLogs },
    { id: "change_password", label: "Cambiar contraseña", icon: Key, action: () => setShowPasswordModal(true) },
  ];

  return (
    <>
      <div className="rounded-xl p-6" style={{ backgroundColor: "var(--card)" }}>
        <h2
          className="text-xl font-semibold mb-6 flex items-center gap-2"
          style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}
        >
          <RefreshCw className="w-5 h-5" style={{ color: "var(--accent)" }} />
          Acciones rápidas
        </h2>

        {notification && (
          <div
            className="flex items-center gap-2 p-3 rounded-lg mb-4 text-sm"
            style={{
              backgroundColor: notification.type === "success" ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)",
              border: `1px solid ${notification.type === "success" ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
              color: notification.type === "success" ? "var(--positive, #10b981)" : "var(--negative, #ef4444)",
            }}
          >
            {notification.type === "success" ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{notification.message}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            const isLoading = loadingAction === action.id;
            return (
              <button
                key={action.id}
                onClick={() => action.action()}
                disabled={isLoading}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: "rgba(26, 26, 26, 0.5)",
                  border: "1px solid var(--border)",
                  color: "var(--text-primary)",
                }}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" style={{ color: "var(--accent)" }} />}
                <span className="font-medium text-sm">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <ChangePasswordModal
        isOpen={showPasswordModal}
        onClose={() => setShowPasswordModal(false)}
        onSuccess={(message) => {
          showNotification("success", message);
          setShowPasswordModal(false);
        }}
      />

      {logsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setLogsModal(null)} />
          <div
            className="relative rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center justify-between p-4" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3 className="font-semibold flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                <FileText className="w-4 h-4" style={{ color: "var(--accent)" }} />
                Logs del Gateway (últimas 100 líneas)
              </h3>
              <button onClick={() => setLogsModal(null)} style={{ color: "var(--text-muted)" }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-auto flex-1">
              {logsModal.loading ? (
                <div className="flex items-center gap-2 text-sm" style={{ color: "var(--text-muted)" }}>
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando logs…
                </div>
              ) : (
                <pre className="text-xs whitespace-pre-wrap font-mono" style={{ color: "var(--text-secondary)" }}>
                  {logsModal.content}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
