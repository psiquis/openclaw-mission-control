import { NextRequest, NextResponse } from 'next/server';
import { getSkillById, updateSkill, getSkillAgents, getSkillInvocations, setSkillAgents, removeSkillRecord } from '@/lib/skills-db';
import { parseSkill } from '@/lib/skill-parser';
import fs from 'fs';
import path from 'path';
import os from 'os';

// GET /api/skills/[id] — Skill detail with files, agents, invocations
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const skill = getSkillById(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Parse full SKILL.md
    const parsed = parseSkill(skill.location, id);

    // Get files list
    let files: string[] = [];
    try {
      files = parsed?.files || [];
    } catch { /* skip */ }

    // Read SKILL.md content
    let skillMdContent = '';
    const skillMdPath = path.join(skill.location, 'SKILL.md');
    try {
      if (fs.existsSync(skillMdPath)) {
        skillMdContent = fs.readFileSync(skillMdPath, 'utf-8');
      }
    } catch { /* skip */ }

    // Get agents and invocations
    const agents = getSkillAgents(id);
    const invocations = getSkillInvocations(id, 25);

    return NextResponse.json({
      ...skill,
      risk_reasons: skill.risk_reasons ? JSON.parse(skill.risk_reasons) : [],
      skillMdContent,
      files,
      agents: agents.map(a => a.agent_id),
      invocations,
    });
  } catch (error) {
    console.error('Failed to get skill:', error);
    return NextResponse.json({ error: 'Failed to get skill' }, { status: 500 });
  }
}

// PATCH /api/skills/[id] — Update skill metadata
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();

    const skill = getSkillById(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    // Handle agents separately
    if (body.agents && Array.isArray(body.agents)) {
      setSkillAgents(id, body.agents);
    }

    // Update other fields
    const { agents: _agents, ...patch } = body;
    if (Object.keys(patch).length > 0) {
      updateSkill(id, patch);
    }

    const updated = getSkillById(id);
    return NextResponse.json({ success: true, skill: updated });
  } catch (error) {
    console.error('Failed to update skill:', error);
    return NextResponse.json({ error: 'Failed to update skill' }, { status: 500 });
  }
}

// DELETE /api/skills/[id] - Delete skill folder from disk and remove DB record
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const skill = getSkillById(id);
    if (!skill) return NextResponse.json({ error: 'Skill not found' }, { status: 404 });

    const openclawDir = path.join(os.homedir(), '.openclaw');
    const loc = path.resolve(skill.location);

    if (fs.existsSync(loc)) {
      // Safety: only delete real skill dirs inside ~/.openclaw that contain a SKILL.md
      const inside = loc.startsWith(openclawDir + path.sep);
      const hasSkillMd = fs.existsSync(path.join(loc, 'SKILL.md'));
      if (!inside || !hasSkillMd) {
        return NextResponse.json({ error: 'Refusing to delete (safety check failed): ' + loc }, { status: 400 });
      }
      fs.rmSync(loc, { recursive: true, force: true });
    }
    // Folder may already be gone (stale record) - always clean the DB entry
    removeSkillRecord(id);

    return NextResponse.json({ success: true, deleted: id, location: loc });
  } catch (error) {
    console.error('Failed to delete skill:', error);
    return NextResponse.json({ error: 'Failed to delete skill' }, { status: 500 });
  }
}
