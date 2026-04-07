"use client";

import { useMemo, useState } from "react";
import { format, addDays, startOfDay, isSameDay } from "date-fns";
import { Clock, Repeat, CalendarX } from "lucide-react";
import { getNextRuns, isValidCron } from "@/lib/cron-parser";
import type { CronJob } from "./CronJobCard";

interface ScheduledEvent {
  job: CronJob;
  time: Date;
  color: string;
  isInterval: boolean;
}

interface DayColumn {
  date: Date;
  label: string;
  subLabel: string;
  isToday: boolean;
  events: ScheduledEvent[];
  intervalJobs: { job: CronJob; color: string; intervalLabel: string }[];
}

// Consistent colors per agent
const AGENT_COLORS: Record<string, string> = {
  ruben: "#a78bfa",
  bill: "#FF6B6B",
  elon: "#4ade80",
  quin: "#facc15",
  trump: "#fb923c",
  warren: "#4FC3F7",
  system: "#9ca3af",
};

function getAgentColor(agentId: string): string {
  return AGENT_COLORS[agentId?.toLowerCase()] || "#CE93D8";
}

const CATEGORY_COLORS: Record<string, string> = {
  backup: "#4ade80",
  monitoring: "#60a5fa",
  maintenance: "#facc15",
  reporting: "#a78bfa",
  content: "#fb923c",
  general: "#9ca3af",
};

function getCategoryColor(category: string | undefined): string {
  return CATEGORY_COLORS[category?.toLowerCase() || ""] || "#6b7280";
}

function getScheduleExpr(schedule: string | Record<string, unknown>): string | null {
  if (typeof schedule === "string") return schedule;
  if (schedule && typeof schedule === "object" && schedule.kind === "cron") {
    return (schedule.expr as string) || null;
  }
  return null;
}

function getIntervalMs(schedule: string | Record<string, unknown>): number | null {
  if (typeof schedule === "object" && schedule && schedule.kind === "every") {
    return (schedule.everyMs as number) || null;
  }
  return null;
}

function getAtTime(schedule: string | Record<string, unknown>): Date | null {
  if (typeof schedule === "object" && schedule && schedule.kind === "at") {
    const at = schedule.at as string;
    if (at) return new Date(at);
  }
  return null;
}

function formatIntervalLabel(ms: number): string {
  if (ms >= 86400000) return `Every ${Math.round(ms / 86400000)}d`;
  if (ms >= 3600000) return `Every ${Math.round(ms / 3600000)}h`;
  if (ms >= 60000) return `Every ${Math.round(ms / 60000)}m`;
  return `Every ${Math.round(ms / 1000)}s`;
}

function getJobEmoji(agentId: string): string {
  const emojis: Record<string, string> = {
    main: "",
    academic: "AC",
    infra: "IF",
    studio: "ST",
    social: "SO",
    linkedin: "LI",
    freelance: "FL",
  };
  return emojis[agentId] || agentId?.substring(0, 2).toUpperCase() || "--";
}

interface CronWeeklyTimelineProps {
  jobs: CronJob[];
}

export function CronWeeklyTimeline({ jobs }: CronWeeklyTimelineProps) {
  const now = useMemo(() => new Date(), []);
  const sevenDaysOut = useMemo(
    () => new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
    [now]
  );

  // Filter state
  const [activeAgent, setActiveAgent] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  // Extract unique agents from enabled jobs
  const agents = useMemo(() => {
    const agentSet = new Map<string, number>();
    jobs.filter((j) => j.enabled).forEach((j) => {
      const id = j.agentId || "system";
      agentSet.set(id, (agentSet.get(id) || 0) + 1);
    });
    return Array.from(agentSet.entries()).map(([id, count]) => ({ id, count, color: getAgentColor(id) }));
  }, [jobs]);

  // Extract unique categories from enabled jobs
  const categories = useMemo(() => {
    const catSet = new Map<string, number>();
    jobs.filter((j) => j.enabled && j.category).forEach((j) => {
      catSet.set(j.category!, (catSet.get(j.category!) || 0) + 1);
    });
    return Array.from(catSet.entries()).map(([name, count]) => ({ name, count }));
  }, [jobs]);

  const days = useMemo<DayColumn[]>(() => {
    const enabledJobs = jobs.filter((j) => j.enabled)
      .filter((j) => !activeAgent || (j.agentId || "system") === activeAgent)
      .filter((j) => !activeCategory || j.category === activeCategory);

    // Compute all events for next 7 days
    const allEvents: ScheduledEvent[] = [];
    const intervalJobMap = new Map<
      string,
      { job: CronJob; color: string; intervalLabel: string }
    >();

    enabledJobs.forEach((job) => {
      const color = getAgentColor(job.agentId);
      const expr = getScheduleExpr(job.schedule);
      const intervalMs = getIntervalMs(job.schedule);
      const atTime = getAtTime(job.schedule);

      if (expr && isValidCron(expr)) {
        // Cron: compute next N runs
        const runs = getNextRuns(expr, 50, now);
        runs
          .filter((r) => r >= startOfDay(now) && r <= sevenDaysOut)
          .forEach((time) => {
            allEvents.push({ job, time, color, isInterval: false });
          });
      } else if (intervalMs) {
        // Interval job: show in each day but don't enumerate every tick
        // Just mark the days it's "active"
        const label = formatIntervalLabel(intervalMs);
        if (!intervalJobMap.has(job.id)) {
          intervalJobMap.set(job.id, { job, color, intervalLabel: label });
        }
        // If interval >= 24h, show individual occurrences
        if (intervalMs >= 86400000) {
          let next = job.nextRun ? new Date(job.nextRun) : now;
          while (next <= sevenDaysOut) {
            if (next >= startOfDay(now)) {
              allEvents.push({ job, time: new Date(next), color, isInterval: true });
            }
            next = new Date(next.getTime() + intervalMs);
          }
        }
      } else if (atTime && atTime > now && atTime <= sevenDaysOut) {
        // One-time job
        allEvents.push({ job, time: atTime, color, isInterval: false });
      }
    });

    // Build day columns
    const columns: DayColumn[] = [];
    for (let i = 0; i < 7; i++) {
      const date = addDays(startOfDay(now), i);
      const dayEnd = addDays(date, 1);
      const isToday = isSameDay(date, now);

      const dayEvents = allEvents
        .filter((e) => e.time >= date && e.time < dayEnd)
        .sort((a, b) => a.time.getTime() - b.time.getTime());

      // For interval jobs that fire multiple times per day, include in intervalJobs
      const dayIntervalJobs = Array.from(intervalJobMap.values());

      columns.push({
        date,
        label: isToday ? "Today" : format(date, "EEE d"),
        subLabel: isToday ? format(date, "EEE d") : format(date, "MMM"),
        isToday,
        events: dayEvents,
        intervalJobs: dayIntervalJobs,
      });
    }

    return columns;
  }, [jobs, now, sevenDaysOut, activeAgent, activeCategory]);

  const totalEvents = useMemo(
    () => days.reduce((sum, d) => sum + d.events.length, 0),
    [days]
  );

  if (jobs.filter((j) => j.enabled).length === 0) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "4rem 0",
          color: "var(--text-muted)",
          gap: "1rem",
        }}
      >
        <CalendarX style={{ width: 48, height: 48, opacity: 0.4 }} />
        <p style={{ fontSize: "0.9rem" }}>No active jobs to display</p>
      </div>
    );
  }

  return (
    <div>
      {/* Agent Filter Bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4rem",
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        {/* "All" pill */}
        <button
          onClick={() => setActiveAgent(null)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.3rem 0.75rem",
            borderRadius: "0.375rem",
            fontSize: "0.75rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            border: "1px solid",
            cursor: "pointer",
            transition: "all 0.15s",
            backgroundColor: !activeAgent ? "rgba(255,255,255,0.12)" : "transparent",
            color: !activeAgent ? "var(--text-primary)" : "var(--text-muted)",
            borderColor: !activeAgent ? "rgba(255,255,255,0.25)" : "var(--border)",
          }}
        >
          All
          <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>
            ({jobs.filter((j) => j.enabled).length})
          </span>
        </button>

        {agents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => setActiveAgent(activeAgent === agent.id ? null : agent.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.3rem 0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.75rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              border: "1px solid",
              cursor: "pointer",
              transition: "all 0.15s",
              backgroundColor: activeAgent === agent.id
                ? `color-mix(in srgb, ${agent.color} 20%, transparent)`
                : "transparent",
              color: activeAgent === agent.id ? agent.color : "var(--text-muted)",
              borderColor: activeAgent === agent.id
                ? `color-mix(in srgb, ${agent.color} 40%, transparent)`
                : "var(--border)",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "2px",
                backgroundColor: agent.color,
                flexShrink: 0,
              }}
            />
            {agent.id}
            <span style={{ fontSize: "0.65rem", opacity: 0.7 }}>({agent.count})</span>
          </button>
        ))}

        {/* Separator */}
        {categories.length > 0 && (
          <div style={{ width: "1px", height: "1.25rem", backgroundColor: "var(--border)", alignSelf: "center" }} />
        )}

        {/* Category filters */}
        {categories.length > 0 && (
          <button
            onClick={() => setActiveCategory(null)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.3rem 0.65rem",
              borderRadius: "0.375rem",
              fontSize: "0.7rem",
              fontWeight: 600,
              border: "1px solid",
              cursor: "pointer",
              transition: "all 0.15s",
              backgroundColor: !activeCategory ? "rgba(255,255,255,0.08)" : "transparent",
              color: !activeCategory ? "var(--text-secondary)" : "var(--text-muted)",
              borderColor: !activeCategory ? "rgba(255,255,255,0.15)" : "var(--border)",
            }}
          >
            All cat.
          </button>
        )}
        {categories.map((cat) => {
          const cc = getCategoryColor(cat.name);
          return (
            <button
              key={cat.name}
              onClick={() => setActiveCategory(activeCategory === cat.name ? null : cat.name)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                padding: "0.3rem 0.65rem",
                borderRadius: "0.375rem",
                fontSize: "0.7rem",
                fontWeight: 600,
                border: "1px solid",
                cursor: "pointer",
                transition: "all 0.15s",
                backgroundColor: activeCategory === cat.name
                  ? `color-mix(in srgb, ${cc} 20%, transparent)`
                  : "transparent",
                color: activeCategory === cat.name ? cc : "var(--text-muted)",
                borderColor: activeCategory === cat.name
                  ? `color-mix(in srgb, ${cc} 40%, transparent)`
                  : "var(--border)",
              }}
            >
              <div style={{ width: 7, height: 7, borderRadius: "2px", backgroundColor: cc, flexShrink: 0 }} />
              {cat.name}
              <span style={{ fontSize: "0.6rem", opacity: 0.6 }}>({cat.count})</span>
            </button>
          );
        })}

        <div
          style={{
            marginLeft: "auto",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
            alignSelf: "center",
          }}
        >
          {totalEvents} events in 7 days
        </div>
      </div>

      {/* Calendar Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gap: "0.5rem",
          overflowX: "auto",
        }}
      >
        {days.map((day) => (
          <div
            key={day.date.toISOString()}
            style={{
              backgroundColor: day.isToday
                ? "color-mix(in srgb, var(--accent) 8%, var(--card))"
                : "var(--card)",
              border: day.isToday
                ? "1px solid color-mix(in srgb, var(--accent) 40%, transparent)"
                : "1px solid var(--border)",
              borderRadius: "0.75rem",
              overflow: "hidden",
              minWidth: "120px",
            }}
          >
            {/* Day Header */}
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderBottom: "1px solid var(--border)",
                backgroundColor: day.isToday
                  ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                  : "transparent",
              }}
            >
              <div
                style={{
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  color: day.isToday ? "var(--accent)" : "var(--text-primary)",
                  fontFamily: "var(--font-heading)",
                }}
              >
                {day.label}
              </div>
              <div
                style={{
                  fontSize: "0.65rem",
                  color: "var(--text-muted)",
                  marginTop: "1px",
                }}
              >
                {day.subLabel}
              </div>
            </div>

            {/* Events */}
            <div style={{ padding: "0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem", minHeight: "80px" }}>
              {day.events.length === 0 && day.intervalJobs.length === 0 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "80px",
                    color: "var(--text-muted)",
                    fontSize: "0.7rem",
                    opacity: 0.5,
                  }}
                >
                  —
                </div>
              )}

              {/* One-time / cron events */}
              {day.events.map((event, eIdx) => {
                const catColor = getCategoryColor(event.job.category);
                return (
                  <div
                    key={`${event.job.id}-${eIdx}`}
                    title={`${event.job.name}\n${format(event.time, "HH:mm")}\nAgent: ${event.job.agentId}${event.job.category ? ` | ${event.job.category}` : ""}`}
                    style={{
                      padding: "0.3rem 0.5rem",
                      borderRadius: "0.4rem",
                      backgroundColor: `${event.color}12`,
                      border: `1px solid ${event.color}30`,
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.65rem",
                        color: event.color,
                        fontWeight: 700,
                      }}
                    >
                      <Clock style={{ width: 9, height: 9, flexShrink: 0 }} />
                      {format(event.time, "HH:mm")}
                      {event.isInterval && (
                        <Repeat style={{ width: 9, height: 9, opacity: 0.7 }} />
                      )}
                      {/* Color squares: agent + category */}
                      <div style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "2px", backgroundColor: event.color }} title={event.job.agentId} />
                        {event.job.category && (
                          <div style={{ width: 7, height: 7, borderRadius: "2px", backgroundColor: catColor }} title={event.job.category} />
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100%",
                      }}
                    >
                      {event.job.name}
                    </div>
                  </div>
                );
              })}

              {/* Interval jobs (< 24h frequency) */}
              {day.intervalJobs.map(({ job, color, intervalLabel }) => {
                const catColor = getCategoryColor(job.category);
                return (
                  <div
                    key={`${job.id}-interval`}
                    title={`${job.name} — ${intervalLabel}\nAgent: ${job.agentId}${job.category ? ` | ${job.category}` : ""}`}
                    style={{
                      padding: "0.3rem 0.5rem",
                      borderRadius: "0.4rem",
                      backgroundColor: `${color}12`,
                      border: `1px solid ${color}25`,
                      borderStyle: "dashed",
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.3rem",
                        fontSize: "0.65rem",
                        color: color,
                        fontWeight: 700,
                      }}
                    >
                      <Repeat style={{ width: 9, height: 9, flexShrink: 0 }} />
                      {intervalLabel}
                      <div style={{ display: "flex", gap: "2px", marginLeft: "auto" }}>
                        <div style={{ width: 7, height: 7, borderRadius: "2px", backgroundColor: color }} title={job.agentId} />
                        {job.category && (
                          <div style={{ width: 7, height: 7, borderRadius: "2px", backgroundColor: catColor }} title={job.category} />
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--text-secondary)",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {job.name}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
