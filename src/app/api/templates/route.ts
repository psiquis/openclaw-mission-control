import { NextResponse } from 'next/server';
import { getAllTemplates } from '@/lib/template-engine';

export async function GET() {
  try {
    const templates = getAllTemplates();
    return NextResponse.json({
      templates: (templates as Record<string, unknown>[]).map(t => ({
        ...t,
        skeleton: t.skeleton_json ? JSON.parse(t.skeleton_json as string) : [],
        params: t.default_params_json ? JSON.parse(t.default_params_json as string) : [],
      })),
    });
  } catch (error) {
    console.error('Failed to fetch templates:', error);
    return NextResponse.json({ templates: [] }, { status: 500 });
  }
}
