import { NextRequest, NextResponse } from 'next/server'
import { getDatabase } from '@/lib/db'
import { requireRole } from '@/lib/auth'
import { mutationLimiter } from '@/lib/rate-limit'
import { logger } from '@/lib/logger'
import { ensureTenantWorkspaceAccess, ForbiddenError } from '@/lib/workspaces'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'viewer')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const tenantId = auth.user.tenant_id ?? 1
    const forwardedFor = (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || null
    ensureTenantWorkspaceAccess(db, tenantId, workspaceId, {
      actor: auth.user.username,
      actorId: auth.user.id,
      route: '/api/projects/[id]/notes',
      ipAddress: forwardedFor,
      userAgent: request.headers.get('user-agent'),
    })
    const { id } = await params
    const projectId = Number.parseInt(id, 10)
    if (!Number.isFinite(projectId)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })

    const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND workspace_id = ?`).get(projectId, workspaceId)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const notes = db.prepare(`
      SELECT id, project_id, text, author, created_at
      FROM project_notes
      WHERE project_id = ?
      ORDER BY created_at DESC
    `).all(projectId)

    return NextResponse.json({ notes })
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: (error as Error).message }, { status: 403 })
    logger.error({ err: error }, 'GET /api/projects/[id]/notes error')
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = requireRole(request, 'operator')
  if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const rateCheck = mutationLimiter(request)
  if (rateCheck) return rateCheck

  try {
    const db = getDatabase()
    const workspaceId = auth.user.workspace_id ?? 1
    const tenantId = auth.user.tenant_id ?? 1
    const forwardedFor = (request.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || null
    ensureTenantWorkspaceAccess(db, tenantId, workspaceId, {
      actor: auth.user.username,
      actorId: auth.user.id,
      route: '/api/projects/[id]/notes',
      ipAddress: forwardedFor,
      userAgent: request.headers.get('user-agent'),
    })
    const { id } = await params
    const projectId = Number.parseInt(id, 10)
    if (!Number.isFinite(projectId)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })

    const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND workspace_id = ?`).get(projectId, workspaceId)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const body = await request.json()
    const text = String(body?.text || '').trim()
    if (!text) return NextResponse.json({ error: 'Note text is required' }, { status: 400 })
    const author = String(body?.author || auth.user.username || 'user').trim()

    const result = db.prepare(`
      INSERT INTO project_notes (project_id, text, author) VALUES (?, ?, ?)
    `).run(projectId, text, author)

    const note = db.prepare(`SELECT * FROM project_notes WHERE id = ?`).get(Number(result.lastInsertRowid))
    return NextResponse.json({ note }, { status: 201 })
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: (error as Error).message }, { status: 403 })
    logger.error({ err: error }, 'POST /api/projects/[id]/notes error')
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 })
  }
}
