"use client";

import { useState, useRef, useEffect } from "react";
import { X, Send, Loader2, Bot } from "lucide-react";

interface Msg {
  role: "user" | "assistant" | "error";
  text: string;
  ms?: number;
}

export function AgentChatPanel({
  agentId,
  agentName,
  onClose,
}: {
  agentId: string;
  agentName: string;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text }]);
    setBusy(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error del gateway");
      setMessages((m) => [...m, { role: "assistant", text: data.reply, ms: data.duration_ms }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "error", text: err instanceof Error ? err.message : "Error" }]);
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 1050 }}
      role="dialog" aria-label={`Chat con ${agentName}`}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)" }} onClick={onClose} />
      <div
        style={{
          position: "absolute", top: 0, right: 0, bottom: 0,
          width: "min(440px, 100vw)", display: "flex", flexDirection: "column",
          backgroundColor: "var(--surface)", borderLeft: "1px solid var(--border-strong)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        {/* Cabecera */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, height: 48, padding: "0 14px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ width: 24, height: 24, borderRadius: 4, backgroundColor: "var(--surface-hover)", border: "1px solid var(--border-strong)", display: "grid", placeItems: "center", fontSize: 10, fontWeight: 600, color: "var(--text-secondary)" }}>
            {agentName.slice(0, 2).toUpperCase()}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{agentName}</div>
            <div style={{ fontSize: 10.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>sesión principal del gateway</div>
          </div>
          <button onClick={onClose} aria-label="Cerrar chat" style={{ marginLeft: "auto", width: 28, height: 28, display: "grid", placeItems: "center", borderRadius: 6, color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}>
            <X style={{ width: 15, height: 15 }} />
          </button>
        </div>

        {/* Mensajes */}
        <div ref={listRef} style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ margin: "auto", textAlign: "center", color: "var(--text-muted)", fontSize: 12.5, maxWidth: 260, lineHeight: 1.6 }}>
              <Bot style={{ width: 24, height: 24, margin: "0 auto 8px", opacity: 0.4 }} />
              Habla con {agentName} a través del gateway. El turno corre en su sesion principal, igual que un mensaje de Telegram.
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "88%" }}>
              <div
                style={{
                  padding: "8px 11px", borderRadius: 8, fontSize: 13, lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word",
                  backgroundColor: m.role === "user" ? "var(--accent)" : m.role === "error" ? "var(--negative-soft)" : "var(--surface-elevated)",
                  color: m.role === "user" ? "#fff" : m.role === "error" ? "var(--negative)" : "var(--text-primary)",
                  border: m.role === "assistant" ? "1px solid var(--border)" : "none",
                }}
              >
                {m.text}
              </div>
              {m.ms != null && (
                <div style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 3 }}>
                  {(m.ms / 1000).toFixed(1)} s
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 12 }}>
              <Loader2 className="animate-spin" style={{ width: 13, height: 13 }} />
              {agentName} está pensando…
            </div>
          )}
        </div>

        {/* Entrada */}
        <div style={{ padding: 12, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              rows={2}
              placeholder={`Mensaje para ${agentName}\u2026`}
              className="input"
              style={{ flex: 1, resize: "none", fontSize: 13, lineHeight: 1.5 }}
              disabled={busy}
            />
            <button
              onClick={send}
              disabled={busy || !input.trim()}
              aria-label="Enviar"
              className="btn-primary"
              style={{ height: 36, width: 40, padding: 0, opacity: busy || !input.trim() ? 0.5 : 1 }}
            >
              <Send style={{ width: 14, height: 14 }} />
            </button>
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
            Enter envía · Shift+Enter salto de línea · los modelos locales pueden tardar
          </div>
        </div>
      </div>
    </div>
  );
}
