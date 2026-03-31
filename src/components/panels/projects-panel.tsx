'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { Button } from '@/components/ui/button'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('ProjectsPanel')

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  id: number
  name: string
  slug: string
  description?: string
  status: 'active' | 'paused' | 'archived' | 'planning'
  emoji?: string
  path?: string
  port?: number
  tags?: string[]
  cron?: string
  color?: string
  task_count: number
  inbox_count: number
  in_progress_count: number
  review_count: number
  done_count: number
  updated_at: number
  created_at: number
}

interface Note {
  id: number
  project_id: number
  text: string
  author: string
  created_at: number
}

interface ProjectFile {
  id: number
  project_id: number
  name: string
  path: string
  type: 'file' | 'url' | 'doc'
  added_at: number
}

interface Task {
  id: number
  title: string
  status: string
  priority: string
  assigned_to?: string
  tags?: string[]
  due_date?: number
  created_at: number
  ticket_ref?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  const diff = Date.now() / 1000 - ts
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return new Date(ts * 1000).toLocaleDateString()
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  active:   { label: 'Active',   color: 'text-emerald-400 bg-emerald-400/10 border-emerald-500/30', dot: 'bg-emerald-400' },
  paused:   { label: 'Paused',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-500/30',   dot: 'bg-yellow-400' },
  planning: { label: 'Planning', color: 'text-blue-400 bg-blue-400/10 border-blue-500/30',         dot: 'bg-blue-400' },
  archived: { label: 'Archived', color: 'text-zinc-400 bg-zinc-400/10 border-zinc-500/30',         dot: 'bg-zinc-400' },
}

const PRIORITY_COLOR: Record<string, string> = {
  urgent:   'bg-red-500/20 text-red-300 border border-red-500/30',
  high:     'bg-orange-500/20 text-orange-300 border border-orange-500/30',
  medium:   'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30',
  low:      'bg-zinc-500/20 text-zinc-300 border border-zinc-500/30',
  critical: 'bg-red-700/30 text-red-200 border border-red-700/40',
}

const FILE_TYPE_ICON: Record<string, string> = {
  file: '📄',
  url:  '🔗',
  doc:  '📝',
}

const COMMON_EMOJIS = ['📁','🚀','⚙️','🎯','💡','🔧','🌐','📊','🔬','🎨','🏗️','📱','🤖','🔐','📡']

// ── New Project Modal ─────────────────────────────────────────────────────────

function NewProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: '', emoji: '📁', description: '', status: 'active', path: '', port: '', tags: '', cron: ''
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          emoji: form.emoji,
          description: form.description.trim(),
          status: form.status,
          path: form.path.trim() || undefined,
          port: form.port ? Number(form.port) : undefined,
          tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
          cron: form.cron.trim() || undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to create'); return }
      onCreated()
    } catch (err) {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-100">New Project</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={submit} className="px-6 py-5 space-y-4">
          {/* Emoji + Name */}
          <div className="flex gap-3">
            <div className="relative">
              <button type="button" onClick={() => setShowEmoji(p => !p)}
                className="w-12 h-12 flex items-center justify-center text-2xl bg-zinc-800 border border-zinc-700 rounded-lg hover:border-zinc-500 transition-colors">
                {form.emoji}
              </button>
              {showEmoji && (
                <div className="absolute top-14 left-0 z-10 bg-zinc-800 border border-zinc-700 rounded-lg p-2 grid grid-cols-5 gap-1 shadow-xl">
                  {COMMON_EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => { set('emoji', e); setShowEmoji(false) }}
                      className="w-8 h-8 flex items-center justify-center text-lg hover:bg-zinc-700 rounded transition-colors">
                      {e}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1">
              <label className="block text-xs text-zinc-400 mb-1">Project Name *</label>
              <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="My Project"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500">
              {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Description</label>
            <textarea value={form.description} onChange={e => set('description', e.target.value)} rows={3} placeholder="What is this project about?"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none" />
          </div>

          {/* Path + Port */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Local Path</label>
              <input value={form.path} onChange={e => set('path', e.target.value)} placeholder="/home/user/project"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Port</label>
              <input value={form.port} onChange={e => set('port', e.target.value)} type="number" placeholder="3000"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Tags (comma-separated)</label>
            <input value={form.tags} onChange={e => set('tags', e.target.value)} placeholder="backend, api, v2"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
          </div>

          {/* Cron */}
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Cron Schedule</label>
            <input value={form.cron} onChange={e => set('cron', e.target.value)} placeholder="0 9 * * 1-5"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Creating…' : 'Create Project'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Project Card (Grid) ───────────────────────────────────────────────────────

function ProjectCard({ project, onClick }: { project: Project; onClick: () => void }) {
  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
  const total = project.task_count
  const done = project.done_count
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <button onClick={onClick} className="text-left bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 hover:bg-zinc-800/60 transition-all group flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-2xl shrink-0">{project.emoji || '📁'}</span>
          <span className="font-semibold text-zinc-100 truncate text-sm">{project.name}</span>
        </div>
        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>
          {sc.label}
        </span>
      </div>

      {/* Description */}
      {project.description && (
        <p className="text-xs text-zinc-400 line-clamp-2 leading-relaxed">{project.description}</p>
      )}

      {/* Progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>{done}/{total} tasks done</span>
          <span>{pct}%</span>
        </div>
        <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex gap-3 text-xs text-zinc-500">
          {project.inbox_count > 0 && <span className="text-zinc-400">{project.inbox_count} inbox</span>}
          {project.in_progress_count > 0 && <span className="text-blue-400">{project.in_progress_count} active</span>}
          {project.review_count > 0 && <span className="text-purple-400">{project.review_count} review</span>}
        </div>
      </div>

      {/* Tags */}
      {project.tags && project.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {project.tags.slice(0, 4).map(t => (
            <span key={t} className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">{t}</span>
          ))}
          {project.tags.length > 4 && <span className="text-xs text-zinc-500">+{project.tags.length - 4}</span>}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-zinc-500 mt-auto pt-1 border-t border-zinc-800">
        <span>{project.port ? <span className="text-zinc-400">:{project.port}</span> : null}</span>
        <span>{timeAgo(project.updated_at)}</span>
      </div>
    </button>
  )
}

// ── Project List Row ──────────────────────────────────────────────────────────

function ProjectRow({ project, onClick }: { project: Project; onClick: () => void }) {
  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active
  const total = project.task_count
  const done = project.done_count
  const pct = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <tr onClick={onClick} className="border-b border-zinc-800 hover:bg-zinc-800/40 cursor-pointer transition-colors">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">{project.emoji || '📁'}</span>
          <div>
            <div className="text-sm font-medium text-zinc-100">{project.name}</div>
            {project.description && <div className="text-xs text-zinc-500 truncate max-w-xs">{project.description}</div>}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>{sc.label}</span>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full w-20 overflow-hidden">
            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-zinc-400 w-16">{done}/{total}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {(project.tags || []).slice(0, 3).map(t => (
            <span key={t} className="text-xs px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">{t}</span>
          ))}
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">
        {project.port ? <span className="text-zinc-300">:{project.port}</span> : '—'}
      </td>
      <td className="px-4 py-3 text-xs text-zinc-500">{timeAgo(project.updated_at)}</td>
    </tr>
  )
}

// ── Detail: Tasks Tab ─────────────────────────────────────────────────────────

function TasksTab({ projectId }: { projectId: number }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`)
      if (res.ok) { const d = await res.json(); setTasks(d.tasks || []) }
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  if (loading) return <div className="py-8 text-center text-zinc-500 text-sm">Loading tasks…</div>
  if (!tasks.length) return <div className="py-8 text-center text-zinc-500 text-sm">No tasks for this project yet.</div>

  const statusColor: Record<string, string> = {
    inbox: 'bg-zinc-600/30 text-zinc-400',
    assigned: 'bg-blue-600/20 text-blue-400',
    in_progress: 'bg-blue-500/20 text-blue-300',
    review: 'bg-purple-500/20 text-purple-300',
    quality_review: 'bg-purple-600/20 text-purple-300',
    done: 'bg-emerald-500/20 text-emerald-400',
  }

  return (
    <div className="space-y-2">
      {tasks.map(task => (
        <div key={task.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              {task.ticket_ref && <span className="text-xs text-zinc-500 font-mono">{task.ticket_ref}</span>}
              <span className="text-sm text-zinc-100 truncate">{task.title}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs px-1.5 py-0.5 rounded ${statusColor[task.status] || 'bg-zinc-600/30 text-zinc-400'}`}>
                {task.status.replace('_', ' ')}
              </span>
              <span className={`text-xs px-1.5 py-0.5 rounded ${PRIORITY_COLOR[task.priority] || ''}`}>
                {task.priority}
              </span>
              {task.assigned_to && <span className="text-xs text-zinc-500">{task.assigned_to}</span>}
              {task.due_date && (
                <span className={`text-xs ${task.due_date * 1000 < Date.now() ? 'text-red-400' : 'text-zinc-500'}`}>
                  due {new Date(task.due_date * 1000).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
          <span className="text-xs text-zinc-500 shrink-0">{timeAgo(task.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Detail: Notes Tab ─────────────────────────────────────────────────────────

function NotesTab({ projectId }: { projectId: number }) {
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`)
      if (res.ok) { const d = await res.json(); setNotes(d.notes || []) }
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function addNote(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: text.trim() }),
      })
      if (res.ok) { setText(''); load() }
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={addNote} className="flex gap-2">
        <textarea value={text} onChange={e => setText(e.target.value)} rows={2} placeholder="Add a note…"
          className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-none" />
        <Button type="submit" size="sm" disabled={saving || !text.trim()} className="self-end">
          {saving ? '…' : 'Add'}
        </Button>
      </form>
      {loading ? (
        <div className="text-center text-zinc-500 text-sm py-4">Loading…</div>
      ) : notes.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-4">No notes yet.</div>
      ) : (
        <div className="space-y-3">
          {notes.map(note => (
            <div key={note.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-zinc-300">{note.author}</span>
                <span className="text-xs text-zinc-500">{timeAgo(note.created_at)}</span>
              </div>
              <p className="text-sm text-zinc-300 whitespace-pre-wrap">{note.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Detail: Files Tab ─────────────────────────────────────────────────────────

function FilesTab({ projectId }: { projectId: number }) {
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', path: '', type: 'file' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`)
      if (res.ok) { const d = await res.json(); setFiles(d.files || []) }
    } finally { setLoading(false) }
  }, [projectId])

  useEffect(() => { load() }, [load])

  async function addFile(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.path.trim()) return
    setSaving(true)
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) { setForm({ name: '', path: '', type: 'file' }); setShowForm(false); load() }
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" onClick={() => setShowForm(p => !p)}>
          {showForm ? 'Cancel' : '+ Add File'}
        </Button>
      </div>
      {showForm && (
        <form onSubmit={addFile} className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="README.md"
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 focus:outline-none focus:border-zinc-500">
                <option value="file">File</option>
                <option value="url">URL</option>
                <option value="doc">Doc</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Path / URL</label>
            <input value={form.path} onChange={e => setForm(f => ({ ...f, path: e.target.value }))} placeholder="/path/to/file or https://..."
              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>Add</Button>
          </div>
        </form>
      )}
      {loading ? (
        <div className="text-center text-zinc-500 text-sm py-4">Loading…</div>
      ) : files.length === 0 ? (
        <div className="text-center text-zinc-500 text-sm py-4">No files linked yet.</div>
      ) : (
        <div className="space-y-2">
          {files.map(f => (
            <div key={f.id} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3 flex items-center gap-3">
              <span className="text-lg shrink-0">{FILE_TYPE_ICON[f.type] || '📄'}</span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-zinc-200">{f.name}</div>
                <div className="text-xs text-zinc-500 truncate">{f.path}</div>
              </div>
              <span className="text-xs text-zinc-500 shrink-0">{timeAgo(f.added_at)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Detail: Memory Tab ────────────────────────────────────────────────────────

function MemoryTab({ project }: { project: Project }) {
  const [files, setFiles] = useState<Array<{ path: string; preview: string }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/memory?search=${encodeURIComponent(project.name)}&limit=10`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.files) setFiles(d.files) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [project.name])

  if (loading) return <div className="text-center text-zinc-500 text-sm py-4">Loading…</div>
  if (!files.length) return <div className="text-center text-zinc-500 text-sm py-4">No memory files linked to this project.</div>

  return (
    <div className="space-y-3">
      {files.map(f => (
        <div key={f.path} className="bg-zinc-800/50 border border-zinc-700/50 rounded-lg px-4 py-3">
          <div className="text-xs font-mono text-zinc-400 mb-1">{f.path}</div>
          <p className="text-sm text-zinc-300 line-clamp-3">{f.preview}</p>
        </div>
      ))}
    </div>
  )
}

// ── Project Detail Panel ──────────────────────────────────────────────────────

function ProjectDetail({ project, onClose, onUpdated }: { project: Project; onClose: () => void; onUpdated: () => void }) {
  const [tab, setTab] = useState<'tasks' | 'notes' | 'files' | 'memory'>('tasks')
  const [editing, setEditing] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const sc = STATUS_CONFIG[project.status] ?? STATUS_CONFIG.active

  async function archiveProject() {
    if (!confirm(`Archive "${project.name}"?`)) return
    setStatusUpdating(true)
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'archived' }),
      })
      onUpdated(); onClose()
    } finally { setStatusUpdating(false) }
  }

  const TABS = [
    { id: 'tasks', label: `Tasks (${project.task_count})` },
    { id: 'notes', label: 'Notes' },
    { id: 'files', label: 'Files' },
    { id: 'memory', label: 'Memory' },
  ] as const

  return (
    <div className="fixed inset-0 z-40 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/50" onClick={onClose} />
      {/* Drawer */}
      <div className="w-full max-w-2xl bg-zinc-950 border-l border-zinc-800 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-3xl">{project.emoji || '📁'}</span>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold text-zinc-100 truncate">{project.name}</h2>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${sc.color}`}>{sc.label}</span>
                {project.port && <span className="text-xs text-zinc-400">Port {project.port}</span>}
                {project.cron && <span className="text-xs text-zinc-400 font-mono">{project.cron}</span>}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={archiveProject} disabled={statusUpdating} className="text-zinc-500 hover:text-red-400">
              Archive
            </Button>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none ml-2">&times;</button>
          </div>
        </div>

        {/* Meta */}
        <div className="px-6 py-4 border-b border-zinc-800 shrink-0 space-y-2">
          {project.description && <p className="text-sm text-zinc-400 leading-relaxed">{project.description}</p>}
          <div className="flex flex-wrap gap-3 text-xs text-zinc-500">
            {project.path && <span>📂 <span className="text-zinc-300 font-mono">{project.path}</span></span>}
            {project.tags && project.tags.length > 0 && (
              <span className="flex gap-1">
                {project.tags.map(t => <span key={t} className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">{t}</span>)}
              </span>
            )}
          </div>
          {/* Progress summary */}
          <div className="flex items-center gap-4 text-xs text-zinc-500">
            <span className="text-zinc-400">{project.done_count}/{project.task_count} done</span>
            {project.in_progress_count > 0 && <span className="text-blue-400">{project.in_progress_count} active</span>}
            {project.review_count > 0 && <span className="text-purple-400">{project.review_count} review</span>}
            {project.inbox_count > 0 && <span>{project.inbox_count} inbox</span>}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-zinc-800 shrink-0">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-5 py-3 text-sm font-medium transition-colors ${tab === t.id ? 'text-zinc-100 border-b-2 border-zinc-300' : 'text-zinc-500 hover:text-zinc-300'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {tab === 'tasks'  && <TasksTab  projectId={project.id} />}
          {tab === 'notes'  && <NotesTab  projectId={project.id} />}
          {tab === 'files'  && <FilesTab  projectId={project.id} />}
          {tab === 'memory' && <MemoryTab project={project} />}
        </div>
      </div>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function ProjectsPanel() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'grid' | 'list'>('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [showNew, setShowNew] = useState(false)
  const [selected, setSelected] = useState<Project | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/projects?includeArchived=1')
      if (res.ok) {
        const d = await res.json()
        setProjects(d.projects || [])
      }
    } catch (err) {
      log.error('Failed to load projects', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useSmartPoll(load, 30_000, { pauseWhenSseConnected: true })

  // Collect all tags
  const allTags = Array.from(new Set(projects.flatMap(p => p.tags || []))).sort()

  const filtered = projects.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) &&
        !(p.description || '').toLowerCase().includes(search.toLowerCase())) return false
    if (statusFilter !== 'all' && p.status !== statusFilter) return false
    if (tagFilter !== 'all' && !(p.tags || []).includes(tagFilter)) return false
    return true
  })

  // Stats
  const activeCount  = projects.filter(p => p.status === 'active').length
  const totalTasks   = projects.reduce((sum, p) => sum + p.task_count, 0)
  const inProgress   = projects.reduce((sum, p) => sum + p.in_progress_count, 0)

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-zinc-800 shrink-0 flex-wrap gap-y-3">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-zinc-100">Projects</h1>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            <span><span className="text-emerald-400 font-medium">{activeCount}</span> active</span>
            <span><span className="text-zinc-300 font-medium">{totalTasks}</span> tasks</span>
            <span><span className="text-blue-400 font-medium">{inProgress}</span> in progress</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search projects…"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500 w-52" />

          {/* Status filter */}
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500">
            <option value="all">All statuses</option>
            {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{STATUS_CONFIG[s].label}</option>)}
          </select>

          {/* Tag filter */}
          {allTags.length > 0 && (
            <select value={tagFilter} onChange={e => setTagFilter(e.target.value)}
              className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500">
              <option value="all">All tags</option>
              {allTags.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          )}

          {/* View toggle */}
          <div className="flex rounded-lg border border-zinc-700 overflow-hidden">
            <button onClick={() => setView('grid')}
              className={`px-3 py-1.5 text-sm transition-colors ${view === 'grid' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
              ⊞ Grid
            </button>
            <button onClick={() => setView('list')}
              className={`px-3 py-1.5 text-sm transition-colors ${view === 'list' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}>
              ☰ List
            </button>
          </div>

          <Button size="sm" onClick={() => setShowNew(true)}>+ New Project</Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {loading ? (
          <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">Loading projects…</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-2">
            <div className="text-3xl">📁</div>
            <p className="text-zinc-500 text-sm">{projects.length === 0 ? 'No projects yet. Create your first one.' : 'No projects match your filters.'}</p>
            {projects.length === 0 && <Button size="sm" onClick={() => setShowNew(true)}>+ New Project</Button>}
          </div>
        ) : view === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(p => (
              <ProjectCard key={p.id} project={p} onClick={() => setSelected(p)} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-800 overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/50">
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Project</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Progress</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Tags</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Port</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-zinc-400">Updated</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(p => (
                  <ProjectRow key={p.id} project={p} onClick={() => setSelected(p)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNew && (
        <NewProjectModal onClose={() => setShowNew(false)} onCreated={() => { setShowNew(false); load() }} />
      )}

      {/* Detail Drawer */}
      {selected && (
        <ProjectDetail project={selected} onClose={() => setSelected(null)} onUpdated={load} />
      )}
    </div>
  )
}
