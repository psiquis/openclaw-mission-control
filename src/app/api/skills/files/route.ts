import { NextRequest, NextResponse } from 'next/server'
import { access, readdir, stat } from 'node:fs/promises'
import { constants } from 'node:fs'
import { join, relative } from 'node:path'
import { homedir } from 'node:os'
import { requireRole } from '@/lib/auth'
import { resolveWithin } from '@/lib/paths'

interface FileNode {
  name: string
  path: string       // relative to skill root
  type: 'file' | 'dir'
  size?: number
  modified?: number
  ext?: string
  children?: FileNode[]
}

function resolveSkillRoot(envName: string, fallback: string): string {
  const override = process.env[envName]
  return override && override.trim().length > 0 ? override.trim() : fallback
}

function getSkillRoots(): Map<string, string> {
  const home = homedir()
  const cwd = process.cwd()
  const openclawState = process.env.OPENCLAW_STATE_DIR || process.env.OPENCLAW_HOME || join(home, '.openclaw')
  const workspaceDir = process.env.OPENCLAW_WORKSPACE_DIR || process.env.MISSION_CONTROL_WORKSPACE_DIR || join(openclawState, 'workspace')

  const roots = new Map<string, string>([
    ['user-agents',    resolveSkillRoot('MC_SKILLS_USER_AGENTS_DIR',     join(home, '.agents', 'skills'))],
    ['user-codex',     resolveSkillRoot('MC_SKILLS_USER_CODEX_DIR',      join(home, '.codex', 'skills'))],
    ['project-agents', resolveSkillRoot('MC_SKILLS_PROJECT_AGENTS_DIR',  join(cwd, '.agents', 'skills'))],
    ['project-codex',  resolveSkillRoot('MC_SKILLS_PROJECT_CODEX_DIR',   join(cwd, '.codex', 'skills'))],
    ['openclaw',       resolveSkillRoot('MC_SKILLS_OPENCLAW_DIR',        join(openclawState, 'skills'))],
    ['workspace',      resolveSkillRoot('MC_SKILLS_WORKSPACE_DIR',       join(workspaceDir, 'skills'))],
  ])
  return roots
}

function normalizeSkillName(raw: string): string | null {
  const v = raw.trim()
  if (!v || !/^[a-zA-Z0-9._-]+$/.test(v)) return null
  return v
}

async function buildTree(dir: string, base: string, depth = 0): Promise<FileNode[]> {
  if (depth > 6) return []
  let entries: import('node:fs').Dirent[]
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch { return [] }

  const nodes: FileNode[] = []
  for (const entry of entries) {
    // Skip hidden files and common noise
    if (entry.name.startsWith('.') && entry.name !== '.env.example') continue
    if (entry.name === '__pycache__' || entry.name === 'node_modules' || entry.name === '.git') continue

    const fullPath = join(dir, entry.name)
    const relPath  = relative(base, fullPath)

    if (entry.isDirectory()) {
      const children = await buildTree(fullPath, base, depth + 1)
      nodes.push({ name: entry.name, path: relPath, type: 'dir', children })
    } else {
      let size: number | undefined
      let modified: number | undefined
      try {
        const s = await stat(fullPath)
        size     = s.size
        modified = Math.floor(s.mtimeMs)
      } catch { /* ignore */ }
      const ext = entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : undefined
      nodes.push({ name: entry.name, path: relPath, type: 'file', size, modified, ext })
    }
  }

  // Dirs first, then files, both alphabetically
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
    return a.name.localeCompare(b.name)
  })

  return nodes
}

export async function GET(request: NextRequest) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const { searchParams } = new URL(request.url)
  const source = String(searchParams.get('source') || '').trim()
  const name   = normalizeSkillName(String(searchParams.get('name') || ''))

  if (!source || !name) {
    return NextResponse.json({ error: 'source and name are required' }, { status: 400 })
  }

  const roots = getSkillRoots()
  const rootPath = roots.get(source)
  if (!rootPath) {
    return NextResponse.json({ error: 'Invalid source' }, { status: 400 })
  }

  const skillPath = resolveWithin(rootPath, name)

  try {
    await access(skillPath, constants.R_OK)
  } catch {
    return NextResponse.json({ error: 'Skill directory not found' }, { status: 404 })
  }

  const tree  = await buildTree(skillPath, skillPath)
  const total = countFiles(tree)

  return NextResponse.json({ source, name, skillPath, tree, total })
}

function countFiles(nodes: FileNode[]): number {
  let n = 0
  for (const node of nodes) {
    if (node.type === 'file') n++
    else if (node.children) n += countFiles(node.children)
  }
  return n
}

export const dynamic = 'force-dynamic'
