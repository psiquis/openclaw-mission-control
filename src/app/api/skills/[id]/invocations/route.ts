import { NextRequest, NextResponse } from 'next/server';
import { getSkillInvocations } from '@/lib/skills-db';

// GET /api/skills/[id]/invocations — Fetch invocation history
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const invocations = getSkillInvocations(id, limit);
    return NextResponse.json({ invocations, total: invocations.length });
  } catch (error) {
    console.error('Failed to fetch invocations:', error);
    return NextResponse.json({ error: 'Failed to fetch invocations' }, { status: 500 });
  }
}
