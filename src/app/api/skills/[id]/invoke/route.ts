import { NextRequest, NextResponse } from 'next/server';
import { getSkillById, recordInvocation } from '@/lib/skills-db';

// POST /api/skills/[id]/invoke — Record a skill invocation
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const skill = getSkillById(id);
    if (!skill) {
      return NextResponse.json({ error: 'Skill not found' }, { status: 404 });
    }

    const body = await request.json();

    recordInvocation({
      skillId: id,
      agentId: body.agentId || null,
      cronJobId: body.cronJobId || null,
      trigger: body.trigger || 'manual',
      status: body.status || 'success',
      durationMs: body.durationMs || null,
      paramsJson: body.paramsJson || null,
      outputSummary: body.outputSummary || null,
      errorMessage: body.errorMessage || null,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to record invocation:', error);
    return NextResponse.json({ error: 'Failed to record invocation' }, { status: 500 });
  }
}
