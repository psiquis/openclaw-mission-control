'use client'

import { useState, useCallback } from 'react'
import { useNavigateToPanel } from '@/lib/navigation'
import { useMissionControl } from '@/store'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { Button } from '@/components/ui/button'

// ── Types ────────────────────────────────────────────────────────────────────

interface DbStats {
  tasks: { total: number; byStatus: Record<string, number> }
  agents: { total: number; byStatus: Record<string, number> }
  dbSizeBytes: number
  webhookCount: number
  audit: { day: number; week: number; loginFailures: number }
  activities: { day: number }
  notifications: { unread: number }
}

interface DashboardApiResponse {
  db: DbStats | null
  sessions: { total: number; active: number }
  memory?: { total: number; used: number; available: number }
  disk?: { usage?: string }
  uptime?: number
}

interface SessionData {
  id: string
  active: boolean
  kind: string
}

interface ActivityItem {
  id: number
  type: string
  entity_type: string
  actor: string
  description: string
  created_at: number // unix timestamp (seconds)
  entity?: { type: string; title?: string; name?: string; status?: string } | null
}

interface CronJob {
  id?: string
  name: string
  enabled: boolean
  nextRun?: number
  lastStatus?: 'success' | 'error' | 'running'
  schedule: string
}

interface TokenStats {
  totalTokens: number
  totalCost: number
  requestCount: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`
  return String(n)
}

function formatCost(n: number): string {
  if (n < 0.01) return '<$0.01'
  return `$${n.toFixed(2)}`
}

function relativeTime(ts: number): string {
  const diffMs = Date.now() - ts * 1000
  if (diffMs <= 0) return 'just now'
  const secs = Math.floor(diffMs / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function absoluteTime(tsMs: number): string {
  const d = new Date(tsMs)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const ACTIVITY_COLORS: Record<string, string> = {
  task_created: 'text-sky-400',
  task_updated: 'text-blue-400',
  task_completed: 'text-emerald-400',
  task_assigned: 'text-violet-400',
  task_status_changed: 'text-blue-400',
  agent_registered: 'text-violet-400',
  agent_updated: 'text-purple-400',
  agent_status_changed: 'text-purple-400',
  session_control: 'text-cyan-400',
  login: 'text-emerald-400',
  login_failed: 'text-red-400',
  error: 'text-red-400',
}

function activityColor(type: string): string {
  return ACTIVITY_COLORS[type] ?? 'text-muted-foreground'
}

function activityIcon(type: string): string {
  if (type.startsWith('task')) return '◈'
  if (type.startsWith('agent')) return '◉'
  if (type.startsWith('session')) return '◎'
  if (type.includes('error') || type.includes('fail')) return '✕'
  if (type.includes('login')) return '◆'
  return '·'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  sub,
  badge,
  onClick,
  loading,
  accent,
}: {
  title: string
  value: React.ReactNode
  sub?: React.ReactNode
  badge?: React.ReactNode
  onClick?: () => void
  loading?: boolean
  accent?: 'green' | 'blue' | 'amber' | 'red' | 'violet' | 'cyan'
}) {
  const accentBorder: Record<string, string> = {
    green: 'hover:border-emerald-500/40',
    blue: 'hover:border-blue-500/40',
    amber: 'hover:border-amber-500/40',
    red: 'hover:border-red-500/40',
    violet: 'hover:border-violet-500/40',
    cyan: 'hover:border-cyan-500/40',
  }

  return (
    <div
      onClick={onClick}
      className={[
        'relative rounded-xl border border-border bg-card p-4 space-y-2',
        'transition-all duration-200',
        onClick
          ? `cursor-pointer hover:bg-secondary/30 hover:shadow-sm ${accent ? accentBorder[accent] : 'hover:border-primary/30'}`
          : '',
      ].join(' ')}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xs uppercase tracking-[0.12em] text-muted-foreground">{title}</span>
        {badge}
      </div>
      {loading ? (
        <div className="space-y-1.5">
          <div className="h-7 w-12 rounded bg-secondary animate-pulse" />
          <div className="h-3 w-20 rounded bg-secondary animate-pulse opacity-50" />
        </div>
      ) : (
        <>
          <div className="text-2xl font-semibold text-foreground leading-none">{value}</div>
          {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
        </>
      )}
      {onClick && (
        <div className="absolute bottom-3 right-3 text-muted-foreground/30 text-xs">›</div>
      )}
    </div>
  )
}

function StatusDot({ status }: { status: 'active' | 'idle' | 'error' | 'offline' | 'connected' | 'disconnected' }) {
  const map: Record<string, string> = {
    active: 'bg-emerald-500',
    connected: 'bg-emerald-500',
    idle: 'bg-amber-500',
    error: 'bg-red-500',
    disconnected: 'bg-red-500',
    offline: 'bg-zinc-500',
  }
  const pulse = status === 'active' || status === 'connected'
  return (
    <span className="relative inline-flex items-center justify-center w-2.5 h-2.5 shrink-0">
      {pulse && (
        <span className={`absolute inline-flex h-full w-full rounded-full ${map[status]} opacity-40 animate-ping`} />
      )}
      <span className={`relative inline-flex rounded-full w-1.5 h-1.5 ${map[status]}`} />
    </span>
  )
}

function AgentStatusBar({ byStatus }: { byStatus: Record<string, number> }) {
  const active = (byStatus.busy ?? 0) + (byStatus.idle ?? 0)
  const error = byStatus.error ?? 0
  const offline = byStatus.offline ?? 0
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      {active > 0 && (
        <span className="flex items-center gap-1">
          <StatusDot status="active" />
          {active} online
        </span>
      )}
      {error > 0 && (
        <span className="flex items-center gap-1">
          <StatusDot status="error" />
          {error} err
        </span>
      )}
      {offline > 0 && (
        <span className="flex items-center gap-1">
          <StatusDot status="offline" />
          {offline} off
        </span>
      )}
      {active === 0 && error === 0 && offline === 0 && (
        <span className="text-muted-foreground/50">no agents</span>
      )}
    </div>
  )
}

function TaskBreakdown({ byStatus }: { byStatus: Record<string, number> }) {
  const inProgress = byStatus.in_progress ?? 0
  const inbox = byStatus.inbox ?? 0
  const done = byStatus.done ?? 0
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
      {inProgress > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
          {inProgress} active
        </span>
      )}
      {inbox > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
          {inbox} inbox
        </span>
      )}
      {done > 0 && (
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
          {done} done
        </span>
      )}
      {inProgress === 0 && inbox === 0 && done === 0 && (
        <span className="text-muted-foreground/50">no tasks</span>
      )}
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function OverviewDashboardPanel() {
  const { connection } = useMissionControl()
  const navigateToPanel = useNavigateToPanel()

  const [dashStats, setDashStats] = useState<DashboardApiResponse | null>(null)
  const [sessions, setSessions] = useState<SessionData[]>([])
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [cronJobs, setCronJobs] = useState<CronJob[]>([])
  const [tokenStats, setTokenStats] = useState<TokenStats | null>(null)
  const [loading, setLoading] = useState({
    dash: true,
    sessions: true,
    activities: true,
    cron: true,
    tokens: true,
  })

  const load = useCallback(async () => {
    const results = await Promise.allSettled([
      // Dashboard stats
      fetch('/api/status?action=dashboard').then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        if (data && !data.error) setDashStats(data)
      }).finally(() => setLoading((p) => ({ ...p, dash: false }))),

      // Sessions
      fetch('/api/sessions').then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        setSessions(data.sessions ?? data ?? [])
      }).finally(() => setLoading((p) => ({ ...p, sessions: false }))),

      // Recent activities
      fetch('/api/activities?limit=10').then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        setActivities(data.activities ?? [])
      }).finally(() => setLoading((p) => ({ ...p, activities: false }))),

      // Cron jobs
      fetch('/api/cron').then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        if (Array.isArray(data)) setCronJobs(data)
        else if (data.jobs) setCronJobs(data.jobs)
      }).catch(() => {}).finally(() => setLoading((p) => ({ ...p, cron: false }))),

      // Token stats for today
      fetch('/api/tokens?action=stats&timeframe=today').then(async (r) => {
        if (!r.ok) return
        const data = await r.json()
        if (data?.summary) setTokenStats(data.summary)
      }).catch(() => {}).finally(() => setLoading((p) => ({ ...p, tokens: false }))),
    ])

    return results
  }, [])

  useSmartPoll(() => { load() }, 30_000, { pauseWhenConnected: true })

  // Derived values
  const activeSessions = sessions.filter((s) => s.active).length
  const totalSessions = sessions.length

  const dbStats = dashStats?.db ?? null
  const totalTasks = dbStats?.tasks.total ?? 0
  const tasksByStatus = dbStats?.tasks.byStatus ?? {}

  const totalAgents = dbStats?.agents.total ?? 0
  const agentsByStatus = dbStats?.agents.byStatus ?? {}

  const isGatewayConnected = connection.isConnected
  const gatewayLatency = connection.latency

  const cronEnabled = cronJobs.filter((j) => j.enabled).length
  const nextCronRun = cronJobs
    .filter((j) => j.enabled && j.nextRun)
    .sort((a, b) => (a.nextRun ?? Infinity) - (b.nextRun ?? Infinity))[0]

  const isInitialLoad = loading.dash && !dashStats

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-2xs uppercase tracking-[0.12em] text-muted-foreground">Overview</div>
          <h2 className="text-lg font-semibold text-foreground">Mission Control</h2>
        </div>
        <div className="flex items-center gap-2">
          <StatusDot status={isGatewayConnected ? 'connected' : 'disconnected'} />
          <span className="text-xs text-muted-foreground">
            {isGatewayConnected ? 'Gateway connected' : 'No gateway'}
          </span>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {/* Active Sessions */}
        <SummaryCard
          title="Active Sessions"
          value={
            <span className="flex items-center gap-2">
              {activeSessions}
              {activeSessions > 0 && <StatusDot status="active" />}
            </span>
          }
          sub={totalSessions > 0 ? `${totalSessions} total` : 'no sessions'}
          onClick={() => navigateToPanel('chat')}
          loading={isInitialLoad && loading.sessions}
          accent="green"
        />

        {/* Tasks */}
        <SummaryCard
          title="Tasks"
          value={totalTasks}
          sub={<TaskBreakdown byStatus={tasksByStatus} />}
          onClick={() => navigateToPanel('tasks')}
          loading={isInitialLoad}
          accent="blue"
        />

        {/* Agents */}
        <SummaryCard
          title="Agents"
          value={totalAgents}
          sub={<AgentStatusBar byStatus={agentsByStatus} />}
          onClick={() => navigateToPanel('agents')}
          loading={isInitialLoad}
          accent="violet"
        />

        {/* Gateway */}
        <SummaryCard
          title="Gateway"
          value={
            <span className={isGatewayConnected ? 'text-emerald-400' : 'text-red-400'}>
              {isGatewayConnected ? 'Connected' : 'Offline'}
            </span>
          }
          sub={
            isGatewayConnected && gatewayLatency != null
              ? `${gatewayLatency}ms latency`
              : isGatewayConnected
              ? 'no latency data'
              : 'check gateway config'
          }
          badge={<StatusDot status={isGatewayConnected ? 'connected' : 'disconnected'} />}
          onClick={() => navigateToPanel('gateways')}
          loading={false}
          accent={isGatewayConnected ? 'green' : 'red'}
        />

        {/* Token Usage */}
        <SummaryCard
          title="Token Usage"
          value={
            tokenStats?.totalTokens
              ? formatTokens(tokenStats.totalTokens)
              : '—'
          }
          sub={
            tokenStats
              ? `${formatCost(tokenStats.totalCost)} today · ${tokenStats.requestCount} req`
              : loading.tokens
              ? 'loading...'
              : 'no data today'
          }
          onClick={() => navigateToPanel('cost-tracker')}
          loading={isInitialLoad && loading.tokens}
          accent="cyan"
        />

        {/* Cron Jobs */}
        <SummaryCard
          title="Cron Jobs"
          value={cronEnabled}
          sub={
            nextCronRun?.nextRun
              ? `next: ${absoluteTime(nextCronRun.nextRun)}`
              : loading.cron
              ? 'loading...'
              : cronJobs.length > 0
              ? `${cronJobs.length} total`
              : 'no jobs'
          }
          onClick={() => navigateToPanel('cron')}
          loading={isInitialLoad && loading.cron}
          accent="amber"
        />
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Recent Activity Feed */}
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Recent Activity</h3>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => navigateToPanel('activity')}
            >
              View all ›
            </Button>
          </div>

          {loading.activities && activities.length === 0 ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-start gap-3 animate-pulse">
                  <div className="w-4 h-4 rounded bg-secondary mt-0.5 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3 bg-secondary rounded w-3/4" />
                    <div className="h-2.5 bg-secondary rounded w-1/3 opacity-60" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              No recent activity
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {activities.map((activity) => (
                <li key={activity.id} className="flex items-start gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <span
                    className={`text-sm leading-none mt-0.5 shrink-0 w-4 text-center font-mono ${activityColor(activity.type)}`}
                    aria-hidden="true"
                  >
                    {activityIcon(activity.type)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug truncate">
                      {activity.description || activity.type.replace(/_/g, ' ')}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {activity.actor && (
                        <span className="text-xs text-muted-foreground">{activity.actor}</span>
                      )}
                      <span className="text-xs text-muted-foreground/50">·</span>
                      <span className={`text-xs font-mono px-1 py-0.5 rounded text-[10px] ${activityColor(activity.type)} bg-current/10`}
                        style={{ backgroundColor: 'transparent' }}
                      >
                        <span className={activityColor(activity.type)}>
                          {activity.type.replace(/_/g, ' ')}
                        </span>
                      </span>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground/50 shrink-0 tabular-nums">
                    {relativeTime(activity.created_at)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Quick Actions */}
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h3 className="text-sm font-medium text-foreground">Quick Actions</h3>
          </div>
          <div className="p-4 flex flex-col gap-2">
            <QuickActionButton
              label="New Task"
              description="Create a task and assign to an agent"
              icon="◈"
              iconColor="text-sky-400"
              onClick={() => navigateToPanel('tasks')}
            />
            <QuickActionButton
              label="Spawn Agent"
              description="Register a new agent in the fleet"
              icon="◉"
              iconColor="text-violet-400"
              onClick={() => navigateToPanel('agents')}
            />
            <QuickActionButton
              label="View Logs"
              description="Browse system and agent logs"
              icon="≡"
              iconColor="text-emerald-400"
              onClick={() => navigateToPanel('logs')}
            />
            <QuickActionButton
              label="Open Chat"
              description="Talk to an agent or browse sessions"
              icon="◎"
              iconColor="text-cyan-400"
              onClick={() => navigateToPanel('chat')}
            />
            <QuickActionButton
              label="Activity Feed"
              description="Monitor all system events"
              icon="◆"
              iconColor="text-amber-400"
              onClick={() => navigateToPanel('activity')}
            />
            <QuickActionButton
              label="Cost Tracker"
              description="Token usage and spend analysis"
              icon="◇"
              iconColor="text-rose-400"
              onClick={() => navigateToPanel('cost-tracker')}
            />
          </div>

          {/* System snapshot */}
          {dashStats && (
            <div className="px-4 pb-4 pt-1 border-t border-border mt-1">
              <div className="text-2xs uppercase tracking-[0.12em] text-muted-foreground mb-2">System</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                {dashStats.memory?.total ? (
                  <SnapshotRow
                    label="Memory"
                    value={`${Math.round((dashStats.memory.used / dashStats.memory.total) * 100)}%`}
                  />
                ) : null}
                {dashStats.disk?.usage ? (
                  <SnapshotRow label="Disk" value={dashStats.disk.usage} />
                ) : null}
                {dbStats?.dbSizeBytes ? (
                  <SnapshotRow
                    label="DB Size"
                    value={
                      dbStats.dbSizeBytes > 1024 * 1024
                        ? `${(dbStats.dbSizeBytes / (1024 * 1024)).toFixed(1)} MB`
                        : `${Math.round(dbStats.dbSizeBytes / 1024)} KB`
                    }
                  />
                ) : null}
                {dbStats?.audit?.day != null ? (
                  <SnapshotRow label="Events/24h" value={String(dbStats.audit.day)} />
                ) : null}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function QuickActionButton({
  label,
  description,
  icon,
  iconColor,
  onClick,
}: {
  label: string
  description: string
  icon: string
  iconColor: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 w-full text-left px-3 py-2.5 rounded-lg border border-border hover:border-border/80 hover:bg-secondary/40 transition-all duration-150 group"
    >
      <span className={`text-base leading-none font-mono ${iconColor} shrink-0`}>{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-foreground group-hover:text-foreground/90">{label}</div>
        <div className="text-xs text-muted-foreground truncate">{description}</div>
      </div>
      <span className="text-muted-foreground/30 text-xs group-hover:text-muted-foreground/60 transition-colors">›</span>
    </button>
  )
}

function SnapshotRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs text-foreground tabular-nums">{value}</span>
    </div>
  )
}
