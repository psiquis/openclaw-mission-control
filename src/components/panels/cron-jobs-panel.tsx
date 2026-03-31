'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { getCronOccurrences } from '@/lib/cron-occurrences'
import { describeCronFrequency, validateCronExpression } from '@/lib/cron-utils'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('CronJobsPanel')

// ── Types ─────────────────────────────────────────────────────────────────────

interface CronJob {
  id?: string
  name: string
  schedule: string   // may include "(TZ)" suffix
  command: string
  model?: string
  agentId?: string
  timezone?: string
  delivery?: string
  enabled: boolean
  lastRun?: number   // ms
  nextRun?: number   // ms
  lastStatus?: 'success' | 'error' | 'running'
  lastError?: string
}

interface RunEntry {
  jobId?: string
  status?: string
  timestamp?: number
  startedAtMs?: number
  durationMs?: number
  deliveryStatus?: string
  error?: string
}

type FilterTab = 'all' | 'enabled' | 'disabled' | 'erroring'

interface JobFormState {
  name: string
  schedule: string
  command: string
  model: string
  timezone: string
  timeout: string
  deliveryMode: 'none' | 'channel'
  deliveryChannel: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MODELS = [
  'claude-opus-4-5',
  'claude-sonnet-4-5',
  'claude-haiku-4-5',
  'claude-opus-4',
  'claude-sonnet-4',
  'claude-3-7-sonnet-latest',
  'claude-3-5-haiku-latest',
]

const CRON_PRESETS = [
  { label: 'Every minute',       expr: '* * * * *' },
  { label: 'Every 5 minutes',    expr: '*/5 * * * *' },
  { label: 'Every 15 minutes',   expr: '*/15 * * * *' },
  { label: 'Every 30 minutes',   expr: '*/30 * * * *' },
  { label: 'Hourly',             expr: '0 * * * *' },
  { label: 'Daily at 8 AM',      expr: '0 8 * * *' },
  { label: 'Daily at midnight',  expr: '0 0 * * *' },
  { label: 'Weekdays at 9 AM',   expr: '0 9 * * 1-5' },
  { label: 'Mon/Wed/Fri 9 AM',   expr: '0 9 * * 1,3,5' },
  { label: 'Weekly (Mon 9 AM)',   expr: '0 9 * * 1' },
  { label: 'Monthly (1st, 9AM)', expr: '0 9 1 * *' },
]

const TIMEZONES = [
  '', 'UTC', 'America/New_York', 'America/Chicago', 'America/Denver',
  'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Kolkata', 'Australia/Sydney',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function rawExpr(schedule: string): string {
  return schedule.replace(/\s*\([^)]+\)$/, '').trim()
}

function extractTZ(schedule: string): string {
  const m = schedule.match(/\(([^)]+)\)$/)
  return m ? m[1] : ''
}

function humanSchedule(schedule: string): string {
  const expr = rawExpr(schedule)
  const tz = extractTZ(schedule)
  const desc = describeCronFrequency(expr)
  return tz ? `${desc} (${tz})` : desc
}

function timeAgo(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return 'just now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

function fmtMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`
}

function nextRunLabel(job: CronJob): string {
  if (!job.enabled) return '—'
  if (job.nextRun) {
    const diff = job.nextRun - Date.now()
    if (diff < 0) return 'overdue'
    if (diff < 60_000) return 'in <1m'
    if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`
    if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`
    return `in ${Math.floor(diff / 86_400_000)}d`
  }
  // Calculate from expression
  const expr = rawExpr(job.schedule)
  const occs = getCronOccurrences(expr, Date.now(), Date.now() + 7 * 86_400_000, 1)
  if (occs.length === 0) return '—'
  const diff = occs[0].atMs - Date.now()
  if (diff < 60_000) return 'in <1m'
  if (diff < 3_600_000) return `in ${Math.floor(diff / 60_000)}m`
  if (diff < 86_400_000) return `in ${Math.floor(diff / 3_600_000)}h`
  return `in ${Math.floor(diff / 86_400_000)}d`
}

function healthColor(job: CronJob): string {
  if (!job.enabled) return 'text-zinc-500'
  if (job.lastStatus === 'error') return 'text-red-400'
  if (job.lastStatus === 'running') return 'text-yellow-400'
  if (job.lastStatus === 'success') return 'text-emerald-400'
  return 'text-zinc-400'
}

function healthBg(job: CronJob): string {
  if (!job.enabled) return ''
  if (job.lastStatus === 'error') return 'border-l-2 border-red-500/50'
  if (job.lastStatus === 'running') return 'border-l-2 border-yellow-500/50'
  return ''
}

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <span className="text-xs text-zinc-600">—</span>
  const cfg: Record<string, { cls: string; label: string }> = {
    success: { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', label: '✓ ok' },
    error:   { cls: 'bg-red-500/15 text-red-400 border-red-500/30',            label: '✗ error' },
    running: { cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',   label: '⟳ running' },
  }
  const c = cfg[status] || { cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30', label: status }
  return (
    <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${c.cls}`}>{c.label}</span>
  )
}

// ── Run History Modal ─────────────────────────────────────────────────────────

function RunHistoryModal({ job, onClose }: { job: CronJob; onClose: () => void }) {
  const [page, setPage] = useState(1)
  const [entries, setEntries] = useState<RunEntry[]>([])
  const [total, setTotal] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async (p: number) => {
    setLoading(true)
    try {
      const id = job.id || job.name
      const res = await fetch(`/api/cron?action=history&jobId=${encodeURIComponent(id)}&page=${p}`)
      if (res.ok) {
        const d = await res.json()
        setEntries(d.entries || [])
        setTotal(d.total || 0)
        setHasMore(d.hasMore || false)
        setPage(p)
      }
    } finally { setLoading(false) }
  }, [job])

  useEffect(() => { load(1) }, [load])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-zinc-100">Run History</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{job.name} · {total} total runs</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">Loading…</div>
          ) : entries.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-zinc-500 text-sm">No run history available</div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-zinc-900 border-b border-zinc-800">
                <tr>
                  {['Time', 'Status', 'Duration', 'Delivery', 'Error'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-xs font-medium text-zinc-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => {
                  const ts = e.timestamp || e.startedAtMs || 0
                  return (
                    <tr key={i} className="border-b border-zinc-800/60 hover:bg-zinc-800/30">
                      <td className="px-4 py-2.5 text-xs text-zinc-400 whitespace-nowrap">
                        {ts ? new Date(ts).toLocaleString() : '—'}
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={e.status} /></td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">
                        {e.durationMs ? fmtMs(e.durationMs) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-zinc-400">{e.deliveryStatus || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-red-400 max-w-xs truncate" title={e.error}>
                        {e.error || '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
        {(page > 1 || hasMore) && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-800 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => load(page - 1)} disabled={page === 1}>← Prev</Button>
            <span className="text-xs text-zinc-500">Page {page}</span>
            <Button variant="ghost" size="sm" onClick={() => load(page + 1)} disabled={!hasMore}>Next →</Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Job Form Modal ────────────────────────────────────────────────────────────

function JobFormModal({
  job,
  onClose,
  onSaved,
}: {
  job: CronJob | null  // null = new job
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!job

  const [form, setForm] = useState<JobFormState>({
    name:            job?.name || '',
    schedule:        job ? rawExpr(job.schedule) : '',
    command:         job?.command || '',
    model:           job?.model || '',
    timezone:        job?.timezone || extractTZ(job?.schedule || '') || '',
    timeout:         '',
    deliveryMode:    job?.delivery ? 'channel' : 'none',
    deliveryChannel: job?.delivery || '',
  })
  const [errors, setErrors] = useState<Partial<Record<keyof JobFormState, string>>>({})
  const [saving, setSaving] = useState(false)
  const [apiErr, setApiErr] = useState('')
  const [showPresets, setShowPresets] = useState(false)

  const set = (k: keyof JobFormState, v: string) => setForm(f => ({ ...f, [k]: v }))

  const scheduleError = useMemo(() => {
    if (!form.schedule.trim()) return ''
    return validateCronExpression(form.schedule.trim()) || ''
  }, [form.schedule])

  const schedulePreview = useMemo(() => {
    if (!form.schedule.trim() || scheduleError) return ''
    const desc = describeCronFrequency(form.schedule.trim())
    const tz = form.timezone ? ` (${form.timezone})` : ''
    return desc + tz
  }, [form.schedule, form.timezone, scheduleError])

  const nextOccurrences = useMemo(() => {
    if (!form.schedule.trim() || scheduleError) return []
    const occs = getCronOccurrences(form.schedule.trim(), Date.now(), Date.now() + 7 * 86_400_000, 4)
    return occs.map(o => new Date(o.atMs).toLocaleString())
  }, [form.schedule, scheduleError])

  function validate(): boolean {
    const errs: Partial<Record<keyof JobFormState, string>> = {}
    if (!form.name.trim()) errs.name = 'Name is required'
    if (!form.schedule.trim()) errs.schedule = 'Schedule is required'
    else if (scheduleError) errs.schedule = scheduleError
    if (!form.command.trim()) errs.command = 'Task prompt is required'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setApiErr('')
    try {
      const payload: Record<string, unknown> = {
        action:   isEdit ? 'update' : 'add',
        jobId:    job?.id || job?.name,
        name:     form.name.trim(),
        schedule: form.schedule.trim(),
        command:  form.command.trim(),
        model:    form.model || undefined,
        timezone: form.timezone || undefined,
        timeout:  form.timeout ? Number(form.timeout) : undefined,
        delivery: form.deliveryMode === 'channel' ? form.deliveryChannel.trim() || undefined : undefined,
      }
      const res = await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        setApiErr(d.error || 'Failed to save job')
        return
      }
      onSaved()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-semibold text-zinc-100">{isEdit ? 'Edit Job' : 'New Cron Job'}</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Job Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="Daily standup brief"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs text-zinc-400">Cron Expression *</label>
              <button type="button" onClick={() => setShowPresets(p => !p)}
                className="text-xs text-zinc-500 hover:text-zinc-300 underline">
                {showPresets ? 'Hide presets' : 'Show presets'}
              </button>
            </div>
            {showPresets && (
              <div className="mb-2 grid grid-cols-2 gap-1">
                {CRON_PRESETS.map(p => (
                  <button key={p.expr} type="button"
                    onClick={() => { set('schedule', p.expr); setShowPresets(false) }}
                    className="text-left text-xs px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">
                    <span className="text-zinc-500 font-mono mr-1">{p.expr}</span> {p.label}
                  </button>
                ))}
              </div>
            )}
            <input value={form.schedule} onChange={e => set('schedule', e.target.value)}
              placeholder="0 9 * * 1-5" className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-zinc-500" />
            {scheduleError && <p className="text-xs text-red-400 mt-1">{scheduleError}</p>}
            {schedulePreview && !scheduleError && (
              <div className="mt-1.5 space-y-1">
                <p className="text-xs text-emerald-400 font-medium">{schedulePreview}</p>
                {nextOccurrences.length > 0 && (
                  <div className="text-xs text-zinc-500">
                    Next: {nextOccurrences.join(' · ')}
                  </div>
                )}
              </div>
            )}
            {errors.schedule && <p className="text-xs text-red-400 mt-1">{errors.schedule}</p>}
          </div>

          {/* Task prompt */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Task Prompt *</label>
            <textarea value={form.command} onChange={e => set('command', e.target.value)}
              rows={4} placeholder="Write a daily brief summarizing completed tasks and blockers…"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-y" />
            {errors.command && <p className="text-xs text-red-400 mt-1">{errors.command}</p>}
          </div>

          {/* Model + TZ + Timeout */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Model</label>
              <select value={form.model} onChange={e => set('model', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500">
                <option value="">Default</option>
                {MODELS.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Timezone</label>
              <select value={form.timezone} onChange={e => set('timezone', e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-500">
                <option value="">System default</option>
                {TIMEZONES.filter(Boolean).map(z => <option key={z} value={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Timeout (s)</label>
              <input value={form.timeout} onChange={e => set('timeout', e.target.value)} type="number"
                placeholder="300" min="5" max="3600"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-2 text-xs text-zinc-300 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            </div>
          </div>

          {/* Delivery */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Delivery Mode</label>
            <div className="flex gap-2 mb-2">
              {(['none', 'channel'] as const).map(m => (
                <button key={m} type="button" onClick={() => set('deliveryMode', m)}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${form.deliveryMode === m ? 'bg-zinc-700 border-zinc-500 text-zinc-100' : 'bg-zinc-800 border-zinc-700 text-zinc-400 hover:text-zinc-200'}`}>
                  {m === 'none' ? 'None' : 'Announce to channel'}
                </button>
              ))}
            </div>
            {form.deliveryMode === 'channel' && (
              <input value={form.deliveryChannel} onChange={e => set('deliveryChannel', e.target.value)}
                placeholder="#general or channel ID"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            )}
          </div>

          {apiErr && <p className="text-xs text-red-400">{apiErr}</p>}
        </form>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-zinc-800 shrink-0">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={submit} disabled={saving}>
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Job'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Expanded Row ──────────────────────────────────────────────────────────────

function ExpandedRow({
  job,
  onEdit,
  onHistory,
}: {
  job: CronJob
  onEdit: () => void
  onHistory: () => void
}) {
  const [runLogs, setRunLogs] = useState<Array<{ timestamp: number; message: string; level: string }>>([])
  const [logsLoading, setLogsLoading] = useState(true)

  useEffect(() => {
    const id = job.id || job.name
    fetch(`/api/cron?action=logs&job=${encodeURIComponent(id)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.logs) setRunLogs(d.logs) })
      .catch(() => {})
      .finally(() => setLogsLoading(false))
  }, [job.id, job.name])

  const expr = rawExpr(job.schedule)
  const tz = extractTZ(job.schedule) || job.timezone || ''

  return (
    <div className="bg-zinc-900/50 border-t border-zinc-800/60 px-4 py-4 grid grid-cols-2 gap-6">
      {/* Left: config details */}
      <div className="space-y-3">
        <div>
          <div className="text-xs text-zinc-500 mb-1">Cron Expression</div>
          <code className="text-xs text-zinc-300 bg-zinc-800 px-2 py-1 rounded font-mono">{expr}</code>
          {tz && <span className="ml-2 text-xs text-zinc-500">({tz})</span>}
        </div>

        <div>
          <div className="text-xs text-zinc-500 mb-1">Human Readable</div>
          <div className="text-xs text-zinc-300">{humanSchedule(job.schedule)}</div>
        </div>

        {job.model && (
          <div>
            <div className="text-xs text-zinc-500 mb-1">Model</div>
            <div className="text-xs text-zinc-300 font-mono">{job.model}</div>
          </div>
        )}

        {job.delivery && (
          <div>
            <div className="text-xs text-zinc-500 mb-1">Delivery Channel</div>
            <div className="text-xs text-zinc-300">{job.delivery}</div>
          </div>
        )}

        {job.agentId && (
          <div>
            <div className="text-xs text-zinc-500 mb-1">Agent</div>
            <div className="text-xs text-zinc-300 font-mono">{job.agentId}</div>
          </div>
        )}

        {job.lastError && (
          <div>
            <div className="text-xs text-red-500 mb-1">Last Error</div>
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded px-2 py-1.5 font-mono break-all">
              {job.lastError}
            </div>
          </div>
        )}

        <div>
          <div className="text-xs text-zinc-500 mb-1">Task Prompt</div>
          <div className="text-xs text-zinc-400 bg-zinc-800 rounded px-2 py-2 max-h-24 overflow-y-auto leading-relaxed whitespace-pre-wrap break-words">
            {job.command || '—'}
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="xs" onClick={onEdit}>✏ Edit</Button>
          <Button variant="ghost" size="xs" onClick={onHistory} className="text-zinc-400">
            📋 Run History
          </Button>
        </div>
      </div>

      {/* Right: recent logs */}
      <div>
        <div className="text-xs text-zinc-500 mb-2">Recent Activity</div>
        {logsLoading ? (
          <div className="text-xs text-zinc-600">Loading logs…</div>
        ) : runLogs.length === 0 ? (
          <div className="text-xs text-zinc-600">No logs available</div>
        ) : (
          <div className="space-y-1.5 max-h-52 overflow-y-auto">
            {runLogs.map((log, i) => (
              <div key={i} className="flex gap-2 items-start">
                <span className={`text-xs shrink-0 font-medium ${log.level === 'error' ? 'text-red-400' : 'text-zinc-500'}`}>
                  {log.level === 'error' ? '✗' : '·'}
                </span>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-zinc-400 leading-relaxed">{log.message}</span>
                </div>
                <span className="text-xs text-zinc-600 shrink-0 whitespace-nowrap">
                  {log.timestamp ? timeAgo(log.timestamp) : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Job Row ───────────────────────────────────────────────────────────────────

function JobRow({
  job,
  expanded,
  onToggleExpand,
  onToggleEnable,
  onRunNow,
  onEdit,
  onDelete,
  onHistory,
  running,
}: {
  job: CronJob
  expanded: boolean
  onToggleExpand: () => void
  onToggleEnable: () => void
  onRunNow: () => void
  onEdit: () => void
  onDelete: () => void
  onHistory: () => void
  running: boolean
}) {
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  return (
    <>
      <tr
        className={`border-b border-zinc-800/60 transition-colors cursor-pointer group
          ${expanded ? 'bg-zinc-800/30' : 'hover:bg-zinc-800/20'} ${healthBg(job)}`}
        onClick={onToggleExpand}
      >
        {/* Name */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>›</span>
            <div>
              <div className={`text-sm font-medium ${!job.enabled ? 'text-zinc-500' : 'text-zinc-100'}`}>
                {job.name}
              </div>
              {job.agentId && job.agentId !== 'system' && (
                <div className="text-xs text-zinc-600">{job.agentId}</div>
              )}
            </div>
          </div>
        </td>

        {/* Schedule */}
        <td className="px-4 py-3">
          <div className="text-xs text-zinc-300">{humanSchedule(job.schedule)}</div>
          <div className="text-xs text-zinc-600 font-mono mt-0.5">{rawExpr(job.schedule)}</div>
        </td>

        {/* Timezone */}
        <td className="px-4 py-3 text-xs text-zinc-500">
          {extractTZ(job.schedule) || job.timezone || <span className="text-zinc-700">—</span>}
        </td>

        {/* Status toggle */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <button onClick={onToggleEnable}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none
              ${job.enabled ? 'bg-emerald-600' : 'bg-zinc-700'}`}>
            <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform
              ${job.enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
          </button>
        </td>

        {/* Last run */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5 flex-wrap">
            {job.lastRun ? (
              <>
                <span className="text-xs text-zinc-400">{timeAgo(job.lastRun)}</span>
                <StatusBadge status={job.lastStatus} />
              </>
            ) : (
              <span className="text-xs text-zinc-600">never</span>
            )}
          </div>
        </td>

        {/* Next run */}
        <td className="px-4 py-3 text-xs text-zinc-400">{nextRunLabel(job)}</td>

        {/* Health indicator */}
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${
              !job.enabled              ? 'bg-zinc-600' :
              job.lastStatus === 'error'   ? 'bg-red-500' :
              job.lastStatus === 'running' ? 'bg-yellow-500 animate-pulse' :
              job.lastStatus === 'success' ? 'bg-emerald-500' :
              'bg-zinc-500'
            }`} />
            <span className={`text-xs font-medium ${healthColor(job)}`}>
              {!job.enabled ? 'disabled' :
               job.lastStatus === 'error'   ? 'error' :
               job.lastStatus === 'running' ? 'running' :
               job.lastStatus === 'success' ? 'healthy' : 'pending'}
            </span>
          </div>
        </td>

        {/* Actions */}
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <button onClick={onRunNow} disabled={running || !job.enabled} title="Run now"
              className="p-1.5 rounded text-zinc-400 hover:text-emerald-400 hover:bg-zinc-700 transition-colors disabled:opacity-40 text-xs">
              {running ? '⟳' : '▶'}
            </button>
            <button onClick={onEdit} title="Edit"
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-xs">
              ✏
            </button>
            <button onClick={onHistory} title="Run history"
              className="p-1.5 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700 transition-colors text-xs">
              📋
            </button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1 bg-red-500/10 border border-red-500/30 rounded px-1.5 py-1">
                <span className="text-xs text-red-400">Delete?</span>
                <button onClick={onDelete} className="text-xs text-red-400 font-medium hover:text-red-300 px-1">✓</button>
                <button onClick={() => setDeleteConfirm(false)} className="text-xs text-zinc-500 hover:text-zinc-300 px-1">✗</button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} title="Delete"
                className="p-1.5 rounded text-zinc-400 hover:text-red-400 hover:bg-zinc-700 transition-colors text-xs">
                🗑
              </button>
            )}
          </div>
        </td>
      </tr>

      {/* Expanded details */}
      {expanded && (
        <tr className="border-b border-zinc-800">
          <td colSpan={8} className="p-0">
            <ExpandedRow job={job} onEdit={onEdit} onHistory={onHistory} />
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function CronJobsPanel() {
  const [jobs, setJobs] = useState<CronJob[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editJob, setEditJob] = useState<CronJob | null>(null)
  const [historyJob, setHistoryJob] = useState<CronJob | null>(null)
  const [runningIds, setRunningIds] = useState<Set<string>>(new Set())
  const [runResult, setRunResult] = useState<{ name: string; ok: boolean; msg: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/cron?action=list')
      if (res.ok) {
        const d = await res.json()
        setJobs(d.jobs || [])
      }
    } catch (err) {
      log.error('Failed to load cron jobs', err)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  useSmartPoll(load, 30_000)

  async function toggleEnable(job: CronJob) {
    const id = job.id || job.name
    setJobs(prev => prev.map(j => (j.id || j.name) === id ? { ...j, enabled: !j.enabled } : j))
    try {
      await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', jobId: id }),
      })
    } catch {
      load() // revert on error
    }
  }

  async function runNow(job: CronJob) {
    const id = job.id || job.name
    setRunningIds(s => new Set(s).add(id))
    setRunResult(null)
    try {
      const res = await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trigger', jobId: id, mode: 'force' }),
      })
      const d = await res.json()
      setRunResult({ name: job.name, ok: res.ok && d.success, msg: d.stdout || d.error || (res.ok ? 'Triggered' : 'Failed') })
      setTimeout(() => setRunResult(null), 5000)
    } finally {
      setRunningIds(s => { const n = new Set(s); n.delete(id); return n })
    }
  }

  async function deleteJob(job: CronJob) {
    const id = job.id || job.name
    setJobs(prev => prev.filter(j => (j.id || j.name) !== id))
    try {
      await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'remove', jobId: id }),
      })
    } catch { load() }
  }

  const filtered = useMemo(() => {
    let list = jobs
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(j => j.name.toLowerCase().includes(q) || (j.agentId || '').toLowerCase().includes(q))
    }
    switch (filter) {
      case 'enabled':  return list.filter(j => j.enabled)
      case 'disabled': return list.filter(j => !j.enabled)
      case 'erroring': return list.filter(j => j.lastStatus === 'error')
      default:         return list
    }
  }, [jobs, search, filter])

  const counts = useMemo(() => ({
    all:      jobs.length,
    enabled:  jobs.filter(j => j.enabled).length,
    disabled: jobs.filter(j => !j.enabled).length,
    erroring: jobs.filter(j => j.lastStatus === 'error').length,
  }), [jobs])

  const filterTabs: Array<{ key: FilterTab; label: string; count: number; activeColor: string }> = [
    { key: 'all',      label: 'All',      count: counts.all,      activeColor: 'text-zinc-100' },
    { key: 'enabled',  label: 'Enabled',  count: counts.enabled,  activeColor: 'text-emerald-400' },
    { key: 'disabled', label: 'Disabled', count: counts.disabled, activeColor: 'text-zinc-400' },
    { key: 'erroring', label: 'Erroring', count: counts.erroring, activeColor: 'text-red-400' },
  ]

  function jobKey(job: CronJob) { return job.id || job.name }

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">

      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-zinc-800 shrink-0 flex-wrap gap-y-2">
        {/* Filter tabs */}
        <div className="flex items-center gap-1">
          {filterTabs.map(tab => (
            <button key={tab.key} onClick={() => setFilter(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors
                ${filter === tab.key
                  ? `bg-zinc-800 border border-zinc-700 ${tab.activeColor}`
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50'}`}>
              {tab.label}
              <span className={`text-xs px-1 rounded ${filter === tab.key ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-600'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Search + New */}
        <div className="flex items-center gap-2">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search jobs…"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-48" />
          <Button size="sm" onClick={() => { setEditJob(null); setShowForm(true) }}>+ New Job</Button>
        </div>
      </div>

      {/* ── Run result toast ─────────────────────────────────────────────────── */}
      {runResult && (
        <div className={`mx-5 mt-3 flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs
          ${runResult.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-300'}`}>
          <span>{runResult.ok ? '✓' : '✗'}</span>
          <span className="font-medium">{runResult.name}</span>
          <span>{runResult.msg}</span>
          <button onClick={() => setRunResult(null)} className="ml-auto text-current opacity-60 hover:opacity-100">&times;</button>
        </div>
      )}

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading jobs…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <div className="text-3xl">⏰</div>
            <p className="text-zinc-500 text-sm">
              {jobs.length === 0 ? 'No cron jobs configured yet.' : 'No jobs match your filters.'}
            </p>
            {jobs.length === 0 && (
              <Button size="sm" onClick={() => { setEditJob(null); setShowForm(true) }}>+ Create First Job</Button>
            )}
          </div>
        ) : (
          <table className="w-full">
            <thead className="sticky top-0 z-10 bg-zinc-950 border-b border-zinc-800">
              <tr>
                {[
                  { label: 'Name',      w: 'w-48' },
                  { label: 'Schedule',  w: 'w-56' },
                  { label: 'Timezone',  w: 'w-32' },
                  { label: 'Enabled',   w: 'w-20' },
                  { label: 'Last Run',  w: 'w-36' },
                  { label: 'Next Run',  w: 'w-24' },
                  { label: 'Health',    w: 'w-24' },
                  { label: 'Actions',   w: '' },
                ].map(col => (
                  <th key={col.label}
                    className={`px-4 py-3 text-left text-xs font-medium text-zinc-500 ${col.w}`}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(job => (
                <JobRow
                  key={jobKey(job)}
                  job={job}
                  expanded={expandedId === jobKey(job)}
                  onToggleExpand={() => setExpandedId(p => p === jobKey(job) ? null : jobKey(job))}
                  onToggleEnable={() => toggleEnable(job)}
                  onRunNow={() => runNow(job)}
                  onEdit={() => { setEditJob(job); setShowForm(true) }}
                  onDelete={() => deleteJob(job)}
                  onHistory={() => setHistoryJob(job)}
                  running={runningIds.has(jobKey(job))}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Footer summary ───────────────────────────────────────────────────── */}
      {!loading && jobs.length > 0 && (
        <div className="px-5 py-2 border-t border-zinc-800 shrink-0 flex items-center gap-4 text-xs text-zinc-600">
          <span>{counts.enabled} enabled</span>
          <span>{counts.disabled} disabled</span>
          {counts.erroring > 0 && <span className="text-red-500">{counts.erroring} erroring</span>}
          <span className="ml-auto">{filtered.length} of {jobs.length} shown</span>
        </div>
      )}

      {/* ── Modals ───────────────────────────────────────────────────────────── */}
      {showForm && (
        <JobFormModal
          job={editJob}
          onClose={() => { setShowForm(false); setEditJob(null) }}
          onSaved={() => { setShowForm(false); setEditJob(null); load() }}
        />
      )}

      {historyJob && (
        <RunHistoryModal job={historyJob} onClose={() => setHistoryJob(null)} />
      )}
    </div>
  )
}
