import { NextResponse } from 'next/server';
import { getSkillStats } from '@/lib/skills-db';

export async function GET() {
  try {
    const stats = getSkillStats();
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get skill stats:', error);
    return NextResponse.json({ error: 'Failed to get stats' }, { status: 500 });
  }
}
