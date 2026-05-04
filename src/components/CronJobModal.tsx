"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { X, ChevronDown, ChevronUp, Zap, Calendar, Terminal, Settings2, Blocks, Info, Trash2 } from "lucide-react";

// ---- InfoTip Component ----
function InfoTip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  return (
    <span ref={ref} style={{ position: "relative", display: "inline-flex", alignItems: "center", marginLeft: "0.25rem", cursor: "help" }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      <Info className="w-3.5 h-3.5" style={{ color: "var(--text-muted)", opacity: 0.6 }} />
      {show && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 6px)", left: "50%", transform: "translateX(-50%)",
          padding: "0.5rem 0.75rem", borderRadius: "0.5rem", fontSize: "0.72rem", lineHeight: 1.4,
          backgroundColor: "var(--card)", border: "1px solid var(--border)", color: "var(--text-secondary)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.3)", whiteSpace: "normal", width: "220px", zIndex: 100,
          pointerEvents: "none",
        }}>{text}</span>
      )}
    </span>
  );
}

// ---- Task Presets ----
type TaskPreset = "script" | "agent" | "simple" | "custom";
const TASK_PRESETS: Array<{ id: TaskPreset; emoji: string; label: string; desc: string }> = [
  { id: "script", emoji: "\u{1F527}", label: "Script directo", desc: "Ejecuta un script bash/python. R\u00e1pido y ligero." },
  { id: "agent", emoji: "\u{1F916}", label: "Tarea de agente", desc: "El agente piensa, razona y usa herramientas." },
  { id: "simple", emoji: "\u{1F4DD}", label: "Respuesta simple", desc: "Solo texto, sin ejecutar nada." },
  { id: "custom", emoji: "\u2699\uFE0F", label: "Personalizado", desc: "Configura manualmente todas las opciones." },
];
function applyPreset(preset: TaskPreset): { thinking: string; lightContext: boolean; tools: string; timeoutSeconds: number } {
  switch (preset) {
    case "script": return { thinking: "off", lightContext: true, tools: "exec,read,write", timeoutSeconds: 180 };
    case "agent": return { thinking: "", lightContext: false, tools: "", timeoutSeconds: 600 };
    case "simple": return { thinking: "off", lightContext: true, tools: "none", timeoutSeconds: 120 };
    default: return { thinking: "", lightContext: false, tools: "", timeoutSeconds: 300 };
  }
}
function detectPreset(thinking: string, lightContext: boolean, tools: string, timeout: number): TaskPreset {
  if (thinking === "off" && lightContext && tools === "exec,read,write" && timeout <= 180) return "script";
  if (!thinking && !lightContext && !tools && timeout >= 300) return "agent";
  if (thinking === "off" && lightContext && tools === "none" && timeout <= 120) return "simple";
  return "custom";
}
import { cronToHuman, getNextRuns, isValidCron, CRON_PRESETS } from "@/lib/cron-parser";
import type { CronJob } from "./CronJobCard";

// ---- Skill Selector for Cron (Phase 3) ----
function SkillSelector({ onSelect }: { onSelect: (skillName: string) => void }) {
  const [skills, setSkills] = useState<Array<{ id: string; name: string; description: string | null; risk_level: string; category: string; enabled: number }>>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (open && skills.length === 0) {
      fetch('/api/skills').then(r => r.json()).then(d => {
        setSkills((d.skills || []).filter((s: { enabled: number }) => s.enabled === 1));
      }).catch(() => {});
    }
  }, [open, skills.length]);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: "0.4rem",
          padding: "0.4rem 0.75rem", borderRadius: "0.5rem",
          border: "1px solid var(--border)", background: "var(--surface)",
          color: "var(--text-secondary)", fontSize: "0.8rem", fontWeight: 500, cursor: "pointer",
          marginBottom: open ? "0.5rem" : 0,
        }}
      >
        <Blocks className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
        {open ? "Hide skills" : "Insert from skill"}
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem",
          maxHeight: "180px", overflowY: "auto", padding: "0.5rem",
          borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--surface)",
          marginBottom: "0.5rem",
        }}>
          {skills.length === 0 && <span style={{ color: "var(--text-muted)", fontSize: "0.75rem", gridColumn: "1/-1" }}>No skills found. Run a scan first.</span>}
          {skills.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSelect(s.name); setOpen(false); }}
              style={{
                textAlign: "left", padding: "0.5rem", borderRadius: "0.4rem",
                border: "1px solid var(--border)", background: "var(--background)",
                cursor: "pointer", fontSize: "0.75rem",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
            >
              <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: "2px" }}>{s.name}</div>
              <div style={{ color: "var(--text-muted)", fontSize: "0.65rem" }}>
                {s.category}{s.risk_level !== "low" ? ` · ${s.risk_level} risk` : ""}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ---- End Skill Selector ----

interface CronJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (job: CronJob) => void;
  onDelete?: (id: string) => void;
  editingJob?: CronJob | null;
}

const TIMEZONES = [
  "UTC", "Europe/Madrid", "America/New_York", "America/Chicago",
  "America/Denver", "America/Los_Angeles", "Europe/London",
  "Europe/Paris", "Europe/Berlin", "Asia/Tokyo", "Asia/Shanghai",
  "Asia/Singapore", "Australia/Sydney",
];

const AGENTS = [
  { id: "", label: "Default", emoji: "🤖" },
  { id: "ruben", label: "Rubén", emoji: "🧠" },
  { id: "bill", label: "Bill", emoji: "🖥️" },
  { id: "elon", label: "Elon", emoji: "🚀" },
  { id: "quin", label: "Quin", emoji: "⚡" },
  { id: "trump", label: "Trump", emoji: "📢" },
  { id: "warren", label: "Warren", emoji: "💰" },
];

const MODELS = [
  { value: "", label: "Default" },
  { value: "opus", label: "Opus" },
  { value: "sonnet", label: "Sonnet" },
  { value: "sonnet-4-6", label: "Sonnet 4.6" },
  { value: "mini", label: "Mini" },
  { value: "haiku", label: "Haiku" },
  { value: "gemini-flash", label: "Gemini Flash" },
  { value: "gemini-pro", label: "Gemini Pro" },
];

const THINKING_LEVELS = [
  { value: "", label: "Default" },
  { value: "off", label: "Off" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "Extra High" },
];

const DELIVERY_CHANNELS = [
  { value: "telegram", label: "Telegram" },
  { value: "discord", label: "Discord" },
  { value: "slack", label: "Slack" },
  { value: "whatsapp", label: "WhatsApp" },
];

type ScheduleKind = "cron" | "every" | "at";
type SessionTarget = "main" | "isolated" | "custom";
type PayloadKind = "agentTurn" | "systemEvent";

// Visual builder modes for cron
type FrequencyMode = "every-minutes" | "hourly" | "daily" | "weekly" | "monthly" | "custom";

const FREQUENCY_MODES: Array<{ id: FrequencyMode; label: string; emoji: string }> = [
  { id: "every-minutes", label: "Every N min", emoji: "⏱️" },
  { id: "hourly", label: "Hourly", emoji: "🕐" },
  { id: "daily", label: "Daily", emoji: "☀️" },
  { id: "weekly", label: "Weekly", emoji: "📅" },
  { id: "monthly", label: "Monthly", emoji: "🗓️" },
  { id: "custom", label: "Custom", emoji: "⚙️" },
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES_OPTIONS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function buildCron(mode: FrequencyMode, opts: Record<string, number | number[]>): string {
  switch (mode) {
    case "every-minutes":
      return `*/${opts.minutes || 5} * * * *`;
    case "hourly":
      return `${opts.minute || 0} * * * *`;
    case "daily":
      return `${opts.minute || 0} ${opts.hour || 9} * * *`;
    case "weekly": {
      const days = Array.isArray(opts.days) && opts.days.length > 0 ? opts.days.join(",") : "1";
      return `${opts.minute || 0} ${opts.hour || 9} * * ${days}`;
    }
    case "monthly":
      return `${opts.minute || 0} ${opts.hour || 9} ${opts.day || 1} * *`;
    default:
      return "0 9 * * *";
  }
}

function formatEveryDuration(value: number, unit: string): string {
  return `${value}${unit}`;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "0.6rem 0.75rem",
  backgroundColor: "var(--card-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "0.5rem",
  color: "var(--text-primary)",
  outline: "none",
  fontSize: "0.85rem",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "0.8rem",
  fontWeight: 600,
  color: "var(--text-secondary)",
  marginBottom: "0.375rem",
};

const sectionStyle: React.CSSProperties = {
  padding: "1rem",
  backgroundColor: "var(--card-elevated)",
  borderRadius: "0.75rem",
  border: "1px solid var(--border)",
};

export function CronJobModal({ isOpen, onClose, onSave, onDelete, editingJob }: CronJobModalProps) {
  // Section 1: Basic info
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  // Section 2: Schedule
  const [scheduleKind, setScheduleKind] = useState<ScheduleKind>("cron");
  const [cronExpr, setCronExpr] = useState("0 9 * * *");
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>("daily");
  const [everyMinutes, setEveryMinutes] = useState(15);
  const [selectedHour, setSelectedHour] = useState(9);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [selectedDays, setSelectedDays] = useState<number[]>([1]);
  const [selectedDayOfMonth, setSelectedDayOfMonth] = useState(1);
  const [everyValue, setEveryValue] = useState(10);
  const [everyUnit, setEveryUnit] = useState("m");
  const [atDate, setAtDate] = useState("");
  const [atTime, setAtTime] = useState("09:00");
  const [timezone, setTimezone] = useState("Europe/Madrid");

  // Section 3: Execution
  const [agentId, setAgentId] = useState("");
  const [sessionTarget, setSessionTarget] = useState<SessionTarget>("isolated");
  const [customSession, setCustomSession] = useState("");
  const [payloadKind, setPayloadKind] = useState<PayloadKind>("agentTurn");
  const [message, setMessage] = useState("");

  // Task preset
  const [taskPreset, setTaskPreset] = useState<TaskPreset>("script");

  // Section 4: Advanced
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [model, setModel] = useState("");
  const [thinking, setThinking] = useState("");
  const [timeoutSeconds, setTimeoutSeconds] = useState(30);
  const [lightContext, setLightContext] = useState(false);
  const [tools, setTools] = useState("");
  const [exact, setExact] = useState(false);
  const [announce, setAnnounce] = useState<boolean | null>(null);
  const [deliveryChannel, setDeliveryChannel] = useState("");
  const [deliveryTo, setDeliveryTo] = useState("");
  const [deleteAfterRun, setDeleteAfterRun] = useState(false);

  // UI state
  const [showPresets, setShowPresets] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Apply task preset
  useEffect(() => {
    if (taskPreset !== "custom") {
      const p = applyPreset(taskPreset);
      setThinking(p.thinking);
      setLightContext(p.lightContext);
      setTools(p.tools);
      setTimeoutSeconds(p.timeoutSeconds);
      setShowAdvanced(false);
    } else {
      setShowAdvanced(true);
    }
  }, [taskPreset]);

  // Auto-set payload kind based on session
  useEffect(() => {
    if (sessionTarget === "main") {
      setPayloadKind("systemEvent");
    } else if (sessionTarget === "isolated") {
      setPayloadKind("agentTurn");
    }
  }, [sessionTarget]);

  // Auto-fill delivery based on agent selection
  useEffect(() => {
    if (agentId && announce !== false) {
      setDeliveryChannel("telegram");
      setDeliveryTo("257725883");
      if (announce === null) setAnnounce(true);
    }
  }, [agentId]);

  // Update cronExpr when visual builder changes
  useEffect(() => {
    if (scheduleKind !== "cron" || frequencyMode === "custom") return;
    const newCron = buildCron(frequencyMode, {
      minutes: everyMinutes,
      minute: selectedMinute,
      hour: selectedHour,
      days: selectedDays,
      day: selectedDayOfMonth,
    });
    setCronExpr(newCron);
  }, [scheduleKind, frequencyMode, everyMinutes, selectedHour, selectedMinute, selectedDays, selectedDayOfMonth]);

  // Populate from editingJob
  useEffect(() => {
    if (!isOpen) return;
    if (editingJob) {
      setName(editingJob.name || "");
      setDescription(editingJob.description || "");
      setTimezone(editingJob.timezone || "Europe/Madrid");
      setAgentId(editingJob.agentId || "");
      setMessage(editingJob.message || editingJob.description || "");

      // Parse schedule
      const sched = editingJob.schedule as Record<string, unknown>;
      if (sched && typeof sched === "object") {
        if (sched.kind === "cron") {
          setScheduleKind("cron");
          setCronExpr((sched.expr as string) || "0 9 * * *");
          setFrequencyMode("custom");
        } else if (sched.kind === "every") {
          setScheduleKind("every");
          const ms = sched.everyMs as number;
          if (ms >= 3600000) {
            setEveryValue(ms / 3600000);
            setEveryUnit("h");
          } else {
            setEveryValue(ms / 60000);
            setEveryUnit("m");
          }
        } else if (sched.kind === "at") {
          setScheduleKind("at");
          const atStr = sched.at as string;
          if (atStr) {
            const d = new Date(atStr);
            setAtDate(d.toISOString().split("T")[0]);
            setAtTime(d.toISOString().split("T")[1]?.substring(0, 5) || "09:00");
          }
        }
      } else if (typeof editingJob.schedule === "string") {
        setScheduleKind("cron");
        setCronExpr(editingJob.schedule);
        setFrequencyMode("custom");
      }

      // Session
      const st = editingJob.sessionTarget || "isolated";
      if (st === "main") setSessionTarget("main");
      else if (st === "isolated") setSessionTarget("isolated");
      else {
        setSessionTarget("custom");
        setCustomSession(st.replace("session:", ""));
      }

      // Payload
      if (editingJob.payloadKind === "systemEvent") setPayloadKind("systemEvent");
      else setPayloadKind("agentTurn");

      // Advanced
      const eTh = editingJob.thinking || "";
      const eLc = !!editingJob.lightContext;
      const eTl = editingJob.tools || "";
      const eTo = editingJob.timeoutSeconds || 300;
      if (editingJob.model) { setModel(editingJob.model); }
      setThinking(eTh);
      setLightContext(eLc);
      setTools(eTl);
      setTimeoutSeconds(eTo);
      const detected = detectPreset(eTh, eLc, eTl, eTo);
      setTaskPreset(detected);
      if (detected === "custom") setShowAdvanced(true);
      if (editingJob.deliveryChannel) { setDeliveryChannel(editingJob.deliveryChannel); }
      if (editingJob.deliveryTo) { setDeliveryTo(editingJob.deliveryTo); }
    } else {
      // Reset for create
      setName("");
      setDescription("");
      setScheduleKind("cron");
      setCronExpr("0 9 * * *");
      setFrequencyMode("daily");
      setEveryMinutes(15);
      setSelectedHour(9);
      setSelectedMinute(0);
      setSelectedDays([1]);
      setSelectedDayOfMonth(1);
      setEveryValue(10);
      setEveryUnit("m");
      setAtDate("");
      setAtTime("09:00");
      setTimezone("Europe/Madrid");
      setAgentId("");
      setSessionTarget("isolated");
      setCustomSession("");
      setPayloadKind("agentTurn");
      setMessage("");
      setShowAdvanced(false);
      setTaskPreset("script");
      setModel("");
      setThinking("off");
      setTimeoutSeconds(180);
      setLightContext(true);
      setTools("exec,read,write");
      setExact(false);
      setAnnounce(null);
      setDeliveryChannel("");
      setDeliveryTo("");
      setDeleteAfterRun(false);
    }
    setErrors({});
  }, [isOpen, editingJob]);

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  // Computed: next runs for preview
  const nextRuns = useMemo(() => {
    if (scheduleKind === "cron" && isValidCron(cronExpr)) {
      return getNextRuns(cronExpr, 5);
    }
    if (scheduleKind === "every") {
      const nowMs = Date.now();
      const intervalMs = everyValue * (everyUnit === "h" ? 3600000 : 60000);
      return Array.from({ length: 5 }, (_, i) => new Date(nowMs + intervalMs * (i + 1)));
    }
    if (scheduleKind === "at" && atDate && atTime) {
      const d = new Date(`${atDate}T${atTime}`);
      return d.getTime() > Date.now() ? [d] : [];
    }
    return [];
  }, [scheduleKind, cronExpr, everyValue, everyUnit, atDate, atTime]);

  // Computed: CLI command preview
  const cliPreview = useMemo(() => {
    const parts = ["openclaw cron add"];
    if (name) parts.push(`--name "${name}"`);
    if (scheduleKind === "cron") parts.push(`--cron "${cronExpr}"`);
    else if (scheduleKind === "every") parts.push(`--every ${formatEveryDuration(everyValue, everyUnit)}`);
    else if (scheduleKind === "at" && atDate && atTime) parts.push(`--at "${atDate}T${atTime}:00"`);
    if (timezone) parts.push(`--tz ${timezone}`);
    const resolvedSession = sessionTarget === "custom" ? `session:${customSession}` : sessionTarget;
    if (resolvedSession) parts.push(`--session ${resolvedSession}`);
    if (agentId) parts.push(`--agent ${agentId}`);
    if (payloadKind === "agentTurn" && message) parts.push(`--message "${message.substring(0, 60)}${message.length > 60 ? "..." : ""}"`);
    else if (payloadKind === "systemEvent" && message) parts.push(`--system-event "${message.substring(0, 60)}${message.length > 60 ? "..." : ""}"`);
    if (model) parts.push(`--model ${model}`);
    if (thinking) parts.push(`--thinking ${thinking}`);
    if (timeoutSeconds !== 30) parts.push(`--timeout-seconds ${timeoutSeconds}`);
    if (lightContext) parts.push("--light-context");
    if (tools) parts.push(`--tools ${tools}`);
    if (exact) parts.push("--exact");
    if (announce === true) parts.push("--announce");
    if (announce === false) parts.push("--no-deliver");
    if (deliveryChannel) parts.push(`--channel ${deliveryChannel}`);
    if (deliveryTo) parts.push(`--to "${deliveryTo}"`);
    if (deleteAfterRun) parts.push("--delete-after-run");
    return parts.join(" \\\n  ");
  }, [name, scheduleKind, cronExpr, everyValue, everyUnit, atDate, atTime, timezone, sessionTarget, customSession, agentId, payloadKind, message, model, thinking, timeoutSeconds, lightContext, tools, exact, announce, deliveryChannel, deliveryTo, deleteAfterRun]);

  // Human-readable schedule
  const scheduleHuman = useMemo(() => {
    if (scheduleKind === "cron" && isValidCron(cronExpr)) return cronToHuman(cronExpr);
    if (scheduleKind === "every") return `Every ${everyValue}${everyUnit === "h" ? " hours" : " minutes"}`;
    if (scheduleKind === "at" && atDate && atTime) return `Once at ${atDate} ${atTime}`;
    return "—";
  }, [scheduleKind, cronExpr, everyValue, everyUnit, atDate, atTime]);

  const sectionStatus = useMemo(() => {
    const nameOk = name.trim().length > 0;

    let scheduleOk = false;
    if (scheduleKind === "cron") scheduleOk = isValidCron(cronExpr);
    else if (scheduleKind === "every") scheduleOk = everyValue > 0;
    else if (scheduleKind === "at") scheduleOk = !!(atDate && atTime);

    const messageOk = message.trim().length > 0;
    const sessionOk = sessionTarget !== "custom" || customSession.trim().length > 0;

    // Check for incompatible combinations
    const payloadCompatible = sessionTarget === "main"
      ? payloadKind === "systemEvent"
      : sessionTarget === "isolated"
      ? payloadKind === "agentTurn"
      : true;

    const deliveryOk = announce !== true || (!!deliveryChannel && !!deliveryTo);

    return {
      basic: nameOk,
      schedule: scheduleOk,
      execution: messageOk && sessionOk && payloadCompatible,
      canSubmit: nameOk && scheduleOk && messageOk && sessionOk && payloadCompatible && deliveryOk,
    };
  }, [name, scheduleKind, cronExpr, everyValue, atDate, atTime, message, sessionTarget, customSession, payloadKind]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!name.trim()) newErrors.name = "El nombre es obligatorio";
    if (scheduleKind === "cron" && !isValidCron(cronExpr)) newErrors.schedule = "Expresión cron inválida";
    if (scheduleKind === "every" && everyValue <= 0) newErrors.schedule = "El intervalo debe ser mayor que 0";
    if (scheduleKind === "at" && (!atDate || !atTime)) newErrors.schedule = "Fecha y hora son obligatorios";
    if (!message.trim()) {
      if (sessionTarget === "main") {
        newErrors.message = "El texto del evento de sistema es obligatorio para sesiones Main";
      } else {
        newErrors.message = "El mensaje/prompt para el agente es obligatorio";
      }
    }
    if (sessionTarget === "custom" && !customSession.trim()) newErrors.session = "La clave de sesión personalizada es obligatoria";
    if (sessionTarget === "main" && payloadKind !== "systemEvent") {
      newErrors.payload = "Las sesiones Main solo admiten System Event. Cambia el tipo de payload.";
    }
    if (sessionTarget === "isolated" && payloadKind !== "agentTurn") {
      newErrors.payload = "Las sesiones Isolated solo admiten Agent Turn. Cambia el tipo de payload.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setIsSaving(true);

    const resolvedSession = sessionTarget === "custom" ? `session:${customSession}` : sessionTarget;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim(),
      scheduleKind,
      timezone,
      sessionTarget: resolvedSession,
      payloadKind,
      agentId: agentId || undefined,
    };

    // Schedule
    if (scheduleKind === "cron") payload.cronExpr = cronExpr;
    else if (scheduleKind === "every") payload.every = formatEveryDuration(everyValue, everyUnit);
    else if (scheduleKind === "at") payload.at = `${atDate}T${atTime}:00`;

    // Payload content
    if (payloadKind === "agentTurn") payload.message = message.trim();
    else payload.systemEvent = message.trim();

    // Advanced
    if (model) payload.model = model;
    if (thinking) payload.thinking = thinking;
    if (timeoutSeconds !== 30) payload.timeoutSeconds = timeoutSeconds;
    if (lightContext) payload.lightContext = true;
    if (tools) payload.tools = tools;
    if (exact) payload.exact = true;
    if (announce === true) payload.announce = true;
    if (announce === false) payload.announce = false;
    if (deliveryChannel) payload.deliveryChannel = deliveryChannel;
    if (deliveryTo) payload.deliveryTo = deliveryTo;
    if (agentId && announce === true) payload.deliveryAccount = agentId;
    if (deleteAfterRun) payload.deleteAfterRun = true;

    try {
      const isEdit = !!editingJob?.id;
      const url = "/api/cron";
      const method = isEdit ? "PATCH" : "POST";
      if (isEdit) payload.id = editingJob!.id;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      onSave(editingJob || ({} as CronJob));
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al guardar";
      // Extract the actual OpenClaw error if it's embedded
      const match = msg.match(/Error:\s*(.+?)(\n|$)/);
      const cleanMsg = match ? match[1] : msg;
      setErrors({ submit: `❌ ${cleanMsg}` });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl shadow-2xl mx-4"
        style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
      >
        {/* Header */}
        <div
          className="sticky top-0 z-10 px-6 py-4 flex items-center justify-between"
          style={{ backgroundColor: "var(--card)", borderBottom: "1px solid var(--border)" }}
        >
          <h2 className="text-xl font-semibold" style={{ color: "var(--text-primary)" }}>
            {editingJob ? "✏️ Edit Cron Job" : "➕ Create Cron Job"}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", background: "none", border: "none", cursor: "pointer" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* ===== Section 1: Basic Info ===== */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: sectionStatus.basic ? "#22c55e" : "#ef4444",
                transition: "background-color 0.3s",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: "0.9rem" }}>📝</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>Basic Info</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div>
                <label style={labelStyle}>Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); if (errors.name) setErrors(p => ({ ...p, name: "" })); }}
                  placeholder="e.g., Daily Backup Report"
                  style={{ ...inputStyle, borderColor: errors.name ? "var(--error)" : "var(--border)" }}
                />
                {errors.name && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errors.name}</p>}
              </div>
              <div>
                <label style={labelStyle}>Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Optional: what does this job do?"
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* ===== Section 2: Schedule ===== */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: sectionStatus.schedule ? "#22c55e" : "#ef4444",
                transition: "background-color 0.3s",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: "0.9rem" }}>⏰</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>Schedule</span>
            </div>

            {/* Schedule kind tabs */}
            <div style={{ display: "flex", gap: "0.375rem", marginBottom: "1rem" }}>
              {(["cron", "every", "at"] as const).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setScheduleKind(kind)}
                  style={{
                    flex: 1,
                    padding: "0.5rem",
                    borderRadius: "0.5rem",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    border: "1px solid",
                    cursor: "pointer",
                    backgroundColor: scheduleKind === kind ? "rgba(255,59,48,0.15)" : "var(--card)",
                    color: scheduleKind === kind ? "var(--accent)" : "var(--text-secondary)",
                    borderColor: scheduleKind === kind ? "rgba(255,59,48,0.4)" : "var(--border)",
                    transition: "all 0.15s",
                  }}
                >
                  {kind === "cron" ? "🔄 Recurring" : kind === "every" ? "⏱️ Interval" : "📌 One-shot"}
                </button>
              ))}
            </div>

            {/* Cron builder */}
            {scheduleKind === "cron" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {/* Frequency mode pills */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                  {FREQUENCY_MODES.map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => setFrequencyMode(mode.id)}
                      style={{
                        padding: "0.3rem 0.625rem",
                        borderRadius: "9999px",
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        backgroundColor: frequencyMode === mode.id ? "rgba(255,59,48,0.12)" : "var(--card)",
                        color: frequencyMode === mode.id ? "var(--accent)" : "var(--text-muted)",
                        borderColor: frequencyMode === mode.id ? "rgba(255,59,48,0.3)" : "var(--border)",
                      }}
                    >
                      {mode.emoji} {mode.label}
                    </button>
                  ))}
                </div>

                {/* Visual controls */}
                {frequencyMode === "every-minutes" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <label style={{ ...labelStyle, marginBottom: 0, whiteSpace: "nowrap" }}>Every</label>
                    <input
                      type="range" min={1} max={60} value={everyMinutes}
                      onChange={(e) => setEveryMinutes(Number(e.target.value))}
                      style={{ flex: 1, accentColor: "var(--accent)" }}
                    />
                    <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: "4rem", textAlign: "center", fontSize: "0.85rem" }}>
                      {everyMinutes} min
                    </span>
                  </div>
                )}

                {frequencyMode === "hourly" && (
                  <div>
                    <label style={labelStyle}>At minute</label>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {MINUTES_OPTIONS.map((m) => (
                        <button key={m} type="button" onClick={() => setSelectedMinute(m)}
                          style={{
                            padding: "0.3rem 0.625rem", borderRadius: "0.375rem", fontSize: "0.8rem",
                            backgroundColor: selectedMinute === m ? "var(--accent)" : "var(--card)",
                            color: selectedMinute === m ? "#000" : "var(--text-secondary)",
                            border: "1px solid var(--border)", cursor: "pointer",
                          }}>
                          :{String(m).padStart(2, "0")}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {(frequencyMode === "daily" || frequencyMode === "weekly" || frequencyMode === "monthly") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <div>
                      <label style={labelStyle}>At time</label>
                      <div style={{ display: "flex", gap: "0.375rem", alignItems: "center" }}>
                        <select value={selectedHour} onChange={(e) => setSelectedHour(Number(e.target.value))}
                          style={{ ...selectStyle, width: "auto" }}>
                          {HOURS.map((h) => <option key={h} value={h}>{String(h).padStart(2, "0")}</option>)}
                        </select>
                        <span style={{ color: "var(--text-muted)", fontWeight: 700 }}>:</span>
                        <select value={selectedMinute} onChange={(e) => setSelectedMinute(Number(e.target.value))}
                          style={{ ...selectStyle, width: "auto" }}>
                          {MINUTES_OPTIONS.map((m) => <option key={m} value={m}>{String(m).padStart(2, "0")}</option>)}
                        </select>
                      </div>
                    </div>
                    {frequencyMode === "weekly" && (
                      <div>
                        <label style={labelStyle}>On days</label>
                        <div style={{ display: "flex", gap: "0.25rem" }}>
                          {WEEKDAYS.map((day, i) => (
                            <button key={day} type="button" onClick={() => toggleDay(i)}
                              style={{
                                flex: 1, padding: "0.4rem 0", borderRadius: "0.375rem", fontSize: "0.7rem",
                                fontWeight: selectedDays.includes(i) ? 700 : 400,
                                backgroundColor: selectedDays.includes(i) ? "var(--accent)" : "var(--card)",
                                color: selectedDays.includes(i) ? "#000" : "var(--text-secondary)",
                                border: "1px solid var(--border)", cursor: "pointer",
                              }}>
                              {day}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {frequencyMode === "monthly" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        <label style={{ ...labelStyle, marginBottom: 0 }}>Day</label>
                        <input type="range" min={1} max={28} value={selectedDayOfMonth}
                          onChange={(e) => setSelectedDayOfMonth(Number(e.target.value))}
                          style={{ flex: 1, accentColor: "var(--accent)" }}
                        />
                        <span style={{ fontWeight: 700, color: "var(--accent)", minWidth: "3rem", textAlign: "center", fontSize: "0.85rem" }}>
                          Day {selectedDayOfMonth}
                        </span>
                      </div>
                    )}
                  </div>
                )}

                {frequencyMode === "custom" && (
                  <div style={{ position: "relative" }}>
                    <input
                      type="text" value={cronExpr}
                      onChange={(e) => { setCronExpr(e.target.value); if (errors.schedule) setErrors(p => ({ ...p, schedule: "" })); }}
                      placeholder="* * * * *"
                      style={{ ...inputStyle, fontFamily: "monospace", paddingRight: "5.5rem", borderColor: errors.schedule ? "var(--error)" : "var(--border)" }}
                    />
                    <button type="button" onClick={() => setShowPresets(!showPresets)}
                      style={{
                        position: "absolute", right: "0.5rem", top: "50%", transform: "translateY(-50%)",
                        padding: "0.25rem 0.5rem", fontSize: "0.7rem",
                        backgroundColor: "var(--card)", color: "var(--text-secondary)",
                        border: "1px solid var(--border)", borderRadius: "0.25rem", cursor: "pointer",
                        display: "flex", alignItems: "center", gap: "0.25rem",
                      }}>
                      Presets <ChevronDown className={`w-3 h-3 transition-transform ${showPresets ? "rotate-180" : ""}`} />
                    </button>
                    {showPresets && (
                      <div style={{
                        position: "absolute", top: "100%", left: 0, right: 0, marginTop: "0.25rem",
                        backgroundColor: "var(--card)", border: "1px solid var(--border)",
                        borderRadius: "0.5rem", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
                        zIndex: 20, maxHeight: "14rem", overflowY: "auto",
                      }}>
                        {CRON_PRESETS.map((preset) => (
                          <button key={preset.value} type="button"
                            onClick={() => { setCronExpr(preset.value); setShowPresets(false); }}
                            style={{
                              width: "100%", padding: "0.5rem 0.75rem",
                              display: "flex", alignItems: "center", justifyContent: "space-between",
                              background: "none", border: "none", cursor: "pointer", textAlign: "left",
                              borderBottom: "1px solid var(--border)", fontSize: "0.8rem",
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--card-elevated)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; }}
                          >
                            <span style={{ color: "var(--text-primary)" }}>{preset.label}</span>
                            <code style={{ color: "var(--text-muted)", fontSize: "0.7rem" }}>{preset.value}</code>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cron display */}
                <div style={{
                  padding: "0.5rem 0.75rem",
                  backgroundColor: "var(--card)",
                  borderRadius: "0.375rem",
                  display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap",
                }}>
                  <code style={{ fontFamily: "monospace", fontSize: "0.9rem", color: "var(--accent)", fontWeight: 700 }}>
                    {cronExpr}
                  </code>
                  {isValidCron(cronExpr) && (
                    <span style={{ color: "var(--text-secondary)", fontSize: "0.8rem" }}>→ {cronToHuman(cronExpr)}</span>
                  )}
                </div>
              </div>
            )}

            {/* Every (interval) */}
            {scheduleKind === "every" && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Every</label>
                <input
                  type="number" min={1} max={1440} value={everyValue}
                  onChange={(e) => setEveryValue(Number(e.target.value))}
                  style={{ ...inputStyle, width: "5rem", textAlign: "center" }}
                />
                <select value={everyUnit} onChange={(e) => setEveryUnit(e.target.value)}
                  style={{ ...selectStyle, width: "auto" }}>
                  <option value="m">minutes</option>
                  <option value="h">hours</option>
                </select>
              </div>
            )}

            {/* One-shot (at) */}
            {scheduleKind === "at" && (
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: "140px" }}>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={atDate} onChange={(e) => setAtDate(e.target.value)}
                    style={{ ...inputStyle, borderColor: errors.schedule ? "var(--error)" : "var(--border)" }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: "100px" }}>
                  <label style={labelStyle}>Time</label>
                  <input type="time" value={atTime} onChange={(e) => setAtTime(e.target.value)}
                    style={inputStyle}
                  />
                </div>
              </div>
            )}

            {errors.schedule && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errors.schedule}</p>}

            {/* Timezone */}
            <div style={{ marginTop: "0.75rem" }}>
              <label style={labelStyle}>Timezone</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} style={selectStyle}>
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
          </div>

          {/* ===== Section 3: Execution ===== */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{
                width: "8px", height: "8px", borderRadius: "50%",
                backgroundColor: sectionStatus.execution ? "#22c55e" : "#ef4444",
                transition: "background-color 0.3s",
                flexShrink: 0,
              }} />
              <span style={{ fontSize: "0.9rem" }}>⚡</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>Execution</span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {/* Agent */}
              <div>
                <label style={labelStyle}>Agente <InfoTip text="Qu\u00e9 bot ejecuta esta tarea. Cada agente tiene su propio modelo y configuraci\u00f3n." /></label>
                <select value={agentId} onChange={(e) => setAgentId(e.target.value)} style={selectStyle}>
                  {AGENTS.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.emoji} {a.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Task Preset */}
              <div>
                <label style={labelStyle}>Tipo de tarea <InfoTip text="Determina cu\u00e1ntos recursos usa el agente. 'Script directo' es r\u00e1pido y barato. 'Tarea de agente' da m\u00e1s libertad pero tarda m\u00e1s." /></label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.375rem" }}>
                  {TASK_PRESETS.map((tp) => (
                    <button key={tp.id} type="button" onClick={() => setTaskPreset(tp.id)}
                      style={{
                        padding: "0.5rem 0.625rem", borderRadius: "0.5rem", textAlign: "left",
                        border: "1px solid", cursor: "pointer", transition: "all 0.15s",
                        backgroundColor: taskPreset === tp.id ? "rgba(34,197,94,0.12)" : "var(--card)",
                        borderColor: taskPreset === tp.id ? "rgba(34,197,94,0.4)" : "var(--border)",
                      }}>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: taskPreset === tp.id ? "#22c55e" : "var(--text-primary)" }}>
                        {tp.emoji} {tp.label}
                      </div>
                      <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "2px" }}>{tp.desc}</div>
                    </button>
                  ))}
                </div>
                {taskPreset !== "custom" && (
                  <div style={{ marginTop: "0.375rem", padding: "0.3rem 0.625rem", borderRadius: "0.375rem", backgroundColor: "rgba(34,197,94,0.08)", fontSize: "0.7rem", color: "#22c55e" }}>
                    \u2705 {taskPreset === "script" ? "Thinking off \u00b7 Contexto ligero \u00b7 Tools: exec,read,write \u00b7 Timeout: 180s"
                      : taskPreset === "agent" ? "Thinking default \u00b7 Contexto completo \u00b7 Todos los tools \u00b7 Timeout: 600s"
                      : "Thinking off \u00b7 Contexto ligero \u00b7 Sin tools \u00b7 Timeout: 120s"}
                  </div>
                )}
              </div>

              {/* Session target */}
              <div>
                <label style={labelStyle}>Sesi\u00f3n <InfoTip text="Isolated = cada ejecuci\u00f3n empieza limpia (recomendado para crons). Main = contin\u00faa la conversaci\u00f3n existente." /></label>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  {(["main", "isolated", "custom"] as const).map((st) => (
                    <button key={st} type="button" onClick={() => setSessionTarget(st)}
                      style={{
                        flex: st === "custom" ? 1.5 : 1,
                        padding: "0.4rem",
                        borderRadius: "0.375rem",
                        fontSize: "0.8rem",
                        fontWeight: 500,
                        border: "1px solid",
                        cursor: "pointer",
                        backgroundColor: sessionTarget === st ? "rgba(255,59,48,0.12)" : "var(--card)",
                        color: sessionTarget === st ? "var(--accent)" : "var(--text-secondary)",
                        borderColor: sessionTarget === st ? "rgba(255,59,48,0.3)" : "var(--border)",
                      }}>
                      {st === "main" ? "🏠 Main" : st === "isolated" ? "🔒 Isolated" : "🔑 Custom"}
                    </button>
                  ))}
                </div>
                {sessionTarget === "custom" && (
                  <input type="text" value={customSession}
                    onChange={(e) => { setCustomSession(e.target.value); if (errors.session) setErrors(p => ({ ...p, session: "" })); }}
                    placeholder="session key (e.g., my-pipeline)"
                    style={{ ...inputStyle, marginTop: "0.375rem", borderColor: errors.session ? "var(--error)" : "var(--border)" }}
                  />
                )}
                {errors.session && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errors.session}</p>}
              </div>

              {/* Payload type */}
              <div>
                <label style={labelStyle}>Tipo de payload <InfoTip text="Agent Turn = el agente recibe un mensaje y responde. System Event = inyecta un evento en la sesi\u00f3n sin respuesta directa." /></label>
                <div style={{ display: "flex", gap: "0.375rem" }}>
                  {(["agentTurn", "systemEvent"] as const).map((pk) => {
                    const isForced = (sessionTarget === "main" && pk === "agentTurn") ||
                                     (sessionTarget === "isolated" && pk === "systemEvent");
                    return (
                      <button key={pk} type="button"
                        onClick={() => !isForced && setPayloadKind(pk)}
                        disabled={isForced}
                        style={{
                          flex: 1, padding: "0.4rem", borderRadius: "0.375rem", fontSize: "0.8rem", fontWeight: 500,
                          border: "1px solid",
                          cursor: isForced ? "not-allowed" : "pointer",
                          opacity: isForced ? 0.4 : 1,
                          backgroundColor: payloadKind === pk ? "rgba(255,59,48,0.12)" : "var(--card)",
                          color: payloadKind === pk ? "var(--accent)" : "var(--text-secondary)",
                          borderColor: payloadKind === pk ? "rgba(255,59,48,0.3)" : "var(--border)",
                        }}>
                        {pk === "agentTurn" ? "💬 Agent Turn" : "⚙️ System Event"}
                      </button>
                    );
                  })}
                </div>
                {sessionTarget === "main" && payloadKind !== "systemEvent" && (
                  <div style={{
                    marginTop: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "0.375rem",
                    color: "#ef4444",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}>
                    ⚠️ Las sesiones "Main" requieren un evento de sistema (System Event), no un mensaje de agente.
                  </div>
                )}
                {sessionTarget === "isolated" && payloadKind !== "agentTurn" && (
                  <div style={{
                    marginTop: "0.375rem",
                    padding: "0.5rem 0.75rem",
                    backgroundColor: "rgba(239, 68, 68, 0.1)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    borderRadius: "0.375rem",
                    color: "#ef4444",
                    fontSize: "0.8rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}>
                    ⚠️ Las sesiones aisladas requieren un mensaje de agente (Agent Turn), no un evento de sistema.
                  </div>
                )}
                {errors.payload && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errors.payload}</p>}
              </div>

              {/* Skill Selector */}
              {payloadKind === "agentTurn" && (
                <SkillSelector
                  onSelect={(skillName) => {
                    setMessage(`Ejecuta la skill ${skillName}`);
                    if (errors.message) setErrors(p => ({ ...p, message: "" }));
                  }}
                />
              )}

              {/* Message */}
              <div>
                <label style={labelStyle}>
                  {payloadKind === "agentTurn" ? "Mensaje / Prompt *" : "Texto del evento *"}
                  <InfoTip text="El texto que recibe el agente. Para scripts: 'Ejecuta: python3 /ruta/script.py'. Para tareas: describe qu\u00e9 debe hacer." />
                </label>
                <textarea value={message}
                  onChange={(e) => { setMessage(e.target.value); if (errors.message) setErrors(p => ({ ...p, message: "" })); }}
                  placeholder={payloadKind === "agentTurn" ? "What should the agent do?" : "System event text..."}
                  rows={3}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "monospace",
                    fontSize: "0.8rem",
                    borderColor: errors.message ? "var(--error)" : "var(--border)",
                  }}
                />
                {errors.message && <p style={{ color: "var(--error)", fontSize: "0.75rem", marginTop: "0.25rem" }}>{errors.message}</p>}
              </div>
            </div>
          </div>

          {/* ===== Section 4: Advanced ===== */}
          <div style={{ ...sectionStyle, padding: showAdvanced ? "1rem" : "0.625rem 1rem" }}>
            <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem", width: "100%",
                background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)",
                fontSize: "0.85rem", fontWeight: 700,
              }}>
              <Settings2 className="w-4 h-4" />
              Opciones avanzadas
              {showAdvanced ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
            </button>

            {showAdvanced && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {/* Model */}
                  <div style={{ flex: 1, minWidth: "140px" }}>
                    <label style={labelStyle}>Modelo <InfoTip text="Fuerza un modelo espec\u00edfico. Vac\u00edo = usa el modelo por defecto del agente." /></label>
                    <select value={model} onChange={(e) => setModel(e.target.value)} style={selectStyle}>
                      {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  {/* Thinking */}
                  <div style={{ flex: 1, minWidth: "140px" }}>
                    <label style={labelStyle}>Thinking <InfoTip text="Nivel de razonamiento. Off para scripts simples. High para tareas complejas que requieren planificaci\u00f3n." /></label>
                    <select value={thinking} onChange={(e) => setThinking(e.target.value)} style={selectStyle}>
                      {THINKING_LEVELS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {/* Timeout */}
                  <div style={{ flex: 1, minWidth: "100px" }}>
                    <label style={labelStyle}>Timeout (s) <InfoTip text="Tiempo m\u00e1ximo. Scripts: 120-180s. Tareas complejas: 300-600s. Backups: 300s." /></label>
                    <input type="number" min={5} max={3600} value={timeoutSeconds}
                      onChange={(e) => setTimeoutSeconds(Number(e.target.value))}
                      style={{ ...inputStyle, textAlign: "center" }}
                    />
                  </div>
                  {/* Tools */}
                  <div style={{ flex: 2, minWidth: "160px" }}>
                    <label style={labelStyle}>Tools <InfoTip text="Herramientas disponibles. 'exec,read,write' para scripts. Vac\u00edo = todas las herramientas. 'none' = solo texto." /></label>
                    <input type="text" value={tools} onChange={(e) => setTools(e.target.value)}
                      placeholder="exec,read,write"
                      style={{ ...inputStyle, fontFamily: "monospace", fontSize: "0.8rem" }}
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={lightContext} onChange={(e) => setLightContext(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }} />
                    Contexto ligero <InfoTip text="Reduce la informaci\u00f3n del agente. Activar para scripts que no necesitan contexto completo." />
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                    <input type="checkbox" checked={exact} onChange={(e) => setExact(e.target.checked)}
                      style={{ accentColor: "var(--accent)" }} />
                    Exact Timing
                  </label>
                  {scheduleKind === "at" && (
                    <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                      <input type="checkbox" checked={deleteAfterRun} onChange={(e) => setDeleteAfterRun(e.target.checked)}
                        style={{ accentColor: "var(--accent)" }} />
                      Delete After Run
                    </label>
                  )}
                </div>

                {/* Delivery - simplified */}
                <div style={{ borderTop: "1px solid var(--border)", paddingTop: "0.75rem" }}>
                  <label style={labelStyle}>Entrega de resultados <InfoTip text="Si está activo, el resultado se envía por Telegram al chat de Rubén via el bot del agente seleccionado." /></label>
                  <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", cursor: "pointer", fontSize: "0.85rem", color: "var(--text-secondary)", padding: "0.4rem 0" }}>
                    <input type="checkbox" checked={announce === true}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAnnounce(true);
                          setDeliveryChannel("telegram");
                          setDeliveryTo("257725883");
                        } else {
                          setAnnounce(false);
                          setDeliveryChannel("");
                          setDeliveryTo("");
                        }
                      }}
                      style={{ accentColor: "var(--accent)", width: "1rem", height: "1rem" }} />
                    📢 Enviar resultado por Telegram
                    {announce === true && agentId && (
                      <span style={{ fontSize: "0.72rem", color: "#22c55e", marginLeft: "0.25rem" }}>
                        vía bot {agentId}
                      </span>
                    )}
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* ===== Section 5: Preview ===== */}
          <div style={sectionStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.9rem" }}>👁️</span>
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--text-primary)" }}>Preview</span>
            </div>

            {/* Schedule description */}
            <div style={{
              padding: "0.5rem 0.75rem", borderRadius: "0.375rem",
              backgroundColor: "var(--card)", marginBottom: "0.75rem",
              display: "flex", alignItems: "center", gap: "0.5rem",
            }}>
              <Calendar className="w-4 h-4" style={{ color: "var(--accent)", flexShrink: 0 }} />
              <span style={{ color: "var(--text-primary)", fontSize: "0.85rem", fontWeight: 600 }}>{scheduleHuman}</span>
            </div>

            {/* Next executions */}
            {nextRuns.length > 0 && (
              <div style={{ marginBottom: "0.75rem" }}>
                <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                  Next {nextRuns.length} execution{nextRuns.length > 1 ? "s" : ""}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  {nextRuns.map((run, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem" }}>
                      <span style={{
                        width: "1.25rem", height: "1.25rem", borderRadius: "9999px",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        backgroundColor: "rgba(192,132,252,0.15)", color: "#C084FC",
                        fontSize: "0.65rem", fontWeight: 700, flexShrink: 0,
                      }}>{i + 1}</span>
                      <span style={{ color: "var(--text-secondary)" }}>
                        {run.toLocaleString("es-ES", {
                          weekday: "short", month: "short", day: "numeric",
                          hour: "numeric", minute: "2-digit", hour12: false,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* CLI command */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.375rem" }}>
                <Terminal className="w-3.5 h-3.5" /> CLI equivalent
              </div>
              <pre style={{
                padding: "0.5rem 0.75rem",
                backgroundColor: "var(--card)",
                borderRadius: "0.375rem",
                fontSize: "0.7rem",
                color: "var(--text-muted)",
                fontFamily: "monospace",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                margin: 0,
              }}>
                {cliPreview}
              </pre>
            </div>
          </div>

          {/* Submit error */}
          {errors.submit && (
            <div style={{
              padding: "0.75rem",
              backgroundColor: "color-mix(in srgb, var(--error) 10%, transparent)",
              border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)",
              borderRadius: "0.5rem",
              color: "var(--error)", fontSize: "0.85rem",
            }}>
              {errors.submit}
            </div>
          )}

          {/* ===== Actions ===== */}
          <div className="flex items-center gap-3 pt-2" style={{ borderTop: "1px solid var(--border)" }}>
            {editingJob && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(editingJob.id); onClose(); }}
                style={{
                  display: "flex", alignItems: "center", gap: "0.375rem",
                  padding: "0.5rem 1rem", borderRadius: "0.5rem",
                  background: "color-mix(in srgb, var(--error) 12%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--error) 30%, transparent)",
                  color: "var(--error)", cursor: "pointer", fontSize: "0.85rem", fontWeight: 600,
                  transition: "all 0.2s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--error) 22%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--error) 12%, transparent)"; }}
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" onClick={onClose}
              style={{ padding: "0.5rem 1.25rem", borderRadius: "0.5rem", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving || !sectionStatus.canSubmit}
              style={{
                padding: "0.5rem 1.5rem",
                backgroundColor: sectionStatus.canSubmit ? "#22c55e" : "#ef4444",
                color: sectionStatus.canSubmit ? "#000" : "rgba(255,255,255,0.6)",
                borderRadius: "0.5rem", border: "none",
                cursor: (isSaving || !sectionStatus.canSubmit) ? "not-allowed" : "pointer",
                fontWeight: 700, fontSize: "0.85rem",
                opacity: (isSaving || !sectionStatus.canSubmit) ? 0.7 : 1,
                display: "flex", alignItems: "center", gap: "0.5rem",
                transition: "all 0.3s",
              }}>
              {isSaving ? (
                <><div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" /> Saving...</>
              ) : (
                <>{editingJob ? "Update Job" : "Create Job"}</>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
