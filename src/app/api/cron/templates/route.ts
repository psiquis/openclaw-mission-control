import { NextRequest, NextResponse } from 'next/server';
import { getAllCronTemplates, createCronTemplate } from '@/lib/cron-templates-db';

export async function GET() {
  try {
    const templates = getAllCronTemplates();
    return NextResponse.json({ templates });
  } catch (error) {
    console.error('Failed to fetch cron templates:', error);
    return NextResponse.json({ templates: [] }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const required = ['name', 'message', 'scheduleExpr'];
    for (const field of required) {
      if (!body[field]) {
        return NextResponse.json({ error: `${field} is required` }, { status: 400 });
      }
    }
    const template = createCronTemplate({
      name: body.name,
      description: body.description || '',
      category: body.category || 'general',
      agentId: body.agentId || 'bill',
      scheduleKind: body.scheduleKind || 'cron',
      scheduleExpr: body.scheduleExpr,
      timezone: body.timezone || 'Europe/Madrid',
      sessionTarget: body.sessionTarget || 'isolated',
      message: body.message,
      deliveryMode: body.deliveryMode || 'announce',
      deliveryChannel: body.deliveryChannel || 'telegram',
      tags: body.tags || [],
    });
    return NextResponse.json({ success: true, template });
  } catch (error) {
    console.error('Failed to create cron template:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
