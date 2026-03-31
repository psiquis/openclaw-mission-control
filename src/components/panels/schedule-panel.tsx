'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { getCronOccurrences } from '@/lib/cron-occurrences'
import { describeCronFrequency, validateCronExpression } from '@/lib/cron-utils'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('SchedulePanel')

// ── Constants ─────────────────────────────────────────────────────────────────

const HOUR_START = 6   // 6 AM
const HOUR_END   = 23  // 11 PM (inclusive)
const VISIBLE_HOURS = HOUR_END - HOUR_START + 1  // 18
const ROW_H = 64       // px per hour row

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

const JOB_COLORS = [
  { bg: 'bg-blue-500/85',    border: 'border-blue-400/60',    dot: 'bg-blue-400',    text: 'text-blue-300',    solid: '#3b82f6' },
  { bg: 'bg-emerald-500/85', border: 'border-emerald-400/60', dot: 'bg-emerald-400', text: 'text-emerald-300', solid: '#10b981' },
  { bg: 'bg-amber-500/85',   border: 'border-amber-400/60',   dot: 'bg-amber-400',   text: 'text-amber-300',   solid: '#f59e0b' },
  { bg: 'bg-purple-500/85',  border: 'border-purple-400/60',  dot: 'bg-purple-400',  text: 'text-purple-300',  solid: '#a855f7' },
  { bg: 'bg-rose-500/85',    border: 'border-rose-400/60',    dot: 'bg-rose-400',    text: 'text-rose-300',    solid: '#f43f5e' },
  { bg: 'bg-cyan-500/85',    border: 'border-cyan-400/60',    dot: 'bg-cyan-400',    text: 'text-cyan-300',    solid: '#06b6d4' },
  { bg: 'bg-orange-500/85',  border: 'border-orange-400/60',  dot: 'bg-orange-400',  text: 'text-orange-300',  solid: '#f97316' },
  { bg: 'bg-indigo-500/85',  border: 'border-indigo-400/60',  dot: 'bg-indigo-400',  text: 'text-indigo-300',  solid: '#6366f1' },
  { bg: 'bg-pink-500/85',    border: 'border-pink-400/60',    dot: 'bg-pink-400',    text: 'text-pink-300',    solid: '#ec4899' },
  { bg: 'bg-teal-500/85',    border: 'border-teal-400/60',    dot: 'bg-teal-400',    text: 'text-teal-300',    solid: '#14b8a6' },
] as const

const TIMEZONES = [
  { label: 'Browser local', value: 'local' },
  { label: 'UTC',           value: 'UTC' },
  { label: 'US/Eastern',    value: 'America/New_York' },
  { label: 'US/Central',    value: 'America/Chicago' },
  { label: 'US/Pacific',    value: 'America/Los_Angeles' },
  { label: 'Europe/London', value: 'Europe/London' },
  { label: 'Europe/Berlin', value: 'Europe/Berlin' },
  { label: 'Asia/Tokyo',    value: 'Asia/Tokyo' },
  { label: 'Asia/Shanghai', value: 'Asia/Shanghai' },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronJob {
  id?: string
  name: string
  schedule: string
  command?: string
  enabled: boolean
  lastRun?: number
  lastStatus?: 'success' | 'error' | 'running'
  nextRun?: number
  timezone?: string
}

interface PlacedBlock {
  jobIdx: number
  job: CronJob
  atMs: number
  hour: number
  minute: number
  // column collision handling
  col: number
  totalCols: number
}

interface TooltipState {
  x: number
  y: number
  job: CronJob
  atMs: number
}

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfWeek(date: Date, weekOffset = 0): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay() + weekOffset * 7)
  return d
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtTime(ms: number): string {
  const d = new Date(ms)
  const h = d.getHours(), m = d.getMinutes()
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hh = h % 12 || 12
  return `${hh}:${String(m).padStart(2, '0')} ${ampm}`
}

function fmtHourLabel(hour: number): string {
  if (hour === 0) return '12 AM'
  if (hour === 12) return '12 PM'
  return hour < 12 ? `${hour} AM` : `${hour - 12} PM`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6)
  return `${fmtDate(weekStart)} – ${fmtDate(end)}`
}

// ── Cron decoder ─────────────────────────────────────────────────────────────

function decodeCron(expr: string): { description: string; nexts: string[]; error?: string } {
  const err = validateCronExpression(expr.trim())
  if (err) return { description: '', nexts: [], error: err }
  const description = describeCronFrequency(expr)
  const now = Date.now()
  const occs = getCronOccurrences(expr, now, now + 14 * 24 * 3600_000, 5)
  const nexts = occs.map(o => new Date(o.atMs).toLocaleString())
  return { description, nexts }
}

// ── Cron Decoder Widget ───────────────────────────────────────────────────────

function CronDecoderWidget() {
  const [open, setOpen] = useState(false)
  const [expr, setExpr] = useState('')
  const result = useMemo(() => expr.trim() ? decodeCron(expr.trim()) : null, [expr])

  return (
    <div className="relative">
      <Button variant="outline" size="sm" onClick={() => setOpen(p => !p)} className="text-xs">
        ⏱ Decode Cron
      </Button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-80 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">Cron Expression Decoder</span>
            <button onClick={() => setOpen(false)} className="text-zinc-500 hover:text-zinc-300 text-base leading-none">&times;</button>
          </div>
          <input
            value={expr}
            onChange={e => setExpr(e.target.value)}
            placeholder="0 9 * * 1-5"
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-zinc-500"
          />
          {result && (
            result.error ? (
              <p className="text-xs text-red-400">{result.error}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-xs text-zinc-300 font-medium">{result.description}</p>
                {result.nexts.length > 0 && (
                  <div>
                    <p className="text-xs text-zinc-500 mb-1">Next runs:</p>
                    <ul className="space-y-0.5">
                      {result.nexts.map((n, i) => (
                        <li key={i} className="text-xs text-zinc-400 font-mono">{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

// ── Today's Schedule Sidebar ──────────────────────────────────────────────────

function TodaySidebar({
  jobs,
  todayOccurrences,
  colorIdx,
}: {
  jobs: CronJob[]
  todayOccurrences: Array<{ job: CronJob; atMs: number; jobIdx: number }>
  colorIdx: (name: string) => number
}) {
  const now = Date.now()
  const sorted = [...todayOccurrences].sort((a, b) => a.atMs - b.atMs)
  const nextIdx = sorted.findIndex(o => o.atMs >= now)

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 text-zinc-500 text-xs text-center px-4">
        <div className="text-2xl mb-2">📅</div>
        No scheduled jobs today
      </div>
    )
  }

  return (
    <div className="space-y-1 px-1">
      {sorted.map((o, i) => {
        const isPast = o.atMs < now
        const isNext = i === nextIdx
        const color = JOB_COLORS[colorIdx(o.job.name) % JOB_COLORS.length]

        return (
          <div key={`${o.job.name}-${o.atMs}`}
            className={`flex items-start gap-2 rounded-lg px-2 py-2 transition-colors
              ${isNext ? 'bg-zinc-800 border border-zinc-700 ring-1 ring-zinc-600' : 'hover:bg-zinc-800/50'}`}>
            {/* Status dot */}
            <div className="shrink-0 mt-0.5">
              {isPast ? (
                <div className={`w-2 h-2 rounded-full ${
                  o.job.lastStatus === 'success' ? 'bg-emerald-400' :
                  o.job.lastStatus === 'error'   ? 'bg-red-400' :
                  'bg-zinc-600'
                }`} />
              ) : (
                <div className={`w-2 h-2 rounded-full ${color.dot} ${isNext ? 'animate-pulse' : ''}`} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-mono ${isPast ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  {fmtTime(o.atMs)}
                </span>
                {isNext && <span className="text-xs text-yellow-400 font-medium">next</span>}
              </div>
              <div className={`text-xs truncate ${isPast ? 'text-zinc-600' : 'text-zinc-200'}`}>
                {o.job.name}
              </div>
              {!o.job.enabled && <span className="text-xs text-zinc-600">disabled</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Tooltip ───────────────────────────────────────────────────────────────────

function BlockTooltip({ tip }: { tip: TooltipState }) {
  const { job, atMs } = tip
  const rawExpr = job.schedule.replace(/\s*\([^)]+\)$/, '').trim()
  const desc = describeCronFrequency(rawExpr)
  const statusColor = job.lastStatus === 'success' ? 'text-emerald-400' : job.lastStatus === 'error' ? 'text-red-400' : 'text-zinc-400'

  return (
    <div
      className="fixed z-50 pointer-events-none bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl px-3 py-2.5 text-xs max-w-xs"
      style={{ left: tip.x + 12, top: tip.y - 8 }}
    >
      <div className="font-semibold text-zinc-100 mb-1">{job.name}</div>
      <div className="text-zinc-400 mb-1 font-mono">{job.schedule}</div>
      <div className="text-zinc-400 mb-1">{desc}</div>
      <div className="text-zinc-300 mb-1">{fmtTime(atMs)}</div>
      {job.lastStatus && (
        <div className={`font-medium ${statusColor}`}>
          Last: {job.lastStatus}
          {job.lastRun ? ` · ${new Date(job.lastRun).toLocaleString()}` : ''}
        </div>
      )}
      {job.timezone && <div className="text-zinc-500 mt-0.5">TZ: {job.timezone}</div>}
      {!job.enabled && <div className="text-zinc-500 italic mt-0.5">disabled</div>}
    </div>
  )
}

// ── Job Block ─────────────────────────────────────────────────────────────────

function JobBlock({
  block,
  onHover,
  onLeave,
}: {
  block: PlacedBlock
  onHover: (e: React.MouseEvent, job: CronJob, atMs: number) => void
  onLeave: () => void
}) {
  const color = JOB_COLORS[block.jobIdx % JOB_COLORS.length]
  const topPct = ((block.hour - HOUR_START) + block.minute / 60) / VISIBLE_HOURS * 100
  const heightPx = Math.max(22, ROW_H * 0.4)
  const widthPct = 100 / block.totalCols
  const leftPct = widthPct * block.col

  return (
    <div
      className={`absolute rounded border ${color.bg} ${color.border} cursor-pointer overflow-hidden transition-opacity hover:opacity-100 opacity-90 select-none`}
      style={{
        top: `${topPct}%`,
        height: `${heightPx}px`,
        left: `${leftPct + 1}%`,
        width: `${widthPct - 2}%`,
        zIndex: 10,
      }}
      onMouseEnter={e => onHover(e, block.job, block.atMs)}
      onMouseLeave={onLeave}
    >
      <div className="px-1 py-0.5 h-full flex flex-col justify-center">
        <div className="text-white text-[10px] font-medium leading-tight truncate">{block.job.name}</div>
        <div className="text-white/70 text-[9px] leading-tight">{fmtTime(block.atMs)}</div>
      </div>
    </div>
  )
}

// ── Day Column ────────────────────────────────────────────────────────────────

function DayColumn({
  day,
  dayIdx,
  date,
  isToday,
  blocks,
  onHover,
  onLeave,
  nowMs,
}: {
  day: string
  dayIdx: number
  date: Date
  isToday: boolean
  blocks: PlacedBlock[]
  onHover: (e: React.MouseEvent, job: CronJob, atMs: number) => void
  onLeave: () => void
  nowMs: number
}) {
  // Current time indicator position
  const now = new Date(nowMs)
  const nowHour = now.getHours() + now.getMinutes() / 60
  const nowPct = ((nowHour - HOUR_START) / VISIBLE_HOURS) * 100
  const showNowLine = isToday && nowHour >= HOUR_START && nowHour <= HOUR_END

  return (
    <div
      className={`relative flex-1 border-l border-zinc-800 min-w-0 ${isToday ? 'bg-zinc-800/20' : ''}`}
      style={{ height: ROW_H * VISIBLE_HOURS }}
    >
      {/* Hour grid lines */}
      {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
        <div
          key={i}
          className="absolute w-full border-t border-zinc-800/60"
          style={{ top: `${(i / VISIBLE_HOURS) * 100}%` }}
        />
      ))}
      {/* Half-hour lines */}
      {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
        <div
          key={`h${i}`}
          className="absolute w-full border-t border-zinc-800/30"
          style={{ top: `${((i + 0.5) / VISIBLE_HOURS) * 100}%` }}
        />
      ))}

      {/* Job blocks */}
      {blocks.map((block, i) => (
        <JobBlock key={`${block.job.name}-${block.atMs}-${i}`} block={block} onHover={onHover} onLeave={onLeave} />
      ))}

      {/* Current time line */}
      {showNowLine && (
        <div
          className="absolute left-0 right-0 z-20 pointer-events-none"
          style={{ top: `${nowPct}%` }}
        >
          <div className="relative">
            <div className="absolute -left-1 -top-1 w-2 h-2 rounded-full bg-red-500" />
            <div className="h-px bg-red-500/80 w-full" />
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function SchedulePanel() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [tz, setTz] = useState('local')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [nowMs, setNowMs] = useState(Date.now())
  const gridRef = useRef<HTMLDivElement>(null)

  // Clock tick every minute for the time indicator
  useEffect(() => {
    const id = setInterval(() => setNowMs(Date.now()), 60_000)
    return () => clearInterval(id)
  }, [])

  // Scroll to current time on mount
  useEffect(() => {
    if (!gridRef.current) return
    const now = new Date()
    const nowHour = now.getHours() + now.getMinutes() / 60
    const pct = (nowHour - HOUR_START) / VISIBLE_HOURS
    const scrollTop = Math.max(0, pct * ROW_H * VISIBLE_HOURS - 120)
    gridRef.current.scrollTop = scrollTop
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cron?action=list')
      if (res.ok) {
        const d = await res.json()
        setJobs(d.jobs || [])
      }
    } catch (err) {
      log.error('Failed to load cron jobs', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useSmartPoll(load, 60_000)

  // Week boundaries (local midnight based)
  const weekStart = useMemo(() => startOfWeek(new Date(), weekOffset), [weekOffset])
  const weekEnd   = useMemo(() => { const d = addDays(weekStart, 7); d.setHours(0,0,0,0); return d }, [weekStart])
  const today     = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d }, [nowMs])

  // Stable job color index (by insertion order)
  const colorIdx = useCallback((name: string) => {
    const idx = jobs.findIndex(j => j.name === name)
    return idx >= 0 ? idx % JOB_COLORS.length : 0
  }, [jobs])

  // Compute all occurrences for the week, grouped by day
  const weekOccurrences = useMemo(() => {
    const byDay: Map<number, PlacedBlock[]> = new Map()
    for (let d = 0; d < 7; d++) byDay.set(d, [])

    jobs.forEach((job, jobIdx) => {
      if (!job.enabled) return
      const rawExpr = job.schedule.replace(/\s*\([^)]+\)$/, '').trim()
      const occs = getCronOccurrences(rawExpr, weekStart.getTime(), weekEnd.getTime(), 500)

      occs.forEach(occ => {
        const dt = new Date(occ.atMs)
        const h = dt.getHours()
        const m = dt.getMinutes()
        if (h < HOUR_START || h > HOUR_END) return

        const dow = dt.getDay()
        byDay.get(dow)!.push({
          jobIdx: jobIdx % JOB_COLORS.length,
          job,
          atMs: occ.atMs,
          hour: h,
          minute: m,
          col: 0,
          totalCols: 1,
        })
      })
    })

    // Resolve column collisions within each day
    byDay.forEach((blocks) => {
      blocks.sort((a, b) => a.atMs - b.atMs)
      // Group overlapping blocks (within 30-minute window)
      const OVERLAP_MS = 30 * 60_000
      let groupStart = 0
      while (groupStart < blocks.length) {
        let groupEnd = groupStart + 1
        while (groupEnd < blocks.length && blocks[groupEnd].atMs - blocks[groupStart].atMs < OVERLAP_MS) {
          groupEnd++
        }
        const group = blocks.slice(groupStart, groupEnd)
        group.forEach((b, i) => { b.col = i; b.totalCols = group.length })
        groupStart = groupEnd
      }
    })

    return byDay
  }, [jobs, weekStart, weekEnd])

  // Today's occurrences for sidebar (full day, not just visible hours)
  const todayOccurrences = useMemo(() => {
    const todayStart = today.getTime()
    const todayEnd   = todayStart + 86400_000
    const result: Array<{ job: CronJob; atMs: number; jobIdx: number }> = []

    jobs.forEach((job, jobIdx) => {
      if (!job.enabled) return
      const rawExpr = job.schedule.replace(/\s*\([^)]+\)$/, '').trim()
      const occs = getCronOccurrences(rawExpr, todayStart, todayEnd, 200)
      occs.forEach(o => result.push({ job, atMs: o.atMs, jobIdx }))
    })

    return result
  }, [jobs, today])

  // Stats
  const enabledCount = jobs.filter(j => j.enabled).length
  const todayCount   = todayOccurrences.length
  const nextJob      = todayOccurrences.filter(o => o.atMs >= nowMs).sort((a, b) => a.atMs - b.atMs)[0]

  function handleHover(e: React.MouseEvent, job: CronJob, atMs: number) {
    setTooltip({ x: e.clientX, y: e.clientY, job, atMs })
  }
  function handleLeave() { setTooltip(null) }
  function handleMouseMove(e: React.MouseEvent) {
    if (tooltip) setTooltip(t => t ? { ...t, x: e.clientX, y: e.clientY } : null)
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden" onMouseMove={handleMouseMove}>

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-800 shrink-0 flex-wrap gap-y-2">
        {/* Left: stats */}
        <div className="flex items-center gap-4">
          <h1 className="text-sm font-semibold text-zinc-100">Schedule</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span><span className="text-zinc-300 font-medium">{enabledCount}</span> active jobs</span>
            <span><span className="text-blue-400 font-medium">{todayCount}</span> runs today</span>
            {nextJob && (
              <span className="text-yellow-400">
                next: {nextJob.job.name} @ {fmtTime(nextJob.atMs)}
              </span>
            )}
          </div>
        </div>

        {/* Right: controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Week navigator */}
          <div className="flex items-center gap-1 bg-zinc-800 border border-zinc-700 rounded-lg overflow-hidden">
            <button onClick={() => setWeekOffset(p => p - 1)}
              className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">‹</button>
            <button onClick={() => setWeekOffset(0)}
              className={`px-3 py-1.5 text-xs transition-colors ${weekOffset === 0 ? 'text-zinc-100 font-medium' : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'}`}>
              {weekOffset === 0 ? 'This Week' : fmtWeekRange(weekStart)}
            </button>
            <button onClick={() => setWeekOffset(p => p + 1)}
              className="px-2.5 py-1.5 text-xs text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors">›</button>
          </div>

          {/* Timezone */}
          <select value={tz} onChange={e => setTz(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500">
            {TIMEZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>

          {/* Cron decoder */}
          <CronDecoderWidget />

          {/* Sidebar toggle */}
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(p => !p)} className="text-xs">
            {sidebarOpen ? '→ Hide' : '← Today'}
          </Button>
        </div>
      </div>

      {/* ── Main area ───────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Calendar grid ───────────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

          {/* Day headers */}
          <div className="flex border-b border-zinc-800 shrink-0 bg-zinc-950">
            {/* Time gutter spacer */}
            <div className="w-14 shrink-0" />
            {DAYS.map((day, i) => {
              const date = addDays(weekStart, i)
              const isToday = isSameDay(date, today)
              return (
                <div key={day}
                  className={`flex-1 text-center py-2 border-l border-zinc-800 text-xs
                    ${isToday ? 'bg-zinc-800/30' : ''}`}>
                  <div className={`font-medium ${isToday ? 'text-zinc-100' : 'text-zinc-500'}`}>{day}</div>
                  <div className={`text-xs mt-0.5 ${isToday ? 'text-blue-400 font-semibold' : 'text-zinc-600'}`}>
                    {fmtDate(date)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scrollable grid body */}
          <div ref={gridRef} className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="flex" style={{ height: ROW_H * VISIBLE_HOURS }}>

              {/* Time gutter */}
              <div className="w-14 shrink-0 relative bg-zinc-950 border-r border-zinc-800">
                {Array.from({ length: VISIBLE_HOURS }, (_, i) => (
                  <div key={i} className="absolute right-0 pr-2" style={{ top: `${(i / VISIBLE_HOURS) * 100}%` }}>
                    <span className="text-[10px] text-zinc-600 leading-none -mt-2 block">
                      {fmtHourLabel(HOUR_START + i)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Day columns */}
              {DAYS.map((day, i) => {
                const date = addDays(weekStart, i)
                const isToday = isSameDay(date, today)
                const blocks = weekOccurrences.get(i) || []
                return (
                  <DayColumn
                    key={day}
                    day={day}
                    dayIdx={i}
                    date={date}
                    isToday={isToday}
                    blocks={blocks}
                    onHover={handleHover}
                    onLeave={handleLeave}
                    nowMs={nowMs}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* ── Right sidebar ──────────────────────────────────────────────── */}
        {sidebarOpen && (
          <div className="w-64 shrink-0 border-l border-zinc-800 flex flex-col">
            {/* Sidebar header */}
            <div className="px-4 py-3 border-b border-zinc-800 shrink-0">
              <div className="text-xs font-semibold text-zinc-300">Today's Schedule</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
              </div>
            </div>

            {/* Job legend */}
            {jobs.length > 0 && (
              <div className="px-3 py-2 border-b border-zinc-800 shrink-0 space-y-1">
                <div className="text-xs text-zinc-500 mb-1">Jobs</div>
                {jobs.map((job, i) => {
                  const color = JOB_COLORS[i % JOB_COLORS.length]
                  return (
                    <div key={job.name} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-sm shrink-0 ${color.dot}`} />
                      <span className={`text-xs truncate ${job.enabled ? 'text-zinc-300' : 'text-zinc-600 line-through'}`}>
                        {job.name}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Today's list */}
            <div className="flex-1 overflow-y-auto py-2">
              {loading ? (
                <div className="text-center text-zinc-500 text-xs py-8">Loading…</div>
              ) : (
                <TodaySidebar jobs={jobs} todayOccurrences={todayOccurrences} colorIdx={colorIdx} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Disabled jobs notice ─────────────────────────────────────────── */}
      {jobs.some(j => !j.enabled) && (
        <div className="px-4 py-1.5 border-t border-zinc-800 shrink-0 text-xs text-zinc-600">
          {jobs.filter(j => !j.enabled).length} disabled job(s) hidden from calendar
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────────────────── */}
      {!loading && jobs.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="text-4xl mb-3">⏰</div>
            <p className="text-zinc-500 text-sm">No cron jobs configured</p>
            <p className="text-zinc-600 text-xs mt-1">Add jobs via the Cron panel</p>
          </div>
        </div>
      )}

      {/* ── Tooltip ──────────────────────────────────────────────────────── */}
      {tooltip && <BlockTooltip tip={tooltip} />}
    </div>
  )
}
