'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useMissionControl } from '@/store'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { useFocusTrap } from '@/lib/use-focus-trap'
import { AgentAvatar } from '@/components/ui/agent-avatar'
import { Button } from '@/components/ui/button'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('KanbanTaskBoard')

// ── Types ─────────────────────────────────────────────────────────────────────

interface Task {
  id: number
  title: string
  description?: string
  status: 'inbox' | 'assigned' | 'in_progress' | 'review' | 'done' | 'awaiting_owner' | 'quality_review'
  priority: 'low' | 'medium' | 'high' | 'urgent' | 'critical'
  assigned_to?: string
  created_by: string
  created_at: number
  updated_at: number
  due_date?: number
  estimated_hours?: number
  actual_hours?: number
  tags?: string[]
  metadata?: any
  project_id?: number
  project_name?: string
  ticket_ref?: string
}

interface Agent {
  id: number
  name: string
  role: string
  status: 'offline' | 'idle' | 'busy' | 'error'
}

interface Project {
  id: number
  name: string
  slug: string
  ticket_prefix: string
  status: 'active' | 'archived'
}

interface Comment {
  id: number
  task_id: number
  author: string
  content: string
  created_at: number
  parent_id?: number
  replies?: Comment[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const COLUMNS: Array<{ key: string; label: string; headerCls: string; emptyLabel: string }> = [
  { key: 'inbox',       label: 'Inbox',       headerCls: 'bg-zinc-500/10 text-zinc-300',        emptyLabel: 'No new tasks' },
  { key: 'assigned',    label: 'Assigned',    headerCls: 'bg-blue-500/10 text-blue-300',         emptyLabel: 'Nothing assigned' },
  { key: 'in_progress', label: 'In Progress', headerCls: 'bg-amber-500/10 text-amber-300',       emptyLabel: 'Nothing in progress' },
  { key: 'review',      label: 'Review',      headerCls: 'bg-purple-500/10 text-purple-300',     emptyLabel: 'Nothing in review' },
  { key: 'done',        label: 'Done',        headerCls: 'bg-emerald-500/10 text-emerald-300',   emptyLabel: 'No completed tasks' },
]

const PRIORITY: Record<string, { label: string; bg: string; text: string; borderLeft: string }> = {
  urgent:   { label: 'Urgent',   bg: 'bg-red-500/20',    text: 'text-red-400',    borderLeft: 'border-l-red-500' },
  critical: { label: 'Critical', bg: 'bg-red-500/20',    text: 'text-red-400',    borderLeft: 'border-l-red-500' },
  high:     { label: 'High',     bg: 'bg-orange-500/20', text: 'text-orange-400', borderLeft: 'border-l-orange-500' },
  medium:   { label: 'Medium',   bg: 'bg-yellow-500/20', text: 'text-yellow-400', borderLeft: 'border-l-yellow-500' },
  low:      { label: 'Low',      bg: 'bg-zinc-500/20',   text: 'text-zinc-400',   borderLeft: 'border-l-zinc-500' },
}

const PRIORITY_ORDER: Record<string, number> = { urgent: 0, critical: 1, high: 2, medium: 3, low: 4 }

// ── Helpers ───────────────────────────────────────────────────────────────────

function relTime(ts: number): string {
  const diff = Date.now() - ts * 1000
  if (diff < 60_000) return 'just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  return `${Math.floor(diff / 86400_000)}d ago`
}

function fmtDate(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function isOverdue(ts: number): boolean {
  return ts * 1000 < Date.now()
}

function startOfWeek(): number {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return Math.floor(d.getTime() / 1000)
}

const TAG_COLORS = [
  'bg-sky-500/15 text-sky-300 border-sky-500/20',
  'bg-violet-500/15 text-violet-300 border-violet-500/20',
  'bg-emerald-500/15 text-emerald-300 border-emerald-500/20',
  'bg-amber-500/15 text-amber-300 border-amber-500/20',
  'bg-rose-500/15 text-rose-300 border-rose-500/20',
  'bg-cyan-500/15 text-cyan-300 border-cyan-500/20',
]

function tagColor(tag: string): string {
  let h = 0
  for (const c of tag) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TAG_COLORS[h % TAG_COLORS.length]
}

// ── Main Component ────────────────────────────────────────────────────────────

export function KanbanTaskBoard() {
  const { tasks: storeTasks, setTasks: storeSetTasks, activeProject } = useMissionControl()

  const [agents, setAgents] = useState<Agent[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterPriority, setFilterPriority] = useState('all')
  const [filterAgent, setFilterAgent] = useState('all')
  const [filterTag, setFilterTag] = useState('')
  const [filterProject, setFilterProject] = useState(activeProject ? String(activeProject.id) : 'all')
  const [sortBy, setSortBy] = useState<'priority' | 'created' | 'due_date'>('priority')

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [selectMode, setSelectMode] = useState(false)

  // UI
  const [showNewTask, setShowNewTask] = useState(false)
  const [detailTask, setDetailTask] = useState<Task | null>(null)
  const [doneCollapsed, setDoneCollapsed] = useState(false)
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const dragCounter = useRef(0)

  // Tasks cast from store
  const tasks = storeTasks as unknown as Task[]

  const fetchData = useCallback(async () => {
    try {
      setError(null)
      const params = new URLSearchParams()
      if (filterProject !== 'all') params.set('project_id', filterProject)
      params.set('limit', '200')

      const [tRes, aRes, pRes] = await Promise.all([
        fetch(`/api/tasks?${params}`),
        fetch('/api/agents'),
        fetch('/api/projects'),
      ])

      if (!tRes.ok) throw new Error('Failed to fetch tasks')
      const [tData, aData, pData] = await Promise.all([tRes.json(), aRes.json(), pRes.json()])

      storeSetTasks(tData.tasks ?? [])
      setAgents(aData.agents ?? [])
      setProjects(pData.projects ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [filterProject, storeSetTasks])

  useEffect(() => { fetchData() }, [fetchData])
  useSmartPoll(fetchData, 30_000, { pauseWhenSseConnected: true })

  // Sync activeProject filter
  useEffect(() => {
    setFilterProject(activeProject ? String(activeProject.id) : 'all')
  }, [activeProject])

  // Filtered & sorted tasks
  const filteredTasks = tasks
    .filter((t) => {
      if (filterPriority !== 'all' && t.priority !== filterPriority) return false
      if (filterAgent !== 'all' && t.assigned_to !== filterAgent) return false
      if (filterTag && !t.tags?.some(tag => tag.toLowerCase().includes(filterTag.toLowerCase()))) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'priority') return (PRIORITY_ORDER[a.priority] ?? 99) - (PRIORITY_ORDER[b.priority] ?? 99)
      if (sortBy === 'due_date') return (a.due_date ?? Infinity) - (b.due_date ?? Infinity)
      return b.created_at - a.created_at
    })

  // Stats
  const weekStart = startOfWeek()
  const completedThisWeek = tasks.filter(t => t.status === 'done' && t.updated_at >= weekStart).length
  const inProgressCount = tasks.filter(t => t.status === 'in_progress').length

  // Group by column (include awaiting_owner + quality_review inside their parents for display)
  const tasksByColumn: Record<string, Task[]> = {}
  for (const col of COLUMNS) {
    if (col.key === 'in_progress') {
      tasksByColumn[col.key] = filteredTasks.filter(t => t.status === 'in_progress' || t.status === 'awaiting_owner')
    } else if (col.key === 'review') {
      tasksByColumn[col.key] = filteredTasks.filter(t => t.status === 'review' || t.status === 'quality_review')
    } else {
      tasksByColumn[col.key] = filteredTasks.filter(t => t.status === col.key)
    }
  }

  // Drag handlers
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragEnter = (e: React.DragEvent, colKey: string) => {
    e.preventDefault()
    dragCounter.current++
    if (draggedTask && draggedTask.status !== colKey) {
      e.currentTarget.classList.add('drag-over')
    }
  }
  const handleDragLeave = (e: React.DragEvent) => {
    dragCounter.current--
    if (dragCounter.current === 0) e.currentTarget.classList.remove('drag-over')
  }
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }
  const handleDrop = async (e: React.DragEvent, targetStatus: string) => {
    e.preventDefault()
    dragCounter.current = 0
    e.currentTarget.classList.remove('drag-over')
    if (!draggedTask || draggedTask.status === targetStatus) { setDraggedTask(null); return }

    const newStatus = targetStatus as Task['status']
    storeSetTasks(tasks.map(t => t.id === draggedTask.id ? { ...t, status: newStatus } : t) as any)

    try {
      await fetch(`/api/tasks/${draggedTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
    } catch {
      fetchData()
    }
    setDraggedTask(null)
  }

  // Card selection
  const toggleSelect = (id: number, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // Bulk actions
  const bulkUpdateStatus = async (status: string) => {
    for (const id of selectedIds) {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      }).catch(() => {})
    }
    setSelectedIds(new Set())
    setSelectMode(false)
    fetchData()
  }

  const bulkUpdatePriority = async (priority: string) => {
    for (const id of selectedIds) {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      }).catch(() => {})
    }
    setSelectedIds(new Set())
    setSelectMode(false)
    fetchData()
  }

  const bulkAssign = async (agent: string) => {
    for (const id of selectedIds) {
      await fetch(`/api/tasks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assigned_to: agent }),
      }).catch(() => {})
    }
    setSelectedIds(new Set())
    setSelectMode(false)
    fetchData()
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col p-4 gap-3">
        <div className="flex gap-3 mb-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-16 flex-1 rounded-xl bg-surface-1 animate-pulse" />
          ))}
        </div>
        <div className="flex gap-3 flex-1">
          {COLUMNS.map(col => (
            <div key={col.key} className="flex-1 min-w-60 rounded-xl bg-surface-1 animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats bar */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border/50 bg-card/50 px-5 py-3">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">This Week:</span>
          <span className="font-semibold text-emerald-400">{completedThisWeek} completed</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">In Progress:</span>
          <span className="font-semibold text-amber-400">{inProgressCount}</span>
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-1.5 text-sm">
          <span className="text-muted-foreground">Total:</span>
          <span className="font-semibold text-foreground">{tasks.length}</span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          {selectMode ? (
            <Button variant="ghost" size="sm" onClick={() => { setSelectMode(false); setSelectedIds(new Set()) }}>
              Cancel
            </Button>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => setSelectMode(true)}>
              Select
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" onClick={fetchData} title="Refresh">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M13.5 8a5.5 5.5 0 11-1.5-3.8" /><path d="M12 1v4h-4" />
            </svg>
          </Button>
        </div>
      </div>

      {/* Filter + action bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 bg-card/30 px-5 py-2.5">
        {/* Project */}
        <FilterSelect
          value={filterProject}
          onChange={setFilterProject}
          options={[{ value: 'all', label: 'All Projects' }, ...projects.map(p => ({ value: String(p.id), label: p.name }))]}
        />
        {/* Priority */}
        <FilterSelect
          value={filterPriority}
          onChange={setFilterPriority}
          options={[
            { value: 'all', label: 'All Priorities' },
            { value: 'urgent', label: 'Urgent' },
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
          ]}
        />
        {/* Agent */}
        <FilterSelect
          value={filterAgent}
          onChange={setFilterAgent}
          options={[{ value: 'all', label: 'All Agents' }, ...agents.map(a => ({ value: a.name, label: a.name }))]}
        />
        {/* Tag search */}
        <input
          value={filterTag}
          onChange={e => setFilterTag(e.target.value)}
          placeholder="Filter by tag..."
          className="h-8 w-36 rounded-md border border-border/60 bg-surface-1 px-2.5 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/40"
        />
        {/* Sort */}
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-muted-foreground">Sort:</span>
          <FilterSelect
            value={sortBy}
            onChange={v => setSortBy(v as any)}
            options={[
              { value: 'priority', label: 'Priority' },
              { value: 'created', label: 'Date Created' },
              { value: 'due_date', label: 'Due Date' },
            ]}
          />
        </div>
        <Button onClick={() => setShowNewTask(true)} size="sm">
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="mr-1.5">
            <path d="M8 2v12M2 8h12" />
          </svg>
          New Task
        </Button>
      </div>

      {/* Bulk actions bar */}
      {selectMode && selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          agents={agents}
          onAssign={bulkAssign}
          onPriority={bulkUpdatePriority}
          onMove={bulkUpdateStatus}
          onClear={() => { setSelectedIds(new Set()); setSelectMode(false) }}
        />
      )}

      {/* Error */}
      {error && (
        <div className="mx-4 mt-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="ml-auto hover:text-red-300">×</button>
        </div>
      )}

      {/* Board */}
      <div className="flex flex-1 min-h-0 gap-3 overflow-x-auto p-4" role="region" aria-label="Task board">
        {COLUMNS.map(col => {
          const colTasks = tasksByColumn[col.key] ?? []
          const isDone = col.key === 'done'
          const displayed = isDone && doneCollapsed ? [] : isDone ? colTasks.slice(0, 10) : colTasks

          return (
            <div
              key={col.key}
              className="flex min-w-[260px] flex-1 flex-col rounded-xl border border-border/60 bg-surface-0 transition-colors duration-150 [&.drag-over]:border-primary/50 [&.drag-over]:bg-primary/[0.03]"
              onDragEnter={e => handleDragEnter(e, col.key)}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={e => handleDrop(e, col.key)}
            >
              {/* Column header */}
              <div className={`flex shrink-0 items-center justify-between rounded-t-xl border-b border-border/30 px-3 py-2.5 ${col.headerCls}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">{col.label}</span>
                  {isDone && (
                    <button onClick={() => setDoneCollapsed(v => !v)} className="text-xs opacity-60 hover:opacity-100 transition-opacity">
                      {doneCollapsed ? '▶' : '▼'}
                    </button>
                  )}
                </div>
                <span className="min-w-[1.5rem] rounded-md bg-white/10 px-1.5 py-0.5 text-center text-xs font-mono">
                  {colTasks.length}
                </span>
              </div>

              {/* Cards */}
              <div className="flex-1 min-h-24 space-y-2 overflow-y-auto p-2.5">
                {isDone && doneCollapsed ? (
                  <p className="py-6 text-center text-xs text-muted-foreground/40">Collapsed · {colTasks.length} tasks</p>
                ) : (
                  <>
                    {displayed.map(task => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        selectMode={selectMode}
                        selected={selectedIds.has(task.id)}
                        dragging={draggedTask?.id === task.id}
                        onSelect={toggleSelect}
                        onClick={() => setDetailTask(task)}
                        onDragStart={handleDragStart}
                      />
                    ))}
                    {displayed.length === 0 && (
                      <div className="flex flex-col items-center justify-center py-10 text-muted-foreground/25">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" className="mb-2">
                          <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 12h6M12 9v6" />
                        </svg>
                        <span className="text-xs">{col.emptyLabel}</span>
                      </div>
                    )}
                    {isDone && !doneCollapsed && colTasks.length > 10 && (
                      <p className="pb-1 text-center text-xs text-muted-foreground/40">
                        Showing 10 of {colTasks.length} — older tasks hidden
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* New task modal */}
      {showNewTask && (
        <NewTaskModal
          agents={agents}
          projects={projects}
          onClose={() => setShowNewTask(false)}
          onCreated={() => { setShowNewTask(false); fetchData() }}
        />
      )}

      {/* Task detail modal */}
      {detailTask && (
        <TaskDetailModal
          task={detailTask}
          agents={agents}
          projects={projects}
          onClose={() => setDetailTask(null)}
          onUpdated={(updated) => {
            storeSetTasks(tasks.map(t => t.id === updated.id ? updated : t) as any)
            setDetailTask(updated)
            fetchData()
          }}
          onDeleted={() => { setDetailTask(null); fetchData() }}
        />
      )}
    </div>
  )
}

// ── FilterSelect ──────────────────────────────────────────────────────────────

function FilterSelect({ value, onChange, options }: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="h-8 appearance-none rounded-md border border-border/60 bg-surface-1 pl-2.5 pr-7 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <svg className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 6l4 4 4-4" />
      </svg>
    </div>
  )
}

// ── TaskCard ──────────────────────────────────────────────────────────────────

function TaskCard({ task, selectMode, selected, dragging, onSelect, onClick, onDragStart }: {
  task: Task
  selectMode: boolean
  selected: boolean
  dragging: boolean
  onSelect: (id: number, e: React.MouseEvent) => void
  onClick: () => void
  onDragStart: (e: React.DragEvent, task: Task) => void
}) {
  const p = PRIORITY[task.priority] ?? PRIORITY.medium
  const overdue = task.due_date && isOverdue(task.due_date)

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, task)}
      onClick={onClick}
      className={[
        'group relative cursor-pointer rounded-lg border border-border/40 bg-card px-3 py-2.5 shadow-sm',
        'border-l-4 transition-all duration-150',
        p.borderLeft,
        'hover:border-border/70 hover:shadow-md hover:shadow-black/10 hover:-translate-y-px',
        dragging ? 'opacity-40 rotate-1 scale-[0.97]' : '',
        selected ? 'ring-1 ring-primary/50 border-primary/30' : '',
      ].join(' ')}
    >
      {/* Selection checkbox */}
      {(selectMode || selected) && (
        <div
          onClick={e => onSelect(task.id, e)}
          className="absolute -left-1 -top-1 z-10 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full border border-border bg-card shadow-sm"
        >
          {selected ? (
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary">
              <path d="M3 8l4 4 6-6" />
            </svg>
          ) : (
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/20" />
          )}
        </div>
      )}

      {/* Drag handle */}
      <div className="absolute right-2 top-2.5 opacity-0 group-hover:opacity-30 transition-opacity cursor-grab">
        <svg width="10" height="14" viewBox="0 0 10 16" fill="currentColor">
          {[0, 5].map(x => [3, 7, 11].map(y => (
            <circle key={`${x}-${y}`} cx={x + 2} cy={y} r="1.4" />
          )))}
        </svg>
      </div>

      {/* Title + ticket ref */}
      <div className="flex items-start gap-1.5 pr-4">
        {task.ticket_ref && (
          <span className="shrink-0 rounded bg-primary/10 px-1 py-0.5 text-[9px] font-mono text-primary/70">
            {task.ticket_ref}
          </span>
        )}
        <h4 className="line-clamp-2 text-sm font-medium leading-snug text-foreground">{task.title}</h4>
      </div>

      {/* Priority + meta */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.bg} ${p.text}`}>
          {p.label}
        </span>
        {task.due_date && (
          <span className={`flex items-center gap-0.5 text-[10px] ${overdue ? 'font-medium text-red-400' : 'text-muted-foreground/60'}`}>
            {overdue && <span className="text-red-400">!</span>}
            {fmtDate(task.due_date)}
          </span>
        )}
        <span className="ml-auto text-[10px] text-muted-foreground/40 tabular-nums">{relTime(task.created_at)}</span>
      </div>

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map(tag => (
            <span key={tag} className={`rounded-full border px-1.5 py-px text-[10px] font-medium ${tagColor(tag)}`}>{tag}</span>
          ))}
          {task.tags.length > 3 && <span className="text-[10px] text-muted-foreground/40">+{task.tags.length - 3}</span>}
        </div>
      )}

      {/* Agent */}
      {task.assigned_to && (
        <div className="mt-2 flex items-center gap-1.5 border-t border-border/20 pt-2">
          <AgentAvatar name={task.assigned_to} size="xs" />
          <span className="truncate text-[11px] text-muted-foreground">{task.assigned_to}</span>
        </div>
      )}
    </div>
  )
}

// ── BulkActionsBar ────────────────────────────────────────────────────────────

function BulkActionsBar({ count, agents, onAssign, onPriority, onMove, onClear }: {
  count: number
  agents: Agent[]
  onAssign: (agent: string) => void
  onPriority: (priority: string) => void
  onMove: (status: string) => void
  onClear: () => void
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-primary/20 bg-primary/5 px-5 py-2">
      <span className="text-sm font-medium text-primary">{count} selected</span>
      <div className="h-4 w-px bg-border" />
      <FilterSelect value="" onChange={onMove} options={[
        { value: '', label: 'Move to...' },
        ...COLUMNS.map(c => ({ value: c.key, label: c.label })),
      ]} />
      <FilterSelect value="" onChange={onPriority} options={[
        { value: '', label: 'Set priority...' },
        { value: 'urgent', label: 'Urgent' },
        { value: 'high', label: 'High' },
        { value: 'medium', label: 'Medium' },
        { value: 'low', label: 'Low' },
      ]} />
      <FilterSelect value="" onChange={onAssign} options={[
        { value: '', label: 'Assign to...' },
        ...agents.map(a => ({ value: a.name, label: a.name })),
      ]} />
      <Button variant="ghost" size="sm" onClick={onClear} className="ml-auto text-muted-foreground">
        Clear
      </Button>
    </div>
  )
}

// ── NewTaskModal ──────────────────────────────────────────────────────────────

function NewTaskModal({ agents, projects, onClose, onCreated }: {
  agents: Agent[]
  projects: Project[]
  onClose: () => void
  onCreated: () => void
}) {
  const modalRef = useFocusTrap(onClose)
  const [form, setForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    project_id: projects[0]?.id ? String(projects[0].id) : '',
    tags: '',
    due_date: '',
    estimated_hours: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setErr('Title is required')
    setSaving(true)
    setErr(null)
    try {
      const body: Record<string, any> = {
        title: form.title.trim(),
        description: form.description || undefined,
        priority: form.priority,
        status: 'inbox',
      }
      if (form.assigned_to) body.assigned_to = form.assigned_to
      if (form.project_id) body.project_id = Number(form.project_id)
      if (form.tags) body.tags = form.tags.split(',').map(t => t.trim()).filter(Boolean)
      if (form.due_date) body.due_date = Math.floor(new Date(form.due_date).getTime() / 1000)
      if (form.estimated_hours) body.estimated_hours = Number(form.estimated_hours)

      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to create task')
      onCreated()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <div ref={modalRef} className="w-full max-w-lg rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-base font-semibold text-foreground">New Task</h2>
          <button onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="max-h-[80vh] overflow-y-auto px-5 py-4 space-y-4">
          {/* Title */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Title *</label>
            <input value={form.title} onChange={set('title')} placeholder="Task title..." autoFocus
              className="input-field w-full" />
          </div>

          {/* Description */}
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Description (markdown)</label>
            <textarea value={form.description} onChange={set('description')} rows={4} placeholder="Describe the task..."
              className="input-field w-full resize-none" />
          </div>

          {/* Priority + Agent row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Priority</label>
              <select value={form.priority} onChange={set('priority')} className="input-field w-full">
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Assign to Agent</label>
              <select value={form.assigned_to} onChange={set('assigned_to')} className="input-field w-full">
                <option value="">Unassigned</option>
                {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
              </select>
            </div>
          </div>

          {/* Project + Tags row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Project</label>
              <select value={form.project_id} onChange={set('project_id')} className="input-field w-full">
                <option value="">No project</option>
                {projects.filter(p => p.status === 'active').map(p => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
              <input value={form.tags} onChange={set('tags')} placeholder="e.g. bug, frontend"
                className="input-field w-full" />
            </div>
          </div>

          {/* Due date + hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Due Date</label>
              <input type="date" value={form.due_date} onChange={set('due_date')} className="input-field w-full" />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Estimated Hours</label>
              <input type="number" min="0" step="0.5" value={form.estimated_hours} onChange={set('estimated_hours')}
                placeholder="e.g. 4" className="input-field w-full" />
            </div>
          </div>

          {err && <p className="text-xs text-red-400">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? 'Creating...' : 'Create Task'}
            </Button>
          </div>
        </form>
      </div>
    </ModalOverlay>
  )
}

// ── TaskDetailModal ───────────────────────────────────────────────────────────

function TaskDetailModal({ task, agents, projects, onClose, onUpdated, onDeleted }: {
  task: Task
  agents: Agent[]
  projects: Project[]
  onClose: () => void
  onUpdated: (task: Task) => void
  onDeleted: () => void
}) {
  const modalRef = useFocusTrap(onClose)
  const [tab, setTab] = useState<'details' | 'comments' | 'time'>('details')
  const [comments, setComments] = useState<Comment[]>([])
  const [loadingComments, setLoadingComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const { currentUser } = useMissionControl()

  const [editForm, setEditForm] = useState({
    title: task.title,
    description: task.description ?? '',
    priority: task.priority,
    assigned_to: task.assigned_to ?? '',
    status: task.status,
    due_date: task.due_date ? new Date(task.due_date * 1000).toISOString().split('T')[0] : '',
    estimated_hours: task.estimated_hours ? String(task.estimated_hours) : '',
    actual_hours: task.actual_hours ? String(task.actual_hours) : '',
    tags: (task.tags ?? []).join(', '),
  })

  const setField = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setEditForm(prev => ({ ...prev, [k]: e.target.value }))

  const loadComments = useCallback(async () => {
    setLoadingComments(true)
    try {
      const res = await fetch(`/api/tasks/${task.id}/comments`)
      if (res.ok) {
        const d = await res.json()
        setComments(d.comments ?? [])
      }
    } finally {
      setLoadingComments(false)
    }
  }, [task.id])

  useEffect(() => { loadComments() }, [loadComments])
  useSmartPoll(loadComments, 15_000, { enabled: tab === 'comments' })

  const handleSave = async () => {
    setSaving(true)
    setErr(null)
    try {
      const body: Record<string, any> = {
        title: editForm.title,
        description: editForm.description || undefined,
        priority: editForm.priority,
        assigned_to: editForm.assigned_to || null,
        status: editForm.status,
        tags: editForm.tags ? editForm.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
      }
      if (editForm.due_date) body.due_date = Math.floor(new Date(editForm.due_date).getTime() / 1000)
      if (editForm.estimated_hours) body.estimated_hours = Number(editForm.estimated_hours)
      if (editForm.actual_hours) body.actual_hours = Number(editForm.actual_hours)

      const res = await fetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.error || 'Failed to update task')
      onUpdated({ ...task, ...body, ...data.task })
      setEditing(false)
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this task? This cannot be undone.')) return
    setDeleting(true)
    try {
      await fetch(`/api/tasks/${task.id}`, { method: 'DELETE' })
      onDeleted()
    } finally {
      setDeleting(false)
    }
  }

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!commentText.trim()) return
    const author = currentUser?.username || 'system'
    await fetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author, content: commentText }),
    })
    setCommentText('')
    loadComments()
  }

  const p = PRIORITY[task.priority] ?? PRIORITY.medium

  return (
    <ModalOverlay onClose={onClose}>
      <div ref={modalRef} className="flex h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`flex shrink-0 items-start gap-3 border-b border-l-4 ${p.borderLeft} border-border px-5 py-4`}>
          <div className="flex-1 min-w-0">
            {task.ticket_ref && (
              <span className="mb-1 inline-block rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary/70">{task.ticket_ref}</span>
            )}
            <h2 className="text-base font-semibold text-foreground leading-snug">{task.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.bg} ${p.text}`}>{p.label}</span>
              <span className="capitalize">{task.status.replace('_', ' ')}</span>
              {task.assigned_to && (
                <span className="flex items-center gap-1">
                  <AgentAvatar name={task.assigned_to} size="xs" />
                  {task.assigned_to}
                </span>
              )}
              <span className="ml-auto">{relTime(task.created_at)}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon-xs" onClick={() => setEditing(v => !v)} title="Edit">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M11.5 2.5l2 2-8 8H3.5v-2l8-8z" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={handleDelete} disabled={deleting} title="Delete" className="text-red-400/70 hover:text-red-400">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 4h10M6 4V3h4v1M5 4v9h6V4" />
              </svg>
            </Button>
            <Button variant="ghost" size="icon-xs" onClick={onClose}>
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l8 8M12 4l-8 8" /></svg>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex shrink-0 border-b border-border bg-surface-0">
          {(['details', 'comments', 'time'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2.5 text-xs font-medium capitalize transition-colors border-b-2 ${tab === t ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {t === 'time' ? 'Time Tracking' : t}
              {t === 'comments' && comments.length > 0 && (
                <span className="ml-1.5 rounded-full bg-primary/20 px-1.5 text-[10px]">{comments.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {tab === 'details' && (
            editing ? (
              <div className="space-y-4">
                <div>
                  <label className="form-label">Title *</label>
                  <input value={editForm.title} onChange={setField('title')} className="input-field w-full" />
                </div>
                <div>
                  <label className="form-label">Description</label>
                  <textarea value={editForm.description} onChange={setField('description')} rows={5} className="input-field w-full resize-none" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Status</label>
                    <select value={editForm.status} onChange={setField('status')} className="input-field w-full">
                      {COLUMNS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Priority</label>
                    <select value={editForm.priority} onChange={setField('priority')} className="input-field w-full">
                      {Object.entries(PRIORITY).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="form-label">Assign to Agent</label>
                    <select value={editForm.assigned_to} onChange={setField('assigned_to')} className="input-field w-full">
                      <option value="">Unassigned</option>
                      {agents.map(a => <option key={a.id} value={a.name}>{a.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Due Date</label>
                    <input type="date" value={editForm.due_date} onChange={setField('due_date')} className="input-field w-full" />
                  </div>
                </div>
                <div>
                  <label className="form-label">Tags (comma-separated)</label>
                  <input value={editForm.tags} onChange={setField('tags')} placeholder="bug, frontend, api" className="input-field w-full" />
                </div>
                {err && <p className="text-xs text-red-400">{err}</p>}
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {task.description ? (
                  <div className="rounded-lg border border-border/50 bg-surface-1/30 p-3 text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                    {task.description}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No description.</p>
                )}
                <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  <DetailRow label="Status" value={<span className="capitalize">{task.status.replace('_', ' ')}</span>} />
                  <DetailRow label="Priority" value={<span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.bg} ${p.text}`}>{p.label}</span>} />
                  <DetailRow label="Assigned to" value={task.assigned_to ? (
                    <span className="flex items-center gap-1.5"><AgentAvatar name={task.assigned_to} size="xs" />{task.assigned_to}</span>
                  ) : <span className="text-muted-foreground/50 italic">Unassigned</span>} />
                  {task.due_date && (
                    <DetailRow label="Due" value={
                      <span className={isOverdue(task.due_date) ? 'text-red-400 font-medium' : 'text-foreground'}>
                        {fmtDate(task.due_date)}{isOverdue(task.due_date) && ' · Overdue'}
                      </span>
                    } />
                  )}
                  {task.tags && task.tags.length > 0 && (
                    <div className="col-span-2">
                      <p className="mb-1 text-xs text-muted-foreground">Tags</p>
                      <div className="flex flex-wrap gap-1">
                        {task.tags.map(tag => (
                          <span key={tag} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tagColor(tag)}`}>{tag}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )
          )}

          {tab === 'comments' && (
            <div className="space-y-4">
              {loadingComments && <p className="text-xs text-muted-foreground">Loading comments...</p>}
              {comments.map(c => (
                <div key={c.id} className="flex gap-2.5">
                  <AgentAvatar name={c.author} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium text-foreground">{c.author}</span>
                      <span className="text-[10px] text-muted-foreground/50">{relTime(c.created_at)}</span>
                    </div>
                    <div className="rounded-lg border border-border/50 bg-surface-1/30 px-3 py-2 text-xs text-foreground leading-relaxed whitespace-pre-wrap break-words">
                      {c.content}
                    </div>
                    {c.replies && c.replies.map(r => (
                      <div key={r.id} className="ml-6 mt-2 flex gap-2">
                        <AgentAvatar name={r.author} size="xs" />
                        <div>
                          <p className="text-[10px] font-medium text-foreground">{r.author} · {relTime(r.created_at)}</p>
                          <p className="mt-0.5 text-xs text-foreground/80 whitespace-pre-wrap">{r.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {comments.length === 0 && !loadingComments && (
                <p className="text-center text-xs text-muted-foreground/50 py-6">No comments yet.</p>
              )}
              <form onSubmit={handleAddComment} className="flex gap-2 border-t border-border/50 pt-3">
                <textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add a comment..."
                  rows={2}
                  className="input-field flex-1 resize-none text-xs"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(e as any) } }}
                />
                <Button type="submit" size="sm" disabled={!commentText.trim()} className="self-end">Post</Button>
              </form>
            </div>
          )}

          {tab === 'time' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-xl border border-border bg-surface-1/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Estimated</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {task.estimated_hours ?? '—'}
                    {task.estimated_hours && <span className="ml-1 text-sm text-muted-foreground">hrs</span>}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-surface-1/30 p-4 text-center">
                  <p className="text-xs text-muted-foreground mb-1">Actual</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {task.actual_hours ?? '—'}
                    {task.actual_hours && <span className="ml-1 text-sm text-muted-foreground">hrs</span>}
                  </p>
                </div>
              </div>
              {task.estimated_hours && task.actual_hours && (
                <div className="rounded-lg border border-border bg-surface-1/20 p-3 text-sm">
                  <div className="flex justify-between mb-1.5">
                    <span className="text-muted-foreground text-xs">Progress</span>
                    <span className="text-xs font-medium">{Math.round((task.actual_hours / task.estimated_hours) * 100)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className={`h-full rounded-full transition-all ${task.actual_hours > task.estimated_hours ? 'bg-red-500' : 'bg-primary'}`}
                      style={{ width: `${Math.min((task.actual_hours / task.estimated_hours) * 100, 100)}%` }}
                    />
                  </div>
                  {task.actual_hours > task.estimated_hours && (
                    <p className="mt-1.5 text-xs text-red-400">
                      {(task.actual_hours - task.estimated_hours).toFixed(1)}h over estimate
                    </p>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Update Estimated Hours</label>
                  <input type="number" min="0" step="0.5" defaultValue={task.estimated_hours}
                    onBlur={async (e) => {
                      const v = Number(e.target.value)
                      if (!Number.isFinite(v)) return
                      await fetch(`/api/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ estimated_hours: v }) })
                    }}
                    className="input-field w-full" />
                </div>
                <div>
                  <label className="form-label">Log Actual Hours</label>
                  <input type="number" min="0" step="0.5" defaultValue={task.actual_hours}
                    onBlur={async (e) => {
                      const v = Number(e.target.value)
                      if (!Number.isFinite(v)) return
                      await fetch(`/api/tasks/${task.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ actual_hours: v }) })
                    }}
                    className="input-field w-full" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-3">
                <DetailRow label="Created" value={fmtDate(task.created_at)} />
                <DetailRow label="Updated" value={relTime(task.updated_at)} />
              </div>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  )
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function ModalOverlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {children}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}
