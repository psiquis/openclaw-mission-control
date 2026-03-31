'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useMissionControl, type ChatAttachment } from '@/store'
import { useWebSocket } from '@/lib/websocket'
import { useSmartPoll } from '@/lib/use-smart-poll'
import { Button } from '@/components/ui/button'
import { MessageList } from '@/components/chat/message-list'
import { SessionMessage, shouldShowTimestamp, type SessionTranscriptMessage } from '@/components/chat/session-message'
import { SessionKindPill } from '@/components/chat/session-kind-brand'
import { createClientLogger } from '@/lib/client-logger'

const log = createClientLogger('FullChatPanel')

// ── Types ─────────────────────────────────────────────────────────────────────

type FilterKind = 'all' | 'chat' | 'discord' | 'telegram' | 'cron'

interface SessionItem {
  id: string
  key?: string
  agent?: string
  kind: string
  source?: string
  active: boolean
  lastActivity: number
  lastUserPrompt?: string | null
  model?: string
  tokens?: string
  age?: string
  workingDir?: string | null
}

interface OpenTab {
  id: string
  label: string
  kind: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(ts: number): string {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000) - Math.floor(ts / 1000)
  if (diff <= 0) return 'now'
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function sessionLabel(s: SessionItem): string {
  if (s.agent && s.agent !== 'local') return s.agent
  if (s.key && s.key !== s.id) return s.key
  return s.id.slice(0, 14)
}

function matchesFilter(s: SessionItem, filter: FilterKind): boolean {
  if (filter === 'all') return true
  if (filter === 'chat') return ['claude-code', 'codex-cli', 'gateway', 'unknown'].includes(s.kind)
  if (filter === 'discord') return s.kind === 'discord' || s.key?.includes('discord') === true
  if (filter === 'telegram') return s.kind === 'telegram' || s.key?.includes('telegram') === true
  if (filter === 'cron') return s.kind === 'hermes' || s.key?.includes('cron') === true
  return true
}

const KIND_DOT: Record<string, string> = {
  'claude-code': 'bg-primary',
  'codex-cli': 'bg-amber-400',
  hermes: 'bg-cyan-400',
  gateway: 'bg-zinc-400',
  discord: 'bg-indigo-400',
  telegram: 'bg-sky-400',
}

function kindDotColor(kind: string) {
  return KIND_DOT[kind] ?? 'bg-zinc-500'
}

const QUICK_ACTIONS: Array<{ label: string; prefix: string; color: string }> = [
  { label: 'Strategize', prefix: 'Help me strategize: ', color: 'text-violet-400 hover:bg-violet-500/10 border-violet-500/20' },
  { label: 'Code', prefix: 'Write code to ', color: 'text-sky-400 hover:bg-sky-500/10 border-sky-500/20' },
  { label: 'Research', prefix: 'Research and summarize: ', color: 'text-emerald-400 hover:bg-emerald-500/10 border-emerald-500/20' },
  { label: 'Automate', prefix: 'Automate the following task: ', color: 'text-amber-400 hover:bg-amber-500/10 border-amber-500/20' },
  { label: 'Review', prefix: 'Review and provide feedback on: ', color: 'text-rose-400 hover:bg-rose-500/10 border-rose-500/20' },
]

// ── Main Component ────────────────────────────────────────────────────────────

export function FullChatPanel() {
  const {
    activeConversation,
    setActiveConversation,
    chatMessages,
    setChatMessages,
    addChatMessage,
    replacePendingMessage,
    updatePendingMessage,
    agents,
    setAgents,
    conversations,
    setConversations,
    chatInput,
    setChatInput,
    connection,
    notifications,
  } = useMissionControl()

  const { sendMessage: wsSend, reconnect } = useWebSocket()

  // Panel state
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [filter, setFilter] = useState<FilterKind>('all')
  const [search, setSearch] = useState('')
  const [sessions, setSessions] = useState<SessionItem[]>([])
  const [openTabs, setOpenTabs] = useState<OpenTab[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [sessionTranscript, setSessionTranscript] = useState<SessionTranscriptMessage[]>([])
  const [transcriptLoading, setTranscriptLoading] = useState(false)
  const [transcriptError, setTranscriptError] = useState<string | null>(null)
  const [sessionReloadNonce, setSessionReloadNonce] = useState(0)
  const [inputValue, setInputValue] = useState('')
  const [slashResult, setSlashResult] = useState<string | null>(null)

  const pendingIdRef = useRef(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const tabsScrollRef = useRef<HTMLDivElement>(null)

  // Derived
  const selectedConversation = conversations.find((c) => c.id === activeConversation)
  const selectedSession = selectedConversation?.session
  const isSessionView = selectedConversation?.source === 'session' && !!selectedSession
  const isGatewaySession = selectedSession?.sessionKind === 'gateway'
  const canSendMessage = !!activeConversation && !activeConversation.startsWith('session:')

  // Load agents
  useEffect(() => {
    fetch('/api/agents').then(async (r) => {
      if (!r.ok) return
      const d = await r.json()
      if (d.agents) setAgents(d.agents)
    }).catch(() => {})
  }, [setAgents])

  // Load sessions list
  const loadSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/sessions')
      if (!res.ok) return
      const data = await res.json()
      const raw: SessionItem[] = (data.sessions ?? data ?? []).map((s: any) => ({
        id: String(s.id ?? ''),
        key: s.key ?? undefined,
        agent: s.agent ?? undefined,
        kind: String(s.kind ?? 'unknown'),
        source: s.source ?? undefined,
        active: Boolean(s.active),
        lastActivity: Number(s.lastActivity ?? s.startTime ?? 0),
        lastUserPrompt: typeof s.lastUserPrompt === 'string' ? s.lastUserPrompt : null,
        model: s.model ?? undefined,
        tokens: s.tokens ?? undefined,
        age: s.age ?? undefined,
        workingDir: typeof s.workingDir === 'string' ? s.workingDir : null,
      }))
      raw.sort((a, b) => b.lastActivity - a.lastActivity)
      setSessions(raw)

      // Build conversations list from sessions for the store
      setConversations(raw.map((s) => ({
        id: `session:${s.kind}:${s.id}`,
        name: sessionLabel(s),
        source: 'session' as const,
        participants: [s.agent ?? 'unknown'],
        unreadCount: 0,
        updatedAt: s.lastActivity,
        session: {
          prefKey: s.key ?? s.id,
          sessionId: s.id,
          sessionKey: s.key,
          sessionKind: s.kind as any,
          agent: s.agent,
          model: s.model,
          tokens: s.tokens,
          workingDir: s.workingDir,
          lastUserPrompt: s.lastUserPrompt,
          active: s.active,
          age: s.age,
        },
      })))
    } catch (err) {
      log.error('Failed to load sessions', err)
    }
  }, [setConversations])

  useSmartPoll(loadSessions, 30_000, { pauseWhenConnected: true })

  // Load messages when conversation changes
  const loadMessages = useCallback(async () => {
    if (!activeConversation || activeConversation.startsWith('session:')) {
      setChatMessages([])
      return
    }
    try {
      const res = await fetch(`/api/chat/messages?conversation_id=${encodeURIComponent(activeConversation)}&limit=100`)
      if (!res.ok) return
      const data = await res.json()
      if (data.messages) setChatMessages(data.messages)
    } catch (err) {
      log.error('Failed to load messages', err)
    }
  }, [activeConversation, setChatMessages])

  useEffect(() => {
    loadMessages()
  }, [loadMessages])

  // Load session transcript when session view active
  useEffect(() => {
    if (!selectedSession) {
      setSessionTranscript([])
      setTranscriptError(null)
      return
    }
    let cancelled = false
    setTranscriptLoading(true)
    setTranscriptError(null)

    const url = selectedSession.sessionKind === 'gateway'
      ? `/api/sessions/transcript/gateway?key=${encodeURIComponent(selectedSession.sessionKey || selectedSession.sessionId)}&limit=50`
      : `/api/sessions/transcript?kind=${encodeURIComponent(selectedSession.sessionKind)}&id=${encodeURIComponent(selectedSession.sessionId)}&limit=40`

    fetch(url)
      .then((r) => r.ok ? r.json() : r.json().then((d) => Promise.reject(new Error(d?.error || 'Failed'))))
      .then((data) => { if (!cancelled) setSessionTranscript(Array.isArray(data?.messages) ? data.messages : []) })
      .catch((err) => { if (!cancelled) { setSessionTranscript([]); setTranscriptError(err.message) } })
      .finally(() => { if (!cancelled) setTranscriptLoading(false) })

    return () => { cancelled = true }
  }, [selectedSession, sessionReloadNonce])

  // Open a session in a tab
  const openSession = useCallback((s: SessionItem) => {
    const convId = `session:${s.kind}:${s.id}`
    const label = sessionLabel(s)

    setOpenTabs((prev) => {
      if (prev.some((t) => t.id === convId)) return prev
      const next = [...prev, { id: convId, label, kind: s.kind }]
      return next.slice(-6) // max 6 tabs
    })
    setActiveConversation(convId)
  }, [setActiveConversation])

  const closeTab = useCallback((tabId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setOpenTabs((prev) => {
      const idx = prev.findIndex((t) => t.id === tabId)
      const next = prev.filter((t) => t.id !== tabId)
      // If closing the active tab, switch to adjacent
      if (activeConversation === tabId) {
        const newActive = next[idx - 1]?.id ?? next[0]?.id ?? null
        setActiveConversation(newActive)
      }
      return next
    })
  }, [activeConversation, setActiveConversation])

  // Send message
  const handleSend = useCallback(async (content: string) => {
    if (!content.trim() || !activeConversation) return

    // Handle slash commands
    if (content.startsWith('/')) {
      const [cmd, ...args] = content.slice(1).split(' ')
      const arg = args.join(' ').trim()

      if (cmd === 'refresh') {
        setSlashResult('Refreshing sessions...')
        await loadSessions()
        setSlashResult('Sessions refreshed.')
        setTimeout(() => setSlashResult(null), 3000)
        return
      }

      if (cmd === 'search' && arg) {
        setSearch(arg)
        setSlashResult(`Filtering sessions by "${arg}"`)
        setTimeout(() => setSlashResult(null), 3000)
        return
      }

      if (cmd === 'switch' && arg) {
        const match = sessions.find((s) =>
          sessionLabel(s).toLowerCase().includes(arg.toLowerCase()) ||
          (s.agent ?? '').toLowerCase().includes(arg.toLowerCase())
        )
        if (match) {
          openSession(match)
          setSlashResult(`Switched to ${sessionLabel(match)}`)
        } else {
          setSlashResult(`No session found matching "${arg}"`)
        }
        setTimeout(() => setSlashResult(null), 3000)
        return
      }
    }

    // Optimistic send
    pendingIdRef.current -= 1
    const tempId = pendingIdRef.current
    addChatMessage({
      id: tempId,
      conversation_id: activeConversation,
      from_agent: 'human',
      to_agent: null,
      content,
      message_type: 'text',
      created_at: Math.floor(Date.now() / 1000),
      pendingStatus: 'sending',
    })
    setIsGenerating(true)

    // Try WebSocket first for session conversations
    const sessionKey = selectedSession?.sessionKey ?? selectedSession?.sessionId
    if (sessionKey && isGatewaySession) {
      const sent = wsSend({
        type: 'req',
        method: 'chat.send',
        id: `mc-chat-${Date.now()}`,
        params: { sessionKey, message: content },
      })
      if (sent) {
        updatePendingMessage(tempId, { pendingStatus: 'sent' })
        setIsGenerating(false)
        return
      }
    }

    // Fallback to REST API
    try {
      const agentName = activeConversation.startsWith('agent_')
        ? activeConversation.replace('agent_', '')
        : selectedSession?.agent ?? null

      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'human',
          to: agentName,
          content,
          conversation_id: activeConversation,
          message_type: 'text',
          forward: true,
          sessionKey: sessionKey ?? undefined,
        }),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.message) replacePendingMessage(tempId, data.message)
      } else {
        updatePendingMessage(tempId, { pendingStatus: 'failed' })
      }
    } catch {
      updatePendingMessage(tempId, { pendingStatus: 'failed' })
    } finally {
      setIsGenerating(false)
    }
  }, [activeConversation, selectedSession, isGatewaySession, wsSend, addChatMessage, replacePendingMessage, updatePendingMessage, sessions, openSession, loadSessions])

  const handleAbort = useCallback(() => {
    try {
      const ws = (window as any).__mcWebSocket as WebSocket | undefined
      if (ws?.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'req', method: 'chat.cancel', id: `cancel-${Date.now()}`, params: { sessionId: activeConversation } }))
      }
    } catch { /* ignore */ }
    setIsGenerating(false)
  }, [activeConversation])

  // Filter + search sessions
  const filteredSessions = sessions.filter((s) => {
    if (!matchesFilter(s, filter)) return false
    if (!search) return true
    const q = search.toLowerCase()
    return (
      s.id.toLowerCase().includes(q) ||
      (s.agent ?? '').toLowerCase().includes(q) ||
      (s.key ?? '').toLowerCase().includes(q) ||
      (s.lastUserPrompt ?? '').toLowerCase().includes(q)
    )
  })

  const wsConnected = connection.isConnected

  return (
    <div className="flex h-full flex-col bg-card overflow-hidden">
      {/* WebSocket connection banner */}
      {!wsConnected && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/20 bg-amber-500/5 px-4 py-1.5 flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
            Gateway not connected — real-time updates paused
          </div>
          <Button variant="ghost" size="xs" onClick={reconnect} className="text-amber-400 hover:text-amber-300 h-6 text-xs px-2">
            Reconnect
          </Button>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar ─────────────────────────────────────────────────────── */}
        {sidebarOpen && (
          <aside className="flex w-[280px] flex-shrink-0 flex-col border-r border-border bg-card/50">
            {/* Sidebar header */}
            <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
              <div className="relative flex-1">
                <svg className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="7" cy="7" r="4.5" /><path d="M11 11l2.5 2.5" />
                </svg>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search sessions..."
                  className="h-7 w-full rounded-md border border-border/60 bg-surface-1 pl-7 pr-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30"
                />
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="shrink-0 rounded p-1 text-muted-foreground/40 hover:bg-secondary hover:text-muted-foreground"
                title="Collapse sidebar"
              >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M10 12L6 8l4-4" />
                </svg>
              </button>
            </div>

            {/* Filter tabs */}
            <div className="flex shrink-0 items-center gap-px overflow-x-auto border-b border-border px-2 py-1.5 no-scrollbar">
              {(['all', 'chat', 'discord', 'telegram', 'cron'] as FilterKind[]).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={[
                    'shrink-0 rounded px-2.5 py-1 text-[11px] font-medium capitalize transition-colors',
                    filter === f
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
                  ].join(' ')}
                >
                  {f}
                </button>
              ))}
            </div>

            {/* Session list */}
            <div className="flex-1 overflow-y-auto">
              {filteredSessions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <span className="text-2xl mb-2 opacity-30">◎</span>
                  <p className="text-xs text-muted-foreground">
                    {search ? `No sessions matching "${search}"` : `No ${filter === 'all' ? '' : filter + ' '}sessions`}
                  </p>
                </div>
              ) : (
                filteredSessions.map((s) => {
                  const convId = `session:${s.kind}:${s.id}`
                  const isActive = activeConversation === convId
                  return (
                    <SidebarItem
                      key={convId}
                      session={s}
                      isActive={isActive}
                      onSelect={() => openSession(s)}
                    />
                  )
                })
              )}
            </div>

            {/* Sidebar footer: total count */}
            <div className="border-t border-border/50 px-3 py-1.5 text-[10px] text-muted-foreground/50">
              {sessions.filter(s => s.active).length} active · {sessions.length} total
            </div>
          </aside>
        )}

        {/* ── Main chat area ──────────────────────────────────────────────── */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* Toolbar row: sidebar toggle + tab bar */}
          <div className="flex items-center gap-0 border-b border-border bg-card/80 backdrop-blur-sm flex-shrink-0">
            {/* Sidebar toggle (when collapsed) */}
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center shrink-0 border-r border-border text-muted-foreground/50 hover:bg-secondary hover:text-foreground transition-colors"
                title="Show sessions"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M6 4l4 4-4 4" />
                </svg>
              </button>
            )}

            {/* Conversation tabs */}
            <div ref={tabsScrollRef} className="flex flex-1 items-end overflow-x-auto no-scrollbar">
              {openTabs.length === 0 ? (
                <div className="flex items-center gap-2 px-4 py-2">
                  <span className="text-xs text-muted-foreground/40 italic">No open conversations — select a session</span>
                </div>
              ) : (
                openTabs.map((tab) => {
                  const isActive = activeConversation === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveConversation(tab.id)}
                      className={[
                        'group relative flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-xs transition-colors min-w-0 max-w-[160px]',
                        isActive
                          ? 'border-primary text-foreground bg-primary/5'
                          : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/30',
                      ].join(' ')}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${kindDotColor(tab.kind)}`} />
                      <span className="truncate font-medium">{tab.label}</span>
                      <SessionKindPill kind={tab.kind} />
                      <span
                        onClick={(e) => closeTab(tab.id, e)}
                        className="ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground/0 group-hover:text-muted-foreground/60 hover:!text-foreground hover:bg-secondary transition-colors"
                        role="button"
                        aria-label="Close tab"
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M4 4l8 8M12 4l-8 8" />
                        </svg>
                      </span>
                    </button>
                  )
                })
              )}
            </div>

            {/* Header actions */}
            <div className="flex shrink-0 items-center gap-1 px-2">
              {activeConversation && isSessionView && (
                <button
                  onClick={() => setSessionReloadNonce((v) => v + 1)}
                  className="rounded p-1.5 text-muted-foreground/50 hover:bg-secondary hover:text-foreground transition-colors"
                  title="Refresh transcript"
                >
                  <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M13.5 8a5.5 5.5 0 11-1.5-3.8" /><path d="M12 1v4h-4" />
                  </svg>
                </button>
              )}
              <div className="flex items-center gap-1.5 pl-1 border-l border-border/50 ml-1">
                <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-500'}`} />
                <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">
                  {wsConnected ? (connection.latency != null ? `${connection.latency}ms` : 'live') : 'offline'}
                </span>
              </div>
            </div>
          </div>

          {/* Message area */}
          {!activeConversation ? (
            <EmptyState onSelectSession={() => setSidebarOpen(true)} />
          ) : isSessionView && selectedSession ? (
            <SessionView
              session={selectedSession}
              messages={sessionTranscript}
              loading={transcriptLoading}
              error={transcriptError}
              inputValue={inputValue}
              setInputValue={setInputValue}
              onSend={handleSend}
              isGenerating={isGenerating}
              slashResult={slashResult}
            />
          ) : (
            <>
              {/* Agent chat header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-border/50 bg-surface-1/50 px-4 py-2">
                <AgentAvatar name={(selectedConversation?.name ?? activeConversation).replace('agent_', '')} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">
                    {(selectedConversation?.name ?? activeConversation).replace('agent_', '')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {agents.find(a => a.name === activeConversation.replace('agent_', ''))?.status ?? 'unknown'}
                  </p>
                </div>
              </div>

              <MessageList />

              {/* Inline chat toasts */}
              <ChatToasts notifications={notifications} />

              {/* Quick action chips */}
              <QuickActionChips
                onSelect={(prefix) => {
                  setChatInput(prefix)
                  textareaRef.current?.focus()
                }}
              />

              {/* Enhanced input */}
              <EnhancedInput
                ref={textareaRef}
                disabled={!canSendMessage}
                isGenerating={isGenerating}
                agents={agents.map(a => ({ name: a.name, role: a.role }))}
                onSend={handleSend}
                onAbort={handleAbort}
                slashResult={slashResult}
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Sidebar Session Item ──────────────────────────────────────────────────────

function SidebarItem({ session, isActive, onSelect }: {
  session: SessionItem
  isActive: boolean
  onSelect: () => void
}) {
  const label = sessionLabel(session)
  const preview = session.lastUserPrompt?.trim().slice(0, 60) ?? ''

  return (
    <button
      onClick={onSelect}
      className={[
        'flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border/30',
        isActive ? 'bg-primary/8 border-l-2 border-l-primary' : 'hover:bg-secondary/40 border-l-2 border-l-transparent',
      ].join(' ')}
    >
      {/* Avatar */}
      <div className="relative mt-0.5 shrink-0">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-2 text-xs font-bold text-muted-foreground">
          {label.charAt(0).toUpperCase()}
        </div>
        {session.active && (
          <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-1">
          <span className="truncate text-xs font-medium text-foreground">{label}</span>
          {session.lastActivity > 0 && (
            <span className="shrink-0 text-[10px] text-muted-foreground/50 tabular-nums">
              {timeAgo(session.lastActivity)}
            </span>
          )}
        </div>
        <div className="mt-0.5 flex items-center gap-1.5">
          <SessionKindPill kind={session.kind} />
          {preview ? (
            <span className="truncate text-[11px] text-muted-foreground">{preview}</span>
          ) : (
            <span className="truncate text-[11px] text-muted-foreground/40 italic">
              {session.model ?? 'no preview'}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}

// ── Session View (transcript + continue input) ────────────────────────────────

function SessionView({ session, messages, loading, error, inputValue, setInputValue, onSend, isGenerating, slashResult }: {
  session: NonNullable<ReturnType<typeof useMissionControl>['conversations'][0]['session']>
  messages: SessionTranscriptMessage[]
  loading: boolean
  error: string | null
  inputValue: string
  setInputValue: (v: string) => void
  onSend: (content: string) => void
  isGenerating: boolean
  slashResult: string | null
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, loading])

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Session meta bar */}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/50 bg-surface-1/30 px-4 py-2 text-xs text-muted-foreground">
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${session.active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-muted text-muted-foreground'}`}>
          {session.active ? 'active' : 'idle'}
        </span>
        {session.model && <span className="text-muted-foreground/60">{session.model}</span>}
        {session.tokens && <span className="font-mono text-[11px] text-muted-foreground/50">{session.tokens}</span>}
        {session.workingDir && (
          <span className="hidden truncate text-muted-foreground/40 sm:inline max-w-[200px]" title={session.workingDir}>
            {session.workingDir}
          </span>
        )}
        {session.age && <span className="text-muted-foreground/40">{session.age} ago</span>}
      </div>

      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto font-mono-tight py-2">
        {loading && (
          <div className="space-y-2 px-4 py-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className={`h-3.5 rounded bg-surface-1/60 animate-pulse ${i % 2 ? 'w-2/3' : 'w-3/4'}`} />
            ))}
          </div>
        )}
        {!loading && error && <p className="px-4 py-4 text-xs text-red-400">{error}</p>}
        {!loading && !error && messages.length === 0 && (
          <p className="px-4 py-4 text-xs text-muted-foreground">No transcript found for this session.</p>
        )}
        {!loading && !error && messages.map((msg, idx) => (
          <SessionMessage
            key={`${msg.timestamp ?? idx}-${idx}`}
            message={msg}
            showTimestamp={shouldShowTimestamp(msg, messages[idx - 1])}
          />
        ))}
      </div>

      {/* Continue input for session */}
      <div className="border-t border-border/50 px-4 py-2 flex-shrink-0">
        {slashResult && (
          <div className="mb-1.5 rounded bg-surface-1 px-3 py-1.5 text-xs text-muted-foreground">{slashResult}</div>
        )}
        <div className="flex items-center gap-2">
          <span className="font-mono-tight text-xs text-cyan-400/60">&gt;</span>
          <input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && inputValue.trim()) {
                e.preventDefault()
                onSend(inputValue.trim())
                setInputValue('')
              }
            }}
            placeholder="Send prompt or /refresh /search /switch..."
            disabled={isGenerating}
            className="h-7 flex-1 rounded border border-border/40 bg-surface-1 px-2 font-mono-tight text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/30 disabled:opacity-50"
          />
          <Button
            size="sm"
            variant="ghost"
            disabled={isGenerating || !inputValue.trim()}
            onClick={() => { onSend(inputValue.trim()); setInputValue('') }}
            className="h-7 px-3 text-xs"
          >
            {isGenerating ? '...' : 'Send'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Quick Action Chips ────────────────────────────────────────────────────────

function QuickActionChips({ onSelect }: { onSelect: (prefix: string) => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-t border-border/30 bg-card/50 px-3 py-2">
      {QUICK_ACTIONS.map((action) => (
        <button
          key={action.label}
          onClick={() => onSelect(action.prefix)}
          className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${action.color}`}
        >
          {action.label}
        </button>
      ))}
    </div>
  )
}

// ── Enhanced Input ────────────────────────────────────────────────────────────

const EnhancedInput = function EnhancedInput({ disabled, isGenerating, agents, onSend, onAbort, slashResult, ref: _ref }: {
  disabled?: boolean
  isGenerating?: boolean
  agents: Array<{ name: string; role: string }>
  onSend: (content: string) => void
  onAbort?: () => void
  slashResult: string | null
  ref?: React.RefObject<HTMLTextAreaElement | null>
}) {
  const { chatInput, setChatInput } = useMissionControl()
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [showMentions, setShowMentions] = useState(false)
  const [mentionFilter, setMentionFilter] = useState('')
  const [mentionIdx, setMentionIdx] = useState(0)
  const [slashSuggestions, setSlashSuggestions] = useState<string[]>([])

  const filteredAgents = agents.filter(a =>
    a.name.toLowerCase().includes(mentionFilter.toLowerCase())
  )

  const SLASH_COMMANDS = ['/search ', '/switch ', '/refresh']

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'
  }, [chatInput])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredAgents.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIdx(i => Math.min(i + 1, filteredAgents.length - 1)); return }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); insertMention(filteredAgents[mentionIdx]?.name ?? ''); return }
      if (e.key === 'Escape') { setShowMentions(false); return }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      const trimmed = chatInput.trim()
      if (trimmed && !disabled) {
        onSend(trimmed)
        setChatInput('')
        setSlashSuggestions([])
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setChatInput(val)

    // @mention detection
    const before = val.slice(0, e.target.selectionStart)
    const atMatch = before.match(/@(\w*)$/)
    if (atMatch) { setMentionFilter(atMatch[1]); setShowMentions(true); setMentionIdx(0) }
    else setShowMentions(false)

    // Slash command suggestions
    if (val.startsWith('/') && !val.includes(' ')) {
      setSlashSuggestions(SLASH_COMMANDS.filter(c => c.startsWith(val)))
    } else {
      setSlashSuggestions([])
    }
  }

  const insertMention = (name: string) => {
    const ta = textareaRef.current
    if (!ta) return
    const pos = ta.selectionStart
    const before = chatInput.slice(0, pos)
    const after = chatInput.slice(pos)
    const atIdx = before.lastIndexOf('@')
    setChatInput(before.slice(0, atIdx) + `@${name} ` + after)
    setShowMentions(false)
    setTimeout(() => { const p = atIdx + name.length + 2; ta.setSelectionRange(p, p); ta.focus() }, 0)
  }

  return (
    <div className="relative flex-shrink-0 border-t border-border bg-card/80 px-3 py-2.5">
      {/* Slash command suggestions */}
      {slashSuggestions.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 overflow-hidden rounded-lg border border-border bg-popover shadow-xl">
          {slashSuggestions.map((cmd) => (
            <button
              key={cmd}
              onMouseDown={(e) => { e.preventDefault(); setChatInput(cmd); setSlashSuggestions([]); textareaRef.current?.focus() }}
              className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-accent text-foreground"
            >
              <span className="font-mono text-primary">{cmd.trim()}</span>
              <span className="text-muted-foreground ml-auto">
                {cmd.includes('search') ? 'filter sessions' : cmd.includes('switch') ? 'jump to session' : 'reload sessions'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* @mention suggestions */}
      {showMentions && filteredAgents.length > 0 && (
        <div className="absolute bottom-full left-3 right-3 mb-1 max-h-40 overflow-y-auto rounded-lg border border-border bg-popover shadow-xl">
          {filteredAgents.map((agent, i) => (
            <button
              key={agent.name}
              onMouseDown={(e) => { e.preventDefault(); insertMention(agent.name) }}
              className={`flex w-full items-center gap-2 px-3 py-2 text-xs ${i === mentionIdx ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50 text-foreground'}`}
            >
              <span className="h-5 w-5 rounded-full bg-surface-2 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                {agent.name.charAt(0).toUpperCase()}
              </span>
              <span className="font-medium">@{agent.name}</span>
              <span className="ml-auto text-muted-foreground">{agent.role}</span>
            </button>
          ))}
        </div>
      )}

      {/* Slash command result */}
      {slashResult && (
        <div className="mb-2 rounded bg-surface-1 px-3 py-1 text-xs text-muted-foreground">{slashResult}</div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={textareaRef}
          value={chatInput}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          disabled={disabled || isGenerating}
          placeholder={disabled ? 'Select a conversation...' : 'Message... (@ mention · / command · Shift+Enter for newline)'}
          rows={1}
          className="flex-1 resize-none rounded-lg border border-border/50 bg-surface-1 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-40"
        />
        {isGenerating && onAbort ? (
          <Button onClick={onAbort} variant="ghost" size="icon-sm" className="rounded-lg shrink-0 text-red-400 hover:text-red-300 hover:bg-red-500/10" title="Stop">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="10" height="10" rx="1.5" /></svg>
          </Button>
        ) : (
          <Button
            onClick={() => { const t = chatInput.trim(); if (t && !disabled) { onSend(t); setChatInput('') } }}
            disabled={!chatInput.trim() || disabled || isGenerating}
            size="icon-sm"
            className="rounded-lg shrink-0"
            title="Send (Enter)"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2L7 9" /><path d="M14 2l-5 12-2-5-5-2 12-5z" />
            </svg>
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Empty State ───────────────────────────────────────────────────────────────

function EmptyState({ onSelectSession }: { onSelectSession: () => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <div className="rounded-full border border-border p-6 text-4xl opacity-20">◎</div>
      <div>
        <p className="text-sm font-medium text-foreground">No conversation open</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Select a session from the sidebar to start chatting
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={onSelectSession}>Browse sessions</Button>
    </div>
  )
}

// ── Chat Toasts ───────────────────────────────────────────────────────────────

function ChatToasts({ notifications }: { notifications: Array<{ id: number; type: string; title: string; message: string; created_at: number }> }) {
  const now = Math.floor(Date.now() / 1000)
  const recent = notifications.filter((n) => {
    if (now - n.created_at > 8) return false
    return n.title === 'Context Compaction' || n.title === 'Model Fallback'
  }).slice(0, 2)
  if (!recent.length) return null
  return (
    <div className="flex shrink-0 flex-col gap-1 px-4 py-1">
      {recent.map((n) => (
        <div key={n.id} className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-[11px] ${n.title === 'Context Compaction' ? 'border-blue-500/20 bg-blue-500/10 text-blue-300' : 'border-amber-500/20 bg-amber-500/10 text-amber-300'}`}>
          <span className="font-medium">{n.title}</span>
          <span className="truncate opacity-70">{n.message}</span>
        </div>
      ))}
    </div>
  )
}

// ── Agent Avatar ──────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, string> = {
  coordinator: 'bg-purple-500/20 text-purple-400',
  aegis: 'bg-red-500/20 text-red-400',
  research: 'bg-green-500/20 text-green-400',
  ops: 'bg-orange-500/20 text-orange-400',
  reviewer: 'bg-teal-500/20 text-teal-400',
  human: 'bg-primary/20 text-primary',
}

function AgentAvatar({ name }: { name: string }) {
  const cls = AGENT_COLORS[name.toLowerCase()] ?? 'bg-muted text-muted-foreground'
  return (
    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${cls}`}>
      {name.charAt(0).toUpperCase()}
    </div>
  )
}
