"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Search, CornerDownLeft, Loader2, Gauge, Bot, Bolt, ScrollText,
  TerminalSquare, GitCompareArrows, Route, Activity, CalendarClock,
  Blocks, BrainCircuit, FolderTree, MessageSquareText, TrendingUp,
  ClipboardList, Cog, Play, FileText,
} from "lucide-react";

interface PageCmd { kind: "page"; label: string; href: string; icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; keywords: string }
interface CronCmd { kind: "cron"; label: string; id: string }
interface ActionCmd { kind: "action"; label: string; id: string; dangerous?: boolean }
interface SearchCmd { kind: "result"; label: string; snippet: string; href: string }
type Cmd = PageCmd | CronCmd | ActionCmd | SearchCmd;

const PAGES: PageCmd[] = [
  { kind: "page", label: "Dashboard", href: "/", icon: Gauge, keywords: "inicio home panel" },
  { kind: "page", label: "Agents", href: "/agents", icon: Bot, keywords: "agentes" },
  { kind: "page", label: "Quick Actions", href: "/actions", icon: Bolt, keywords: "acciones rapidas" },
  { kind: "page", label: "Live Logs", href: "/logs", icon: ScrollText, keywords: "registros" },
  { kind: "page", label: "Terminal", href: "/terminal", icon: TerminalSquare, keywords: "consola shell" },
  { kind: "page", label: "Git", href: "/git", icon: GitCompareArrows, keywords: "repos commits" },
  { kind: "page", label: "Workflows", href: "/workflows", icon: Route, keywords: "flujos" },
  { kind: "page", label: "Activity", href: "/activity", icon: Activity, keywords: "actividad historial" },
  { kind: "page", label: "Cron Jobs", href: "/cron", icon: CalendarClock, keywords: "tareas programadas" },
  { kind: "page", label: "Skills", href: "/skills", icon: Blocks, keywords: "habilidades" },
  { kind: "page", label: "Memory", href: "/memory", icon: BrainCircuit, keywords: "memoria notas" },
  { kind: "page", label: "Files", href: "/files", icon: FolderTree, keywords: "archivos ficheros" },
  { kind: "page", label: "Sessions", href: "/sessions", icon: MessageSquareText, keywords: "sesiones" },
  { kind: "page", label: "Analytics", href: "/analytics", icon: TrendingUp, keywords: "analitica" },
  { kind: "page", label: "Reports", href: "/reports", icon: ClipboardList, keywords: "informes" },
  { kind: "page", label: "System", href: "/system", icon: Cog, keywords: "sistema monitor" },
  { kind: "page", label: "Settings", href: "/settings", icon: Cog, keywords: "ajustes configuracion" },
];

const QUICK_ACTIONS: ActionCmd[] = [
  { kind: "action", id: "heartbeat", label: "Comprobar heartbeat" },
  { kind: "action", id: "git-status", label: "Git status (todos los repos)" },
  { kind: "action", id: "usage-stats", label: "Recoger estadisticas de uso" },
  { kind: "action", id: "restart-gateway", label: "Reiniciar gateway", dangerous: true },
  { kind: "action", id: "npm-audit", label: "Auditoria npm" },
];

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [sel, setSel] = useState(0);
  const [crons, setCrons] = useState<CronCmd[]>([]);
  const [searchResults, setSearchResults] = useState<SearchCmd[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo global
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const onOpenEvt = () => setOpen(true);
    window.addEventListener("open-command-palette", onOpenEvt);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("open-command-palette", onOpenEvt);
    };
  }, []);

  // Al abrir: foco + cargar crons
  useEffect(() => {
    if (!open) { setQuery(""); setSel(0); setNotice(null); return; }
    setTimeout(() => inputRef.current?.focus(), 30);
    fetch("/api/cron")
      .then((r) => r.json())
      .then((jobs) => {
        if (Array.isArray(jobs)) {
          setCrons(jobs.map((j: { id: string; name: string }) => ({ kind: "cron" as const, id: j.id, label: j.name })));
        }
      })
      .catch(() => {});
  }, [open]);

  // Busqueda remota con debounce
  useEffect(() => {
    if (!open || query.length < 2) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setSearchResults(data.slice(0, 5).map((r: { type: string; title: string; snippet: string }) => ({
            kind: "result" as const,
            label: r.title,
            snippet: r.snippet,
            href: r.type === "memory" ? "/memory" : r.type === "activity" ? "/activity" : "/search",
          })));
        }
      } catch { setSearchResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const q = norm(query);
  const pages = PAGES.filter((p) => !q || norm(p.label + " " + p.keywords).includes(q));
  const cronCmds = q ? crons.filter((c) => norm(c.label).includes(q)).slice(0, 6) : crons.slice(0, 4);
  const actionCmds = QUICK_ACTIONS.filter((a) => !q || norm(a.label).includes(q));
  const pageItems = pages.slice(0, q ? 6 : 8);
  const actItems = actionCmds.slice(0, q ? 5 : 3);
  const flat: Cmd[] = [...pageItems, ...cronCmds, ...actItems, ...searchResults];
  const selIdx = Math.min(sel, Math.max(flat.length - 1, 0));

  const run = useCallback(async (cmd: Cmd) => {
    if (cmd.kind === "page" || cmd.kind === "result") { setOpen(false); router.push(cmd.href); return; }
    if (cmd.kind === "cron") {
      setBusy(cmd.id);
      try {
        const res = await fetch("/api/cron/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: cmd.id }) });
        setNotice(res.ok ? `Lanzado: ${cmd.label}` : `Error al lanzar ${cmd.label}`);
      } catch { setNotice(`Error al lanzar ${cmd.label}`); }
      setBusy(null);
      return;
    }
    if (cmd.kind === "action") {
      if (cmd.dangerous && !window.confirm(`Ejecutar "${cmd.label}"? Es una accion con impacto en el servicio.`)) return;
      setBusy(cmd.id);
      try {
        const res = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: cmd.id }) });
        const data = await res.json();
        setNotice(data.status === "success" ? `Completada: ${cmd.label} (${data.duration_ms}ms)` : `Fallo: ${cmd.label}`);
      } catch { setNotice(`Fallo: ${cmd.label}`); }
      setBusy(null);
    }
  }, [router]);

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(s + 1, flat.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === "Enter" && flat[selIdx]) { e.preventDefault(); run(flat[selIdx]); }
  };

  if (!open) return null;

  const sections: Array<{ title: string; items: Cmd[]; offset: number }> = [];
  let off = 0;
  if (pageItems.length) { sections.push({ title: "Ir a", items: pageItems, offset: off }); off += pageItems.length; }
  if (cronCmds.length) { sections.push({ title: "Cron jobs — ejecutar ahora", items: cronCmds, offset: off }); off += cronCmds.length; }
  if (actItems.length) { sections.push({ title: "Quick actions", items: actItems, offset: off }); off += actItems.length; }
  if (searchResults.length) { sections.push({ title: "Resultados", items: searchResults, offset: off }); }

  return (
    <div
      role="dialog" aria-modal="true" aria-label="Paleta de comandos"
      style={{ position: "fixed", inset: 0, zIndex: 1100, backgroundColor: "rgba(0,0,0,0.6)", display: "flex", alignItems: "flex-start", justifyContent: "center", paddingTop: "12vh" }}
      onClick={() => setOpen(false)}
    >
      <div
        style={{ width: "min(560px, 92vw)", backgroundColor: "var(--surface-elevated)", border: "1px solid var(--border-strong)", borderRadius: "10px", boxShadow: "var(--shadow-lg)", overflow: "hidden" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderBottom: "1px solid var(--border)" }}>
          <Search style={{ width: 15, height: 15, color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={onInputKey}
            placeholder="Buscar paginas, cron jobs, acciones…"
            style={{ flex: 1, background: "none", border: "none", outline: "none", color: "var(--text-primary)", fontSize: 14 }}
          />
          <kbd style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-muted)", border: "1px solid var(--border-strong)", borderRadius: 3, padding: "1px 5px" }}>esc</kbd>
        </div>
        <div style={{ maxHeight: "52vh", overflowY: "auto", padding: "6px 0" }}>
          {flat.length === 0 && (
            <div style={{ padding: "24px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Sin resultados para «{query}»</div>
          )}
          {sections.map((section) => (
            <div key={section.title}>
              <div style={{ padding: "6px 14px 4px", fontSize: 10.5, fontWeight: 500, color: "var(--text-muted)" }}>{section.title}</div>
              {section.items.map((cmd, i) => {
                const idx = section.offset + i;
                const active = idx === selIdx;
                const isBusy = busy !== null && (cmd.kind === "cron" || cmd.kind === "action") && busy === (cmd as CronCmd | ActionCmd).id;
                return (
                  <button
                    key={idx}
                    onClick={() => run(cmd)}
                    onMouseEnter={() => setSel(idx)}
                    style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "7px 14px", backgroundColor: active ? "var(--surface-hover)" : "transparent", color: active ? "var(--text-primary)" : "var(--text-secondary)", fontSize: 13, cursor: "pointer", border: "none" }}
                  >
                    {cmd.kind === "page" && <cmd.icon style={{ width: 14, height: 14, color: "var(--text-muted)", flexShrink: 0 }} />}
                    {cmd.kind === "cron" && (isBusy ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: "var(--accent-fg)" }} /> : <Play style={{ width: 14, height: 14, color: "var(--text-muted)", flexShrink: 0 }} />)}
                    {cmd.kind === "action" && (isBusy ? <Loader2 className="animate-spin" style={{ width: 14, height: 14, color: "var(--accent-fg)" }} /> : <Bolt style={{ width: 14, height: 14, color: cmd.dangerous ? "var(--warning)" : "var(--text-muted)", flexShrink: 0 }} />)}
                    {cmd.kind === "result" && <FileText style={{ width: 14, height: 14, color: "var(--text-muted)", flexShrink: 0 }} />}
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cmd.label}</span>
                    {cmd.kind === "result" && <span style={{ fontSize: 11, color: "var(--text-muted)", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(cmd as SearchCmd).snippet}</span>}
                    {active && <CornerDownLeft style={{ width: 12, height: 12, color: "var(--text-muted)", flexShrink: 0 }} />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        {notice && (
          <div style={{ padding: "8px 14px", borderTop: "1px solid var(--border)", fontSize: 12, color: "var(--text-secondary)" }}>{notice}</div>
        )}
      </div>
    </div>
  );
}
