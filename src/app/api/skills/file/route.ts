import { NextRequest, NextResponse } from 'next/server'
import { access, mkdir, readFile, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import { requireRole } from '@/lib/auth'
import { resolveWithin } from '@/lib/paths'
import { mutationLimiter } from '@/lib/rate-limit'

const MAX_READ_BYTES  = 1_000_000  // 1 MB
const MAX_WRITE_BYTES = 500_000    // 500 KB

function resolveSkillRoot(envName: string, fallback: string): string {
  const override = process.env[envName]
  return override && override.trim().length > 0 ? override.trim() : fallback
}

function getSkillRoots(): Map<string, string> {
  const home = homedir()
  const cwd  = process.cwd()
  const openclawState = process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || join(home, '.openclaw')
  const workspaceDir  = process.env.OPENCLAW_WORKSPACE_DIR || process.env.MISSION_CONTROL_WORKSPACE_DIR || join(openclawState, 'workspace')

  return new Map<string, string>([
    ['user-agents',    resolveSkillRoot('MC_SKILLS_USER_AGENTS_DIR',     join(home, '.agents', 'skills'))],
    ['user-codex',     resolveSkillRoot('MC_SKILLS_USER_CODEX_DIR',      join(home, '.codex', 'skills'))],
    ['project-agents', resolveSkillRoot('MC_SKILLS_PROJECT_AGENTS_DIR',  join(cwd, '.agents', 'skills'))],
    ['project-codex',  resolveSkillRoot('MC_SKILLS_PROJECT_CODEX_DIR',   join(cwd, '.codex', 'skills'))],
    ['openclaw',       resolveSkillRoot('MC_SKILLS_OPENCLAW_DIR',        join(openclawState, 'skills'))],
    ['workspace',      resolveSkillRoot('MC_SKILLS_WORKSPACE_DIR',       join(workspaceDir, 'skills'))],
  ])
}

function normalizeSkillName(raw: string): string | null {
  const v = raw.trim()
  if (!v || !/^[a-zA-Z0-9._-]+$/.test(v)) return null
  return v
}

/** GET /api/skills/file?source=X&name=Y&file=relative/path */
export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const source   = String(searchParams.get('source') || '').trim()
  const name     = normalizeSkillName(String(searchParams.get('name') || ''))
  const filePath = String(searchParams.get('file') || '').trim()

  if (!source || !name || !filePath) {
    return NextResponse.json({ error: 'source, name, and file are required' }, { status: 400 })
  }

  const roots = getSkillRoots()
  const rootPath = roots.get(source)
  if (!rootPath) return NextResponse.json({ error: 'Invalid source' }, { status: 400 })

  const skillPath = resolveWithin(rootPath, name)
  let absFile: string
  try {
    absFile = resolveWithin(skillPath, filePath)
  } catch {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  try {
    await access(absFile, constants.R_OK)
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  // Guard against reading huge files
  const { stat } = await import('node:fs/promises')
  const s = await stat(absFile)
  if (s.size > MAX_READ_BYTES) {
    return NextResponse.json({ error: `File too large (${s.size} bytes)` }, { status: 413 })
  }

  const content = await readFile(absFile, 'utf8')
  const ext = filePath.includes('.') ? filePath.split('.').pop()?.toLowerCase() : undefined

  return NextResponse.json({
    source,
    name,
    file: filePath,
    content,
    size: s.size,
    modified: Math.floor(s.mtimeMs),
    ext,
  })
}

/** PUT /api/skills/file — body: { source, name, file, content } */
export async function PUT(request: NextRequest) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  let body: { source?: string; name?: string; file?: string; content?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const source   = String(body?.source || '').trim()
  const name     = normalizeSkillName(String(body?.name || ''))
  const filePath = String(body?.file || '').trim()
  const content  = typeof body?.content === 'string' ? body.content : null

  if (!source || !name || !filePath || content === null) {
    return NextResponse.json({ error: 'source, name, file, and content are required' }, { status: 400 })
  }

  if (Buffer.byteLength(content, 'utf8') > MAX_WRITE_BYTES) {
    return NextResponse.json({ error: 'Content too large' }, { status: 413 })
  }

  const roots = getSkillRoots()
  const rootPath = roots.get(source)
  if (!rootPath) return NextResponse.json({ error: 'Invalid source' }, { status: 400 })

  const skillPath = resolveWithin(rootPath, name)
  let absFile: string
  try {
    absFile = resolveWithin(skillPath, filePath)
  } catch {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  // Ensure directory exists
  await mkdir(dirname(absFile), { recursive: true })
  await writeFile(absFile, content, 'utf8')

  const { stat } = await import('node:fs/promises')
  const s = await stat(absFile)

  return NextResponse.json({ ok: true, source, name, file: filePath, size: s.size, modified: Math.floor(s.mtimeMs) })
}

export const dynamic = 'force-dynamic'
