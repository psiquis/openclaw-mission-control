import { NextRequest, NextResponse } from 'next/server'
import fs from 'node:fs'
import path from 'node:path'
import { homedir } from 'node:os'
import { requireRole } from '@/lib/auth'

// ── Thresholds ────────────────────────────────────────────────────────────────

const ACTIVE_MS   =  15_000   //  < 15 s  → actively writing
const THINKING_MS =  45_000   //  < 45 s  → mid-processing / thinking
// anything older  →  idle

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AIStatusResponse {
  status:          'active' | 'thinking' | 'idle'
  description:     string          // human-readable line
  agent?:          string          // which agent is active
  channel?:        string          // discord / telegram / cron / chat / …
  chatType?:       string
  lastActivityMs?: number          // epoch ms of most-recent file write
  staleSecs?:      number          // seconds since last activity
  sources:         SourceHit[]     // for debugging
}

interface SourceHit {
  file:        string
  mtimeMs:     number
  agent?:      string
  channel?:    string
  chatType?:   string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function safeStat(filePath: string): number | null {
  try { return fs.statSync(filePath).mtimeMs } catch { return null }
}

function safeReadJson(filePath: string): Record<string, unknown> | null {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf-8')) } catch { return null }
}

/** Convert a session chatType / key / channel into a readable action label. */
function deriveDescription(agent?: string, channel?: string, chatType?: string, staleSecs?: number): string {
  const ct = (chatType || '').toLowerCase()
  const ch = (channel  || '').toLowerCase()

  if (ct === 'discord' || ch.includes('discord'))   return `Chatting on Discord${channel ? ` (#${channel})` : ''}`
  if (ct === 'telegram' || ch.includes('telegram')) return `Chatting on Telegram${channel ? ` (${channel})` : ''}`
  if (ct === 'cron' || ct === 'scheduled')          return 'Running a scheduled task'
  if (ct === 'heartbeat' || ct === 'ping')          return 'Running heartbeat check'
  if (ct === 'chat' || ct === 'direct')             return `Direct chat${agent ? ` with ${agent}` : ''}`
  if (ct === 'tool' || ct === 'function')           return 'Executing a tool call'
  if (ct === 'webhook')                             return 'Processing webhook'
  if (agent)                                        return `Agent ${agent} is working`
  return 'Processing request'
}

// ── Session file scanners ─────────────────────────────────────────────────────

/**
 * Scan ~/.openclaw/agents/{agentName}/sessions/sessions.json
 * Each sessions.json contains session metadata keyed by sessionKey.
 * Returns a list of SourceHit records sorted by mtimeMs descending.
 */
function scanOpenClawSessions(openclawStateDir: string): SourceHit[] {
  const agentsDir = path.join(openclawStateDir, 'agents')
  if (!fs.existsSync(agentsDir)) return []

  let agentNames: string[]
  try { agentNames = fs.readdirSync(agentsDir) } catch { return [] }

  const hits: SourceHit[] = []

  for (const agentName of agentNames) {
    const sessionsFile = path.join(agentsDir, agentName, 'sessions', 'sessions.json')
    const mtimeMs = safeStat(sessionsFile)
    if (mtimeMs === null) continue

    // Also read the file to get channel/chatType from most-recent session
    let channel: string | undefined
    let chatType: string | undefined

    const data = safeReadJson(sessionsFile)
    if (data && typeof data === 'object') {
      // sessions.json is keyed by sessionKey → session object
      // Find the most recently updated session
      let newestUpdatedAt = 0
      for (const [key, val] of Object.entries(data)) {
        const sess = val as Record<string, unknown>
        const updatedAt = typeof sess.updatedAt === 'number' ? sess.updatedAt : 0
        if (updatedAt > newestUpdatedAt) {
          newestUpdatedAt = updatedAt
          channel  = typeof sess.channel  === 'string' ? sess.channel  : undefined
          chatType = typeof sess.chatType === 'string' ? sess.chatType : undefined
          // Also extract chatType from the session key: e.g. "agent:Aegis:discord:general"
          if (!chatType) {
            const parts = key.split(':')
            if (parts.length >= 3) chatType = parts[2]
          }
        }
      }
    }

    hits.push({ file: sessionsFile, mtimeMs, agent: agentName, channel, chatType })
  }

  return hits.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

/**
 * Scan ~/.claude/projects/{slug}/ for .jsonl session transcript files.
 * These are written in real-time by Claude Code as responses stream in.
 */
function scanClaudeSessions(claudeDir: string): SourceHit[] {
  const projectsDir = path.join(claudeDir, 'projects')
  if (!fs.existsSync(projectsDir)) return []

  let projectSlugs: string[]
  try { projectSlugs = fs.readdirSync(projectsDir) } catch { return [] }

  const hits: SourceHit[] = []

  for (const slug of projectSlugs) {
    const projectDir = path.join(projectsDir, slug)
    let files: string[]
    try { files = fs.readdirSync(projectDir).filter(f => f.endsWith('.jsonl')) } catch { continue }

    for (const file of files) {
      const fullPath = path.join(projectDir, file)
      const mtimeMs  = safeStat(fullPath)
      if (mtimeMs === null) continue
      hits.push({
        file:    fullPath,
        mtimeMs,
        agent:   'claude-code',
        chatType: 'code-session',
        channel:  slug.replace(/-/g, '/').slice(0, 40),
      })
    }
  }

  return hits.sort((a, b) => b.mtimeMs - a.mtimeMs)
}

/**
 * Also scan the current project's JSONL session files (most relevant for
 * mission-control itself when Claude Code is running inside it).
 */
function scanCurrentProjectSessions(openclawStateDir: string): SourceHit[] {
  // Some deployments store JSONL session logs under {OPENCLAW_STATE_DIR}/sessions/
  const sessionsDir = path.join(openclawStateDir, 'sessions')
  if (!fs.existsSync(sessionsDir)) return []

  let files: string[]
  try { files = fs.readdirSync(sessionsDir).filter(f => f.endsWith('.jsonl') || f.endsWith('.log')) } catch { return [] }

  return files.map(f => {
    const fp = path.join(sessionsDir, f)
    return { file: fp, mtimeMs: safeStat(fp) ?? 0, agent: 'openclaw', chatType: 'session' }
  }).filter(h => h.mtimeMs > 0).sort((a, b) => b.mtimeMs - a.mtimeMs)
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const home            = homedir()
  const openclawStateDir = process.env.OPENCLAW_STATE_DIR || process.env.CLAWDBOT_STATE_DIR || process.env.OPENCLAW_HOME || path.join(home, '.openclaw')
  const claudeDir        = process.env.CLAUDE_CONFIG_DIR  || path.join(home, '.claude')

  // Collect hits from all sources
  const allHits: SourceHit[] = [
    ...scanOpenClawSessions(openclawStateDir),
    ...scanClaudeSessions(claudeDir),
    ...scanCurrentProjectSessions(openclawStateDir),
  ]

  if (allHits.length === 0) {
    return NextResponse.json({
      status:      'idle' as const,
      description: 'No active sessions found',
      sources:     [],
    } satisfies AIStatusResponse)
  }

  // Find the freshest file across all sources
  const freshest    = allHits.reduce((best, h) => h.mtimeMs > best.mtimeMs ? h : best, allHits[0])
  const now         = Date.now()
  const ageMsRaw    = now - freshest.mtimeMs
  // Cap negative drift (clock skew / future mtime on some systems)
  const ageMs       = Math.max(0, ageMsRaw)
  const staleSecs   = Math.round(ageMs / 1000)

  let status: 'active' | 'thinking' | 'idle'
  if      (ageMs < ACTIVE_MS)   status = 'active'
  else if (ageMs < THINKING_MS) status = 'thinking'
  else                          status = 'idle'

  const description = status === 'idle'
    ? 'Ready for tasks'
    : deriveDescription(freshest.agent, freshest.channel, freshest.chatType, staleSecs)

  const body: AIStatusResponse = {
    status,
    description,
    agent:          freshest.agent,
    channel:        freshest.channel,
    chatType:       freshest.chatType,
    lastActivityMs: freshest.mtimeMs,
    staleSecs,
    sources:        allHits.slice(0, 5), // return top-5 for debug
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'no-store, max-age=0' },
  })
}

export const dynamic = 'force-dynamic'
