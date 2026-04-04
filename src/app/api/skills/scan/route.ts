import { NextResponse } from 'next/server';
import { scanAndSync, getSkillStats } from '@/lib/skills-db';

export async function POST() {
  try {
    const skills = scanAndSync();
    const stats = getSkillStats();
    return NextResponse.json({ skills, stats, scannedAt: new Date().toISOString() });
  } catch (error) {
    console.error('Failed to scan skills:', error);
    return NextResponse.json({ error: 'Failed to scan skills' }, { status: 500 });
  }
}
