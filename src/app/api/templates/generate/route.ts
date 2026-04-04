import { NextRequest, NextResponse } from 'next/server';
import { generateSkillFromTemplate } from '@/lib/template-engine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { templateId, params } = body;

    if (!templateId || !params || !params.name) {
      return NextResponse.json(
        { error: 'templateId and params.name are required' },
        { status: 400 }
      );
    }

    const result = generateSkillFromTemplate(templateId, params);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      skillPath: result.skillPath,
      message: `Skill '${params.name}' created from template '${templateId}'`,
    });
  } catch (error) {
    console.error('Failed to generate skill:', error);
    return NextResponse.json({ error: 'Failed to generate skill' }, { status: 500 });
  }
}
