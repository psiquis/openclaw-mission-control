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
      route: '/api/projects/[id]/files',
      ipAddress: forwardedFor,
      userAgent: request.headers.get('user-agent'),
    })
    const { id } = await params
    const projectId = Number.parseInt(id, 10)
    if (!Number.isFinite(projectId)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })

    const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND workspace_id = ?`).get(projectId, workspaceId)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const files = db.prepare(`
      SELECT id, project_id, name, path, type, added_at
      FROM project_files
      WHERE project_id = ?
      ORDER BY added_at DESC
    `).all(projectId)

    return NextResponse.json({ files })
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: (error as Error).message }, { status: 403 })
    logger.error({ err: error }, 'GET /api/projects/[id]/files error')
    return NextResponse.json({ error: 'Failed to fetch files' }, { status: 500 })
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
      route: '/api/projects/[id]/files',
      ipAddress: forwardedFor,
      userAgent: request.headers.get('user-agent'),
    })
    const { id } = await params
    const projectId = Number.parseInt(id, 10)
    if (!Number.isFinite(projectId)) return NextResponse.json({ error: 'Invalid project ID' }, { status: 400 })

    const project = db.prepare(`SELECT id FROM projects WHERE id = ? AND workspace_id = ?`).get(projectId, workspaceId)
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })

    const body = await request.json()
    const name = String(body?.name || '').trim()
    const path = String(body?.path || '').trim()
    const type = ['file', 'url', 'doc'].includes(body?.type) ? String(body.type) : 'file'

    if (!name) return NextResponse.json({ error: 'File name is required' }, { status: 400 })
    if (!path) return NextResponse.json({ error: 'File path or URL is required' }, { status: 400 })

    const result = db.prepare(`
      INSERT INTO project_files (project_id, name, path, type) VALUES (?, ?, ?, ?)
    `).run(projectId, name, path, type)

    const file = db.prepare(`SELECT * FROM project_files WHERE id = ?`).get(Number(result.lastInsertRowid))
    return NextResponse.json({ file }, { status: 201 })
  } catch (error) {
    if (error instanceof ForbiddenError) return NextResponse.json({ error: (error as Error).message }, { status: 403 })
    logger.error({ err: error }, 'POST /api/projects/[id]/files error')
    return NextResponse.json({ error: 'Failed to add file' }, { status: 500 })
  }
}
