"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard no disponible */ }
  };

  return (
    <button
      onClick={copy}
      aria-label={label || `Copiar ${value}`}
      title={copied ? "Copiado" : "Copiar"}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 20, height: 20, borderRadius: 4, verticalAlign: "middle",
        color: copied ? "var(--positive)" : "var(--text-muted)",
        background: "none", border: "none", cursor: "pointer", marginLeft: 4,
      }}
    >
      {copied ? <Check style={{ width: 12, height: 12 }} /> : <Copy style={{ width: 12, height: 12 }} />}
    </button>
  );
}
