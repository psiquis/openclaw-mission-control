'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('SkillsMgmtPanel')

// ── Types ─────────────────────────────────────────────────────────────────────

interface SkillSummary {
  id: string
  name: string
  source: string
  path: string
  description?: string
  registry_slug?: string | null
  security_status?: string | null
}

interface FileNode {
  name: string
  path: string
  type: 'file' | 'dir'
  size?: number
  modified?: number
  ext?: string
  children?: FileNode[]
}

interface FileContent {
  source: string
  name: string
  file: string
  content: string
  size?: number
  modified?: number
  ext?: string
}

// ── Constants ─────────────────────────────────────────────────────────────────

const SOURCE_LABELS: Record<string, string> = {
  'user-agents':    '~/.agents/skills',
  'user-codex':     '~/.codex/skills',
  'project-agents': '.agents/skills (project)',
  'project-codex':  '.codex/skills (project)',
  'openclaw':       '~/.openclaw/skills',
  'workspace':      'workspace/skills',
}

function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] || (source.startsWith('workspace-') ? `${source.replace('workspace-', '')} workspace` : source)
}

// File icons by extension
const FILE_ICONS: Record<string, string> = {
  md:   '📄', txt: '📄', rst: '📝',
  py:   '🐍', js:  '🟨', ts:  '🔷', jsx: '⚛️', tsx: '⚛️',
  sh:   '⚙️', bash: '⚙️', zsh: '⚙️',
  json: '📋', yaml: '📋', yml: '📋', toml: '📋',
  env:  '🔐', gitignore: '🚫',
  html: '🌐', css: '🎨',
  go:   '🐹', rb:  '💎', rs:  '🦀',
  sql:  '🗄️', csv: '📊',
  png:  '🖼️', jpg: '🖼️', svg: '🖼️', gif: '🖼️',
  pdf:  '📕',
}

function fileIcon(node: FileNode): string {
  if (node.type === 'dir') return '📁'
  const ext = node.ext || ''
  const nameMap = node.name === 'SKILL.md' ? '📘' : (node.name.startsWith('.') ? '🔒' : undefined)
  return nameMap || FILE_ICONS[ext] || '📄'
}

function fmtSize(bytes?: number): string {
  if (bytes === undefined) return ''
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`
}

function fmtDate(ms?: number): string {
  if (!ms) return ''
  return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

// ── Syntax Highlighting ───────────────────────────────────────────────────────

type TokenType = 'keyword' | 'string' | 'comment' | 'number' | 'fn' | 'tag' | 'attr' | 'heading' | 'bold' | 'code' | 'plain'

interface Token { type: TokenType; value: string }

const KEYWORD_MAP: Record<string, string[]> = {
  py:   ['def','class','import','from','return','if','elif','else','for','while','in','not','and','or','True','False','None','with','as','try','except','finally','raise','pass','lambda','yield','async','await'],
  js:   ['const','let','var','function','return','if','else','for','while','class','import','export','default','from','new','this','typeof','instanceof','async','await','try','catch','throw','true','false','null','undefined','of','in'],
  ts:   ['const','let','var','function','return','if','else','for','while','class','import','export','default','from','new','this','typeof','instanceof','async','await','try','catch','throw','true','false','null','undefined','of','in','type','interface','enum','readonly','public','private','protected','abstract','extends','implements','declare','namespace'],
  sh:   ['if','then','else','fi','for','do','done','while','case','esac','function','return','echo','export','source','cd','mkdir','rm','cp','mv'],
  json: [],
}

function tokenizeLine(line: string, ext: string): Token[] {
  // Markdown
  if (ext === 'md' || ext === 'markdown') return tokenizeMd(line)
  // JSON
  if (ext === 'json') return tokenizeJson(line)
  // Generic code tokenizer
  return tokenizeCode(line, ext)
}

function tokenizeMd(line: string): Token[] {
  if (/^#{1,6}\s/.test(line)) return [{ type: 'heading', value: line }]
  if (/^\s*[-*+]\s/.test(line) || /^\s*\d+\.\s/.test(line)) {
    // list item — highlight inline code
    return splitInlineCode(line)
  }
  return splitInlineCode(line)
}

function splitInlineCode(line: string): Token[] {
  const parts: Token[] = []
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) parts.push({ type: 'plain', value: line.slice(last, m.index) })
    const v = m[0]
    parts.push({ type: v.startsWith('`') ? 'code' : 'bold', value: v })
    last = m.index + v.length
  }
  if (last < line.length) parts.push({ type: 'plain', value: line.slice(last) })
  return parts.length ? parts : [{ type: 'plain', value: line }]
}

function tokenizeJson(line: string): Token[] {
  const tokens: Token[] = []
  const re = /("(?:[^"\\]|\\.)*")|(\b\d+\.?\d*\b)|(true|false|null)|([:,\[\]{])/g
  let last = 0, m: RegExpExecArray | null
  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ type: 'plain', value: line.slice(last, m.index) })
    if (m[1]) tokens.push({ type: 'string', value: m[1] })
    else if (m[2]) tokens.push({ type: 'number', value: m[2] })
    else if (m[3]) tokens.push({ type: 'keyword', value: m[3] })
    else tokens.push({ type: 'plain', value: m[4] })
    last = m.index + m[0].length
  }
  if (last < line.length) tokens.push({ type: 'plain', value: line.slice(last) })
  return tokens.length ? tokens : [{ type: 'plain', value: line }]
}

function tokenizeCode(line: string, ext: string): Token[] {
  // Single-line comment
  const commentPrefixes = ['#', '//', '--']
  for (const pfx of commentPrefixes) {
    const idx = line.indexOf(pfx)
    if (idx !== -1) {
      // Make sure it's not inside a string (simplified)
      const pre = line.slice(0, idx)
      const quoteCount = (pre.match(/"/g) || []).length + (pre.match(/'/g) || []).length
      if (quoteCount % 2 === 0) {
        const before = tokenizeCode(pre, ext)
        return [...before, { type: 'comment', value: line.slice(idx) }]
      }
    }
  }

  const tokens: Token[] = []
  const keywords = KEYWORD_MAP[ext] || KEYWORD_MAP.js
  const keywordRe = keywords.length ? `\\b(${keywords.join('|')})\\b` : null
  const strRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/
  const numRe = /\b(\d+\.?\d*)\b/
  const fnRe  = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?=\()/

  const combinedParts = [
    keywordRe,
    strRe.source,
    numRe.source,
    fnRe.source,
  ].filter(Boolean).join('|')

  const re = new RegExp(combinedParts, 'g')
  let last = 0, m: RegExpExecArray | null

  while ((m = re.exec(line)) !== null) {
    if (m.index > last) tokens.push({ type: 'plain', value: line.slice(last, m.index) })
    const val = m[0]
    if (keywordRe && new RegExp(`^(${keywords.join('|')})$`).test(val)) {
      tokens.push({ type: 'keyword', value: val })
    } else if (/^["'`]/.test(val)) {
      tokens.push({ type: 'string', value: val })
    } else if (/^\d/.test(val)) {
      tokens.push({ type: 'number', value: val })
    } else {
      tokens.push({ type: 'fn', value: val })
    }
    last = m.index + val.length
  }
  if (last < line.length) tokens.push({ type: 'plain', value: line.slice(last) })
  return tokens.length ? tokens : [{ type: 'plain', value: line }]
}

const TOKEN_COLORS: Record<TokenType, string> = {
  keyword: 'text-purple-400',
  string:  'text-emerald-400',
  comment: 'text-zinc-500 italic',
  number:  'text-amber-400',
  fn:      'text-blue-400',
  tag:     'text-red-400',
  attr:    'text-yellow-300',
  heading: 'text-blue-300 font-bold',
  bold:    'text-zinc-200 font-semibold',
  code:    'text-amber-300 font-mono bg-zinc-800 rounded px-0.5',
  plain:   'text-zinc-300',
}

// ── Code Viewer with Line Numbers ─────────────────────────────────────────────

function CodeViewer({ content, ext, editMode, onChange }: {
  content: string
  ext?: string
  editMode: boolean
  onChange: (v: string) => void
}) {
  const lines  = content.split('\n')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const numbersRef  = useRef<HTMLDivElement>(null)

  // Sync scroll between line numbers and textarea
  function handleScroll(e: React.UIEvent<HTMLTextAreaElement>) {
    if (numbersRef.current) numbersRef.current.scrollTop = e.currentTarget.scrollTop
  }

  if (editMode) {
    return (
      <div className="flex flex-1 min-h-0 font-mono text-xs">
        {/* Line numbers */}
        <div
          ref={numbersRef}
          className="select-none bg-zinc-900 text-zinc-600 text-right pr-3 pl-2 border-r border-zinc-800 overflow-hidden shrink-0"
          style={{ minWidth: `${String(lines.length).length * 8 + 24}px` }}
          aria-hidden
        >
          {lines.map((_, i) => (
            <div key={i} className="leading-5">{i + 1}</div>
          ))}
        </div>
        {/* Editable textarea */}
        <textarea
          ref={textareaRef}
          value={content}
          onChange={e => onChange(e.target.value)}
          onScroll={handleScroll}
          spellCheck={false}
          className="flex-1 bg-zinc-950 text-zinc-200 px-3 py-0 resize-none focus:outline-none leading-5 font-mono text-xs"
          style={{ tabSize: 2 }}
        />
      </div>
    )
  }

  // Read-only view with syntax highlighting
  return (
    <div className="flex flex-1 min-h-0 font-mono text-xs overflow-auto">
      {/* Line numbers */}
      <div
        className="select-none bg-zinc-900 text-zinc-600 text-right pr-3 pl-2 border-r border-zinc-800 shrink-0"
        style={{ minWidth: `${String(lines.length).length * 8 + 24}px` }}
        aria-hidden
      >
        {lines.map((_, i) => (
          <div key={i} className="leading-5">{i + 1}</div>
        ))}
      </div>
      {/* Highlighted lines */}
      <div className="flex-1 px-3 overflow-auto">
        {lines.map((line, i) => {
          const tokens = tokenizeLine(line, ext || 'plain')
          return (
            <div key={i} className="leading-5 whitespace-pre">
              {tokens.map((tok, j) => (
                <span key={j} className={TOKEN_COLORS[tok.type]}>{tok.value}</span>
              ))}
              {/* Ensure empty lines still take up space */}
              {tokens.length === 0 && <span>&nbsp;</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── File Tree Node ─────────────────────────────────────────────────────────────

function TreeNode({
  node,
  depth,
  selectedFile,
  onSelect,
}: {
  node: FileNode
  depth: number
  selectedFile: string | null
  onSelect: (node: FileNode) => void
}) {
  const [open, setOpen] = useState(depth < 2)
  const isSelected = node.type === 'file' && selectedFile === node.path
  const indent = depth * 14

  if (node.type === 'dir') {
    return (
      <div>
        <button
          onClick={() => setOpen(p => !p)}
          className="w-full flex items-center gap-1.5 px-2 py-1 text-left hover:bg-zinc-800/50 rounded text-xs text-zinc-400 transition-colors"
          style={{ paddingLeft: `${8 + indent}px` }}
        >
          <span className={`text-[10px] transition-transform ${open ? 'rotate-90' : ''} text-zinc-600`}>›</span>
          <span>{open ? '📂' : '📁'}</span>
          <span className="text-zinc-300 font-medium">{node.name}</span>
          {node.children && (
            <span className="ml-auto text-zinc-600 text-[10px]">{node.children.filter(c => c.type === 'file').length}</span>
          )}
        </button>
        {open && node.children && (
          <div>
            {node.children.map(child => (
              <TreeNode key={child.path} node={child} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <button
      onClick={() => onSelect(node)}
      className={`w-full flex items-center gap-1.5 px-2 py-1 text-left rounded text-xs transition-colors
        ${isSelected ? 'bg-blue-500/20 text-blue-200' : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'}`}
      style={{ paddingLeft: `${8 + indent}px` }}
    >
      <span className="shrink-0">{fileIcon(node)}</span>
      <span className={`flex-1 truncate ${isSelected ? 'font-medium' : ''}`}>{node.name}</span>
      {node.size !== undefined && (
        <span className="text-zinc-600 text-[10px] shrink-0">{fmtSize(node.size)}</span>
      )}
    </button>
  )
}

// ── New Skill Modal ────────────────────────────────────────────────────────────

function NewSkillModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName]       = useState('')
  const [source, setSource]   = useState('openclaw')
  const [content, setContent] = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const defaultContent = useMemo(() => `# ${name || 'my-skill'}\n\nDescribe what this skill does and when to use it.\n\n## Usage\n\nInstructions for using this skill.\n`, [name])

  async function create(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Name is required'); return }
    if (!/^[a-zA-Z0-9._-]+$/.test(name.trim())) { setError('Name can only contain letters, numbers, dots, dashes, underscores'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), source, content: content || defaultContent }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed to create'); return }
      onCreated()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-lg mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-zinc-100">New Skill</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-200 text-xl leading-none">&times;</button>
        </div>
        <form onSubmit={create} className="px-5 py-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Skill Name *</label>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="my-skill"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 font-mono focus:outline-none focus:border-zinc-500" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Install Location</label>
              <select value={source} onChange={e => setSource(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none focus:border-zinc-500">
                {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Initial SKILL.md content</label>
            <textarea value={content || defaultContent} onChange={e => setContent(e.target.value)} rows={8}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-100 font-mono placeholder-zinc-500 focus:outline-none focus:border-zinc-500 resize-y" />
          </div>
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm" disabled={saving}>{saving ? 'Creating…' : 'Create Skill'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Skill List Pane ───────────────────────────────────────────────────────────

function SkillListPane({
  skills,
  selected,
  onSelect,
  onNew,
  loading,
}: {
  skills: SkillSummary[]
  selected: SkillSummary | null
  onSelect: (s: SkillSummary) => void
  onNew: () => void
  loading: boolean
}) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    if (!search.trim()) return skills
    const q = search.toLowerCase()
    return skills.filter(s => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q))
  }, [skills, search])

  // Group by source
  const grouped = useMemo(() => {
    const map = new Map<string, SkillSummary[]>()
    for (const s of filtered) {
      if (!map.has(s.source)) map.set(s.source, [])
      map.get(s.source)!.push(s)
    }
    return map
  }, [filtered])

  return (
    <div className="w-72 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Header */}
      <div className="px-3 py-3 border-b border-zinc-800 shrink-0">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-zinc-300">Skills</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-zinc-600">{skills.length}</span>
            <Button size="xs" variant="ghost" onClick={onNew} className="text-xs">+ New</Button>
          </div>
        </div>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search skills…"
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500"
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto py-1">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 text-xs">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-zinc-500 text-xs">
            {search ? 'No matches' : 'No skills installed'}
          </div>
        ) : (
          Array.from(grouped.entries()).map(([source, sourceSkills]) => (
            <div key={source} className="mb-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold text-zinc-600 uppercase tracking-wide">
                {sourceLabel(source)}
              </div>
              {sourceSkills.map(skill => (
                <button
                  key={skill.id}
                  onClick={() => onSelect(skill)}
                  className={`w-full text-left px-3 py-2.5 transition-colors
                    ${selected?.id === skill.id ? 'bg-blue-500/15 border-l-2 border-blue-400' : 'hover:bg-zinc-800/60 border-l-2 border-transparent'}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`text-xs font-medium truncate ${selected?.id === skill.id ? 'text-blue-200' : 'text-zinc-200'}`}>
                      {skill.name}
                    </span>
                    {skill.security_status && skill.security_status !== 'safe' && (
                      <span className="text-[10px] text-yellow-400 shrink-0">⚠</span>
                    )}
                  </div>
                  {skill.description && (
                    <p className="text-[10px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">{skill.description}</p>
                  )}
                </button>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// ── Skill Detail Pane ─────────────────────────────────────────────────────────

function SkillDetailPane({
  skill,
  onDeleted,
}: {
  skill: SkillSummary
  onDeleted: () => void
}) {
  const [tree, setTree]               = useState<FileNode[]>([])
  const [treeLoading, setTreeLoading] = useState(true)
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [fileContent, setFileContent] = useState<FileContent | null>(null)
  const [fileLoading, setFileLoading] = useState(false)
  const [editMode, setEditMode]       = useState(false)
  const [draft, setDraft]             = useState('')
  const [saving, setSaving]           = useState(false)
  const [saveMsg, setSaveMsg]         = useState<{ ok: boolean; text: string } | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [deleting, setDeleting]       = useState(false)

  // Load file tree whenever skill changes
  useEffect(() => {
    setTree([]); setTreeLoading(true); setSelectedFile(null); setFileContent(null); setEditMode(false)
    fetch(`/api/skills/files?source=${encodeURIComponent(skill.source)}&name=${encodeURIComponent(skill.name)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.tree) setTree(d.tree) })
      .catch(err => log.error('Failed to load tree', err))
      .finally(() => setTreeLoading(false))
  }, [skill.id])

  // Auto-open SKILL.md on first load
  useEffect(() => {
    if (!treeLoading && tree.length > 0 && !selectedFile) {
      const skillMd = tree.find(n => n.type === 'file' && n.name === 'SKILL.md')
      if (skillMd) openFile(skillMd)
    }
  }, [treeLoading])

  function openFile(node: FileNode) {
    if (node.type !== 'file') return
    setSelectedFile(node)
    setEditMode(false)
    setFileContent(null)
    setFileLoading(true)
    fetch(`/api/skills/file?source=${encodeURIComponent(skill.source)}&name=${encodeURIComponent(skill.name)}&file=${encodeURIComponent(node.path)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) { setFileContent(d); setDraft(d.content) } })
      .catch(err => log.error('Failed to load file', err))
      .finally(() => setFileLoading(false))
  }

  async function saveFile() {
    if (!fileContent || !selectedFile) return
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/skills/file', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: skill.source, name: skill.name, file: selectedFile.path, content: draft }),
      })
      if (res.ok) {
        setFileContent(c => c ? { ...c, content: draft } : c)
        setSaveMsg({ ok: true, text: 'Saved' })
        setEditMode(false)
      } else {
        const d = await res.json()
        setSaveMsg({ ok: false, text: d.error || 'Save failed' })
      }
    } finally {
      setSaving(false)
      setTimeout(() => setSaveMsg(null), 3000)
    }
  }

  async function deleteSkill() {
    setDeleting(true)
    try {
      const res = await fetch(`/api/skills?source=${encodeURIComponent(skill.source)}&name=${encodeURIComponent(skill.name)}`, { method: 'DELETE' })
      if (res.ok) onDeleted()
    } finally { setDeleting(false) }
  }

  const isDirty = editMode && fileContent && draft !== fileContent.content

  // Count total files
  function countNodes(nodes: FileNode[]): number {
    return nodes.reduce((n, node) => n + (node.type === 'file' ? 1 : countNodes(node.children || [])), 0)
  }

  return (
    <div className="flex flex-1 min-w-0 min-h-0">
      {/* ── File tree pane ─────────────────────────────────────────────── */}
      <div className="w-56 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-900/40">
        {/* Skill header */}
        <div className="px-3 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-zinc-100 truncate">{skill.name}</div>
              <div className="text-[10px] text-zinc-500 mt-0.5">{sourceLabel(skill.source)}</div>
            </div>
            {/* Delete */}
            {deleteConfirm ? (
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={deleteSkill} disabled={deleting}
                  className="text-[10px] text-red-400 hover:text-red-300 font-medium px-1">
                  {deleting ? '…' : '✓'}
                </button>
                <button onClick={() => setDeleteConfirm(false)}
                  className="text-[10px] text-zinc-500 hover:text-zinc-300 px-1">✗</button>
              </div>
            ) : (
              <button onClick={() => setDeleteConfirm(true)} title="Delete skill"
                className="text-zinc-600 hover:text-red-400 transition-colors shrink-0 text-xs">
                🗑
              </button>
            )}
          </div>
          {!treeLoading && (
            <div className="text-[10px] text-zinc-600 mt-1">{countNodes(tree)} files</div>
          )}
        </div>

        {/* Tree */}
        <div className="flex-1 overflow-y-auto py-1">
          {treeLoading ? (
            <div className="text-center py-8 text-xs text-zinc-600">Loading…</div>
          ) : tree.length === 0 ? (
            <div className="text-center py-8 text-xs text-zinc-600">No files</div>
          ) : (
            tree.map(node => (
              <TreeNode key={node.path} node={node} depth={0} selectedFile={selectedFile?.path || null} onSelect={openFile} />
            ))
          )}
        </div>
      </div>

      {/* ── File viewer/editor pane ─────────────────────────────────────── */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {!selectedFile ? (
          <div className="flex flex-1 items-center justify-center text-zinc-600 text-sm">
            Select a file to view
          </div>
        ) : (
          <>
            {/* File toolbar */}
            <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-zinc-800 shrink-0 bg-zinc-900/50">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{fileIcon(selectedFile)}</span>
                <span className="text-xs font-mono text-zinc-300 truncate">{selectedFile.path}</span>
                {fileContent && (
                  <span className="text-[10px] text-zinc-600 shrink-0">{fmtSize(fileContent.size)}</span>
                )}
                {fileContent?.modified && (
                  <span className="text-[10px] text-zinc-600 shrink-0">{fmtDate(fileContent.modified)}</span>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {saveMsg && (
                  <span className={`text-xs ${saveMsg.ok ? 'text-emerald-400' : 'text-red-400'}`}>{saveMsg.text}</span>
                )}
                {editMode ? (
                  <>
                    <Button variant="ghost" size="xs" onClick={() => { setEditMode(false); setDraft(fileContent?.content || '') }}>
                      Cancel
                    </Button>
                    <Button size="xs" onClick={saveFile} disabled={saving || !isDirty} variant={isDirty ? 'default' : 'ghost'}>
                      {saving ? 'Saving…' : 'Save'}
                    </Button>
                  </>
                ) : (
                  <Button size="xs" variant="outline" onClick={() => setEditMode(true)} disabled={fileLoading}>
                    ✏ Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Content area */}
            <div className="flex flex-1 min-h-0 overflow-hidden bg-zinc-950">
              {fileLoading ? (
                <div className="flex flex-1 items-center justify-center text-zinc-500 text-sm">Loading…</div>
              ) : fileContent ? (
                <CodeViewer
                  content={editMode ? draft : fileContent.content}
                  ext={fileContent.ext}
                  editMode={editMode}
                  onChange={setDraft}
                />
              ) : (
                <div className="flex flex-1 items-center justify-center text-zinc-500 text-sm">
                  Failed to load file
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyDetailPane({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-zinc-600">
      <div className="text-5xl">🧰</div>
      <p className="text-sm">Select a skill to explore its files</p>
      <Button size="sm" variant="outline" onClick={onNew}>+ New Skill</Button>
    </div>
  )
}

// ── Main Panel ────────────────────────────────────────────────────────────────

export function SkillsMgmtPanel() {
  const [skills, setSkills]     = useState<SkillSummary[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<SkillSummary | null>(null)
  const [showNew, setShowNew]   = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/skills')
      if (res.ok) {
        const d = await res.json()
        setSkills(d.skills || [])
      }
    } catch (err) {
      log.error('Failed to load skills', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])
  useSmartPoll(load, 60_000)

  // After deletion, clear selection if it was the deleted skill
  function handleDeleted() {
    const name   = selected?.name
    const source = selected?.source
    setSelected(null)
    setSkills(prev => prev.filter(s => !(s.name === name && s.source === source)))
  }

  function handleCreated() {
    setShowNew(false)
    load()
  }

  return (
    <div className="flex h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Left pane: skill list */}
      <SkillListPane
        skills={skills}
        selected={selected}
        onSelect={setSelected}
        onNew={() => setShowNew(true)}
        loading={loading}
      />

      {/* Right pane: detail */}
      <div className="flex flex-1 flex-col min-w-0 min-h-0">
        {selected ? (
          <SkillDetailPane
            key={selected.id}
            skill={selected}
            onDeleted={handleDeleted}
          />
        ) : (
          <EmptyDetailPane onNew={() => setShowNew(true)} />
        )}
      </div>

      {showNew && (
        <NewSkillModal onClose={() => setShowNew(false)} onCreated={handleCreated} />
      )}
    </div>
  )
}
