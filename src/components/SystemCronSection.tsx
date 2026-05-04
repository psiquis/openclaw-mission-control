"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Terminal,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  X,
  Check,
} from "lucide-react";
import { cronToHuman } from "@/lib/cron-parser";

export interface SystemCronEntry {
  index: number;
  expr: string;
  command: string;
  comment?: string;
  raw: string;
}

interface InlineFormState {
  expr: string;
  command: string;
  comment: string;
}

const EMPTY_FORM: InlineFormState = { expr: "", command: "", comment: "" };

export function SystemCronSection() {
  const [entries, setEntries] = useState<SystemCronEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inline form
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [form, setForm] = useState<InlineFormState>(EMPTY_FORM);
  const [expandedCommands, setExpandedCommands] = useState<Set<number>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const fetchEntries = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/cron/system");
      if (!res.ok) throw new Error("Failed to fetch system cron jobs");
      const data = await res.json();
      setEntries(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const toggleCommandExpand = (index: number) => {
    setExpandedCommands((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const startEdit = (entry: SystemCronEntry) => {
    setShowAddForm(false);
    setEditingIndex(entry.index);
    setForm({
      expr: entry.expr,
      command: entry.command,
      comment: entry.comment ?? "",
    });
  };

  const cancelForm = () => {
    setShowAddForm(false);
    setEditingIndex(null);
    setForm(EMPTY_FORM);
  };

  const handleSave = async () => {
    if (!form.expr.trim() || !form.command.trim()) return;
    setIsSaving(true);
    try {
      if (editingIndex !== null) {
        // Edit existing
        const res = await fetch("/api/cron/system", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            index: editingIndex,
            expr: form.expr.trim(),
            command: form.command.trim(),
            comment: form.comment.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Save failed");
        }
        const updated = await res.json();
        setEntries(updated);
      } else {
        // Add new
        const res = await fetch("/api/cron/system", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expr: form.expr.trim(),
            command: form.command.trim(),
            comment: form.comment.trim() || undefined,
          }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error ?? "Save failed");
        }
        const updated = await res.json();
        setEntries(updated);
      }
      cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (index: number) => {
    try {
      const res = await fetch("/api/cron/system", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ index }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Delete failed");
      }
      const updated = await res.json();
      setEntries(updated);
      if (editingIndex === index) cancelForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const humanExpr = form.expr.trim() ? (() => {
    try { return cronToHuman(form.expr.trim()); } catch { return ""; }
  })() : "";

  return (
    <div style={{ marginTop: "3rem" }}>
      {/* Divider */}
      <div style={{
        height: "1px",
        backgroundColor: "var(--border)",
        marginBottom: "2rem",
      }} />

      {/* Section Header */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1.5rem",
        flexWrap: "wrap",
        gap: "0.75rem",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{
            padding: "0.6rem",
            backgroundColor: "color-mix(in srgb, #f97316 20%, transparent)",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <Terminal className="w-5 h-5" style={{ color: "#f97316" }} />
          </div>
          <div>
            <h2 style={{
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--text-primary)",
              fontFamily: "var(--font-heading)",
              lineHeight: 1.2,
            }}>
              System Cron Jobs
            </h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: "0.1rem" }}>
              User crontab entries for {"`"}ola3{"`"}
            </p>
          </div>
          <span style={{
            fontSize: "0.75rem",
            fontWeight: 700,
            color: "#f97316",
            backgroundColor: "color-mix(in srgb, #f97316 15%, transparent)",
            border: "1px solid color-mix(in srgb, #f97316 30%, transparent)",
            padding: "0.2rem 0.6rem",
            borderRadius: "9999px",
          }}>
            {entries.length} {entries.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            onClick={() => { setIsLoading(true); fetchEntries(); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.85rem",
              backgroundColor: "var(--card)",
              color: "var(--text-secondary)",
              borderRadius: "0.5rem",
              border: "1px solid var(--border)",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 500,
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            onClick={() => { setEditingIndex(null); setForm(EMPTY_FORM); setShowAddForm(true); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.85rem",
              backgroundColor: "#f97316",
              color: "#000",
              borderRadius: "0.5rem",
              border: "none",
              cursor: "pointer",
              fontSize: "0.8rem",
              fontWeight: 700,
            }}
          >
            <Plus className="w-3.5 h-3.5" />
            Add System Job
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          marginBottom: "1rem",
          padding: "0.75rem 1rem",
          backgroundColor: "color-mix(in srgb, var(--error) 10%, transparent)",
          border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)",
          borderRadius: "0.5rem",
          display: "flex",
          alignItems: "center",
          gap: "0.75rem",
        }}>
          <AlertCircle className="w-4 h-4" style={{ color: "var(--error)", flexShrink: 0 }} />
          <span style={{ color: "var(--error)", fontSize: "0.875rem", flex: 1 }}>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{ color: "var(--error)", background: "none", border: "none", cursor: "pointer", padding: "0" }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Inline Add Form */}
      {showAddForm && (
        <InlineForm
          form={form}
          setForm={setForm}
          humanExpr={humanExpr}
          onSave={handleSave}
          onCancel={cancelForm}
          isSaving={isSaving}
          title="Add System Job"
          accentColor="#f97316"
        />
      )}

      {/* Loading */}
      {isLoading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "2.5rem 0" }}>
          <div style={{
            width: "1.75rem", height: "1.75rem",
            border: "2px solid #f97316", borderTopColor: "transparent",
            borderRadius: "50%", animation: "spin 1s linear infinite",
          }} />
        </div>
      ) : entries.length === 0 && !showAddForm ? (
        <div style={{
          textAlign: "center",
          padding: "3rem 0",
          backgroundColor: "color-mix(in srgb, var(--card) 50%, transparent)",
          border: "1px solid var(--border)",
          borderRadius: "0.75rem",
        }}>
          <div style={{
            width: "3rem", height: "3rem", borderRadius: "0.75rem",
            backgroundColor: "color-mix(in srgb, #f97316 15%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 1rem",
          }}>
            <Terminal className="w-6 h-6" style={{ color: "#f97316" }} />
          </div>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>No system cron entries found</p>
          <p style={{ color: "var(--text-muted)", fontSize: "0.8rem", marginTop: "0.25rem" }}>
            Run <code style={{ fontFamily: "monospace", fontSize: "0.8rem" }}>crontab -l</code> to check manually
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {entries.map((entry) => (
            <div key={entry.index}>
              {/* Edit form for this entry */}
              {editingIndex === entry.index ? (
                <InlineForm
                  form={form}
                  setForm={setForm}
                  humanExpr={humanExpr}
                  onSave={handleSave}
                  onCancel={cancelForm}
                  isSaving={isSaving}
                  title="Edit Entry"
                  accentColor="#f97316"
                />
              ) : (
                <SystemCronCard
                  entry={entry}
                  isExpanded={expandedCommands.has(entry.index)}
                  onToggleExpand={() => toggleCommandExpand(entry.index)}
                  onEdit={() => startEdit(entry)}
                  onDelete={() => handleDelete(entry.index)}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function SystemCronCard({
  entry,
  isExpanded,
  onToggleExpand,
  onEdit,
  onDelete,
}: {
  entry: SystemCronEntry;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const human = (() => {
    try { return cronToHuman(entry.expr); } catch { return entry.expr; }
  })();

  const CMD_TRUNCATE = 80;
  const isLong = entry.command.length > CMD_TRUNCATE;
  const displayCmd = isExpanded || !isLong
    ? entry.command
    : entry.command.slice(0, CMD_TRUNCATE) + "…";

  return (
    <div style={{
      backgroundColor: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: "0.75rem",
      padding: "1rem 1.25rem",
      transition: "border-color 0.2s",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem" }}>
        {/* Left: accent bar */}
        <div style={{
          width: "3px",
          minHeight: "3rem",
          backgroundColor: "#f97316",
          borderRadius: "9999px",
          flexShrink: 0,
          marginTop: "0.15rem",
        }} />

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Comment */}
          {entry.comment && (
            <p style={{
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              marginBottom: "0.4rem",
              fontStyle: "italic",
            }}>
              {entry.comment}
            </p>
          )}

          {/* Expr row */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap", marginBottom: "0.5rem" }}>
            <code style={{
              fontFamily: "monospace",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#f97316",
              backgroundColor: "color-mix(in srgb, #f97316 12%, transparent)",
              padding: "0.2rem 0.55rem",
              borderRadius: "0.35rem",
              whiteSpace: "nowrap",
            }}>
              {entry.expr}
            </code>
            <span style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
              {human}
            </span>
          </div>

          {/* Command */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: "0.5rem" }}>
            <code style={{
              fontFamily: "monospace",
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              backgroundColor: "color-mix(in srgb, var(--border) 40%, transparent)",
              padding: "0.3rem 0.6rem",
              borderRadius: "0.35rem",
              flex: 1,
              wordBreak: "break-all",
              lineHeight: 1.5,
            }}>
              {displayCmd}
            </code>
            {isLong && (
              <button
                onClick={onToggleExpand}
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "0.2rem",
                  flexShrink: 0,
                }}
                title={isExpanded ? "Collapse" : "Expand"}
              >
                {isExpanded
                  ? <ChevronUp className="w-3.5 h-3.5" />
                  : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
          <button
            onClick={onEdit}
            title="Edit"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.45rem",
              backgroundColor: "color-mix(in srgb, var(--info) 12%, transparent)",
              color: "var(--info)",
              border: "1px solid color-mix(in srgb, var(--info) 25%, transparent)",
              borderRadius: "0.4rem",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
            title="Delete"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0.45rem",
              backgroundColor: "color-mix(in srgb, var(--error) 12%, transparent)",
              color: "var(--error)",
              border: "1px solid color-mix(in srgb, var(--error) 25%, transparent)",
              borderRadius: "0.4rem",
              cursor: "pointer",
              transition: "opacity 0.15s",
            }}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Inline Form ──────────────────────────────────────────────────────────────

function InlineForm({
  form,
  setForm,
  humanExpr,
  onSave,
  onCancel,
  isSaving,
  title,
  accentColor,
}: {
  form: InlineFormState;
  setForm: (f: InlineFormState) => void;
  humanExpr: string;
  onSave: () => void;
  onCancel: () => void;
  isSaving: boolean;
  title: string;
  accentColor: string;
}) {
  const isValid = form.expr.trim() && form.command.trim();

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "0.55rem 0.75rem",
    backgroundColor: "color-mix(in srgb, var(--card) 80%, transparent)",
    border: "1px solid var(--border)",
    borderRadius: "0.4rem",
    color: "var(--text-primary)",
    fontSize: "0.85rem",
    fontFamily: "monospace",
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "0.3rem",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{
      backgroundColor: "var(--card)",
      border: `1px solid ${accentColor}`,
      borderRadius: "0.75rem",
      padding: "1.25rem",
      marginBottom: "0.75rem",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "1rem",
      }}>
        <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "0.9rem" }}>
          {title}
        </span>
        <button
          onClick={onCancel}
          style={{
            display: "flex", alignItems: "center",
            background: "none", border: "none", cursor: "pointer",
            color: "var(--text-muted)", padding: "0.2rem",
          }}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
        {/* Cron Expression */}
        <div>
          <label style={labelStyle}>Cron Expression</label>
          <input
            style={inputStyle}
            placeholder="e.g. 0 6 * * *"
            value={form.expr}
            onChange={(e) => setForm({ ...form, expr: e.target.value })}
          />
          {humanExpr && (
            <p style={{ fontSize: "0.75rem", color: accentColor, marginTop: "0.3rem" }}>
              → {humanExpr}
            </p>
          )}
        </div>

        {/* Command */}
        <div>
          <label style={labelStyle}>Command</label>
          <textarea
            style={{ ...inputStyle, minHeight: "4rem", resize: "vertical", fontFamily: "monospace" }}
            placeholder="e.g. bash /home/ola3/scripts/backup.sh >> /var/log/backup.log 2>&1"
            value={form.command}
            onChange={(e) => setForm({ ...form, command: e.target.value })}
          />
        </div>

        {/* Comment */}
        <div>
          <label style={labelStyle}>Comment <span style={{ fontWeight: 400, textTransform: "none" }}>(optional)</span></label>
          <input
            style={inputStyle}
            placeholder="Short description (will appear as # comment above)"
            value={form.comment}
            onChange={(e) => setForm({ ...form, comment: e.target.value })}
          />
        </div>

        {/* Actions */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            onClick={onCancel}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "var(--card)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border)",
              borderRadius: "0.4rem",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!isValid || isSaving}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.5rem 1rem",
              backgroundColor: isValid ? accentColor : "var(--border)",
              color: isValid ? "#000" : "var(--text-muted)",
              border: "none",
              borderRadius: "0.4rem",
              cursor: isValid ? "pointer" : "not-allowed",
              fontSize: "0.85rem",
              fontWeight: 700,
            }}
          >
            <Check className="w-3.5 h-3.5" />
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
