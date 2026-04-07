import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const CATEGORIES_FILE = path.join(process.cwd(), 'data', 'cron-categories.json');

function loadCategories(): Record<string, string> {
  try {
    if (!fs.existsSync(CATEGORIES_FILE)) return {};
    return JSON.parse(fs.readFileSync(CATEGORIES_FILE, 'utf-8'));
  } catch { return {}; }
}

function saveCategories(data: Record<string, string>) {
  const dir = path.dirname(CATEGORIES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(CATEGORIES_FILE, JSON.stringify(data, null, 2));
}

// GET: list all cron job category mappings
export async function GET() {
  return NextResponse.json(loadCategories());
}

// POST: set category for a cron job (by id and/or name)
export async function POST(request: NextRequest) {
  try {
    const { jobId, jobName, category } = await request.json();
    if (!category) return NextResponse.json({ error: 'category required' }, { status: 400 });
    if (!jobId && !jobName) return NextResponse.json({ error: 'jobId or jobName required' }, { status: 400 });

    const data = loadCategories();
    if (jobId) data[jobId.toLowerCase()] = category;
    if (jobName) data[jobName.toLowerCase()] = category;
    saveCategories(data);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save category:', error);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
