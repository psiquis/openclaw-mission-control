import { NextRequest, NextResponse } from 'next/server';
import { getCronTemplateById, updateCronTemplate, deleteCronTemplate } from '@/lib/cron-templates-db';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const template = getCronTemplateById(id);
    if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(template);
  } catch (error) {
    console.error('Failed to get cron template:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const body = await request.json();
    const updated = updateCronTemplate(id, body);
    if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true, template: updated });
  } catch (error) {
    console.error('Failed to update cron template:', error);
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const deleted = deleteCronTemplate(id);
    if (!deleted) return NextResponse.json({ error: 'Cannot delete builtin template' }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete cron template:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
