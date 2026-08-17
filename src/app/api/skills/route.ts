import { NextRequest, NextResponse } from 'next/server';
import { getAllSkills, getSkillStats, scanAndSync } from '@/lib/skills-db';
import fs from 'fs';
import path from 'path';
import os from 'os';

export async function GET() {
  try {
    const skills = getAllSkills();
    const stats = getSkillStats();

    return NextResponse.json({
      skills: skills.map(s => ({
        ...s,
        risk_reasons: s.risk_reasons ? JSON.parse(s.risk_reasons as string) : [],
      })),
      stats,
    });
  } catch (error) {
    console.error('Failed to fetch skills:', error);
    return NextResponse.json({ skills: [], stats: null }, { status: 500 });
  }
}

// POST /api/skills - Create a new skill (folder + SKILL.md), then rescan
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawName = (body.name || '').toString().trim();
    if (!rawName) return NextResponse.json({ error: 'name is required' }, { status: 400 });

    const slug = rawName.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    if (!slug) return NextResponse.json({ error: 'invalid name' }, { status: 400 });

    const agentId = (body.agentId || '').toString().trim();
    const openclawDir = path.join(os.homedir(), '.openclaw');
    const baseDir = agentId
      ? path.join(openclawDir, 'workspace', agentId, 'skills')
      : path.join(openclawDir, 'workspace', 'skills');

    const skillDir = path.join(baseDir, slug);
    if (fs.existsSync(skillDir)) {
      return NextResponse.json({ error: 'Skill already exists: ' + skillDir }, { status: 409 });
    }

    const description = (body.description || '').toString().trim();
    const defaultMd = '# ' + slug + '\n\n' + (description || 'Nueva skill.') + '\n\n## Ejecucion\n\nDescribe aqui como se ejecuta la skill.\n';
    const skillMd = ((body.skillMdContent || '').toString().trim() || defaultMd);

    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd.endsWith('\n') ? skillMd : skillMd + '\n', 'utf-8');

    if (body.createScript) {
      const scriptsDir = path.join(skillDir, 'scripts');
      fs.mkdirSync(scriptsDir, { recursive: true });
      fs.writeFileSync(path.join(scriptsDir, 'run.py'), '#!/usr/bin/env python3\n"""' + slug + ' - script principal."""\n\nprint("' + slug + ': ok")\n', 'utf-8');
    }

    const skills = scanAndSync();
    const created = skills.find(s => s.location === skillDir) || null;
    return NextResponse.json({ success: true, skill: created, location: skillDir }, { status: 201 });
  } catch (error) {
    console.error('Failed to create skill:', error);
    return NextResponse.json({ error: 'Failed to create skill' }, { status: 500 });
  }
}
