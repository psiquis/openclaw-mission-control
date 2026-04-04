import { NextRequest, NextResponse } from 'next/server';
import { logActivity, getActivities } from '@/lib/activities-db';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/ola3/.openclaw';
const DB_PATH = path.join(process.cwd(), 'data', 'activities.db');
let _lastSync = 0;

function quickSync() {
  // Only sync every 30 seconds max
  if (Date.now() - _lastSync < 30000) return;
  _lastSync = Date.now();

  try {
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    const insert = db.prepare('INSERT OR IGNORE INTO activities (id, timestamp, type, description, status, agent, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)');

    // Cron jobs last runs
    try {
      const output = execSync('openclaw cron list --json --all 2>/dev/null', { timeout: 5000, encoding: 'utf-8' });
      const jobs = (JSON.parse(output).jobs || []);
      for (const job of jobs) {
        const s = job.state || {};
        if (s.lastRunAtMs) {
          insert.run(`cron-${job.id}-${s.lastRunAtMs}`, new Date(s.lastRunAtMs).toISOString(), 'cron', `Cron: ${job.name || job.id}`, s.lastStatus === 'error' ? 'error' : 'success', job.agentId || 'main', JSON.stringify({ jobId: job.id }));
        }
      }
    } catch { /* */ }

    // Agent sessions
    const agentsDir = path.join(OPENCLAW_DIR, 'agents');
    if (fs.existsSync(agentsDir)) {
      for (const ad of fs.readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory())) {
        const sf = path.join(agentsDir, ad.name, 'sessions', 'sessions.json');
        if (!fs.existsSync(sf)) continue;
        try {
          const sess = JSON.parse(fs.readFileSync(sf, 'utf-8')).sessions || [];
          for (const s of sess.slice(-20)) {
            if (!s.createdAtMs) continue;
            insert.run(`session-${s.id}`, new Date(s.createdAtMs).toISOString(), 'message', `Session: ${s.kind || 'chat'} (${ad.name})`, 'success', ad.name, JSON.stringify({ sessionId: s.id, kind: s.kind, messages: s.messageCount || 0 }));
          }
        } catch { /* */ }
      }
    }

    // Memory files
    const wsDir = path.join(OPENCLAW_DIR, 'workspace');
    for (const agent of ['bill','elon','ruben','quin','warren','trump']) {
      const memDir = path.join(wsDir, agent, 'memory');
      if (!fs.existsSync(memDir)) continue;
      try {
        for (const f of fs.readdirSync(memDir).filter(f => f.endsWith('.md')).slice(-10)) {
          const st = fs.statSync(path.join(memDir, f));
          insert.run(`memory-${agent}-${f}`, st.mtime.toISOString(), 'memory', `Memory: ${agent}/${f}`, 'success', agent, null);
        }
      } catch { /* */ }
    }

    // Cleanup old seed
    db.prepare("DELETE FROM activities WHERE timestamp < '2026-03-01'").run();
    db.close();
  } catch { /* */ }
}

export async function GET(request: NextRequest) {
  quickSync();
  try {
    const { searchParams } = new URL(request.url);

    const type = searchParams.get('type') || undefined;
    const status = searchParams.get('status') || undefined;
    const agent = searchParams.get('agent') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const sort = (searchParams.get('sort') || 'newest') as 'newest' | 'oldest';
    const format = searchParams.get('format') || 'json';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), format === 'csv' ? 10000 : 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    const result = getActivities({ type, status, agent, startDate, endDate, sort, limit, offset });

    // CSV export
    if (format === 'csv') {
      const header = 'id,timestamp,type,description,status,duration_ms,tokens_used,agent\n';
      const rows = result.activities.map((a) => [
        a.id, a.timestamp, a.type,
        `"${(a.description || '').replace(/"/g, '""')}"`,
        a.status, a.duration_ms ?? '', a.tokens_used ?? '',
        a.agent ?? '',
      ].join(',')).join('\n');
      const csv = header + rows;
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="activities-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      activities: result.activities,
      total: result.total,
      limit,
      offset,
      hasMore: offset + limit < result.total,
    });
  } catch (error) {
    console.error('Failed to get activities:', error);
    return NextResponse.json({ error: 'Failed to get activities' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.type || !body.description || !body.status) {
      return NextResponse.json(
        { error: 'Missing required fields: type, description, status' },
        { status: 400 }
      );
    }

    const validStatuses = ['success', 'error', 'pending', 'running'];
    if (!validStatuses.includes(body.status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      );
    }

    const activity = logActivity(body.type, body.description, body.status, {
      duration_ms: body.duration_ms ?? null,
      tokens_used: body.tokens_used ?? null,
      agent: body.agent ?? null,
      metadata: body.metadata ?? null,
    });

    return NextResponse.json(activity, { status: 201 });
  } catch (error) {
    console.error('Failed to save activity:', error);
    return NextResponse.json({ error: 'Failed to save activity' }, { status: 500 });
  }
}
