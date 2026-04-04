import { NextResponse } from 'next/server';
import { getAllSkills, getSkillStats } from '@/lib/skills-db';

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
