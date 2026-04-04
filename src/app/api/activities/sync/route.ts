import { NextResponse } from 'next/server';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

const DB_PATH = path.join(process.cwd(), 'data', 'activities.db');
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/ola3/.openclaw';

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

/**
 * POST /api/activities/sync
 * Syncs real activities from OpenClaw data sources into the activities DB
 */
export async function POST() {
  try {
    const db = getDb();
    let synced = 0;

    // Ensure table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        timestamp TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT DEFAULT 'success',
        duration_ms INTEGER,
        tokens_used INTEGER,
        agent TEXT,
        metadata TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_activities_ts ON activities(timestamp DESC);
    `);

    const insert = db.prepare(`
      INSERT OR IGNORE INTO activities (id, timestamp, type, description, status, agent, metadata)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // 1. Sync from cron jobs (last runs)
    try {
      const output = execSync('openclaw cron list --json --all 2>/dev/null', { timeout: 10000, encoding: 'utf-8' });
      const data = JSON.parse(output);
      const jobs = data.jobs || [];
      for (const job of jobs) {
        const state = job.state || {};
        if (state.lastRunAtMs) {
          const ts = new Date(state.lastRunAtMs).toISOString();
          const status = state.lastStatus === 'error' ? 'error' : 'success';
          const id = `cron-${job.id}-${state.lastRunAtMs}`;
          insert.run(id, ts, 'cron', `Cron: ${job.name || job.id}`, status, job.agentId || 'main', JSON.stringify({ jobId: job.id, duration: state.lastDurationMs }));
          synced++;
        }
      }
    } catch { /* no cron data */ }

    // 2. Sync from agent sessions (scan .jsonl files for recent sessions)
    const agentsDir = path.join(OPENCLAW_DIR, 'agents');
    if (fs.existsSync(agentsDir)) {
      const agentDirs = fs.readdirSync(agentsDir, { withFileTypes: true }).filter(d => d.isDirectory());
      for (const agentDir of agentDirs) {
        const sessionsDir = path.join(agentsDir, agentDir.name, 'sessions');
        if (!fs.existsSync(sessionsDir)) continue;

        const sessionsFile = path.join(sessionsDir, 'sessions.json');
        if (!fs.existsSync(sessionsFile)) continue;

        try {
          const sessionsData = JSON.parse(fs.readFileSync(sessionsFile, 'utf-8'));
          const sessions = sessionsData.sessions || [];
          for (const session of sessions) {
            if (!session.createdAtMs) continue;
            const ts = new Date(session.createdAtMs).toISOString();
            const id = `session-${session.id}`;
            const kind = session.kind || session.type || 'chat';
            const desc = `Session: ${kind} (${agentDir.name})`;
            const msgCount = session.messageCount || session.turns || 0;
            insert.run(id, ts, 'message', desc, 'success', agentDir.name, JSON.stringify({ sessionId: session.id, kind, messages: msgCount }));
            synced++;
          }
        } catch { /* skip */ }
      }
    }

    // 3. Sync from workspace file changes (recent git commits if available)
    const workspaceDir = path.join(OPENCLAW_DIR, 'workspace');
    try {
      const gitLog = execSync(`cd ${workspaceDir} && git log --oneline --format="%H|%aI|%s|%an" -20 2>/dev/null`, { encoding: 'utf-8', timeout: 5000 });
      for (const line of gitLog.trim().split('\n')) {
        if (!line) continue;
        const [hash, ts, msg, author] = line.split('|');
        if (!hash || !ts) continue;
        const id = `git-${hash}`;
        insert.run(id, ts, 'file', `Git: ${msg}`, 'success', author || null, JSON.stringify({ hash }));
        synced++;
      }
    } catch { /* no git */ }

    // 4. Sync from memory files (recent .md files in agent workspaces)
    const workspaceAgents = ['bill', 'elon', 'ruben', 'quin', 'warren', 'trump'];
    for (const agent of workspaceAgents) {
      const memDir = path.join(workspaceDir, agent, 'memory');
      if (!fs.existsSync(memDir)) continue;
      try {
        const files = fs.readdirSync(memDir).filter(f => f.endsWith('.md')).sort().reverse().slice(0, 10);
        for (const file of files) {
          const filePath = path.join(memDir, file);
          const stat = fs.statSync(filePath);
          const ts = stat.mtime.toISOString();
          const id = `memory-${agent}-${file}`;
          insert.run(id, ts, 'memory', `Memory: ${agent}/${file}`, 'success', agent, JSON.stringify({ file }));
          synced++;
        }
      } catch { /* skip */ }
    }

    // 5. Sync from skill invocations
    try {
      const skillsDb = new Database(path.join(process.cwd(), 'data', 'skills.db'));
      const invocations = skillsDb.prepare('SELECT * FROM skill_invocations ORDER BY started_at DESC LIMIT 50').all() as Array<Record<string, unknown>>;
      for (const inv of invocations) {
        const id = `skill-inv-${inv.id}`;
        const ts = inv.started_at as string;
        insert.run(id, ts, 'command', `Skill: ${inv.skill_id}`, inv.status as string || 'success', inv.agent_id as string || null, JSON.stringify({ skillId: inv.skill_id, trigger: inv.trigger }));
        synced++;
      }
      skillsDb.close();
    } catch { /* no skills db yet */ }

    // Clean old seed data
    db.prepare("DELETE FROM activities WHERE timestamp < '2026-03-01'").run();

    const total = (db.prepare('SELECT COUNT(*) as c FROM activities').get() as { c: number }).c;
    db.close();

    return NextResponse.json({ synced, total });
  } catch (error) {
    console.error('Failed to sync activities:', error);
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 });
  }
}
