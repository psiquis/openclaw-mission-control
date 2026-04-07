import { NextRequest, NextResponse } from 'next/server';
import { listCronCategories, renameCronCategory, deleteCronCategory } from '@/lib/cron-templates-db';

export async function GET() {
  try {
    const categories = listCronCategories();
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Failed to list categories:', error);
    return NextResponse.json({ error: 'Failed to list categories' }, { status: 500 });
  }
}

// PATCH: rename a category
export async function PATCH(request: NextRequest) {
  try {
    const { oldName, newName } = await request.json();
    if (!oldName || !newName) return NextResponse.json({ error: 'oldName and newName required' }, { status: 400 });
    const changed = renameCronCategory(oldName, newName.trim().toLowerCase());
    return NextResponse.json({ success: true, changed });
  } catch (error) {
    console.error('Failed to rename category:', error);
    return NextResponse.json({ error: 'Failed to rename' }, { status: 500 });
  }
}

// DELETE: remove a category (reassign templates to another)
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name');
    const reassignTo = searchParams.get('reassignTo') || 'general';
    if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
    if (name === reassignTo) return NextResponse.json({ error: 'Cannot reassign to the same category' }, { status: 400 });
    const changed = deleteCronCategory(name, reassignTo);
    return NextResponse.json({ success: true, changed });
  } catch (error) {
    console.error('Failed to delete category:', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
