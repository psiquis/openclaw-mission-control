import { NextRequest, NextResponse } from 'next/server';
import { getTemplateById } from '@/lib/template-engine';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const template = getTemplateById(id) as Record<string, unknown> | undefined;
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({
      ...template,
      skeleton: template.skeleton_json ? JSON.parse(template.skeleton_json as string) : [],
      params: template.default_params_json ? JSON.parse(template.default_params_json as string) : [],
    });
  } catch (error) {
    console.error('Failed to fetch template:', error);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}
