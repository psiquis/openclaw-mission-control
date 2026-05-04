import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { parseSkill, type SkillInfo } from './skill-parser';

const DB_PATH = path.join(process.cwd(), 'data', 'skills.db');
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/ola3/.openclaw';

// ---------- Types ----------

export interface SkillRecord {
  id: string;
  name: string;
  description: string | null;
  location: string;
  source: string;
  category: string;
  risk_level: string;
  risk_reasons: string | null;
  has_exec: number;
  has_state: number;
  has_config: number;
  is_idempotent: number;
  is_destructive: number;
  enabled: number;
  file_count: number;
  size_bytes: number;
  version: string | null;
  template_id: string | null;
  created_at: string;
  updated_at: string;
  last_invoked_at: string | null;
  invoke_count: number;
  error_count: number;
}

export interface SkillInvocation {
  id: number;
  skill_id: string;
  agent_id: string | null;
  cron_job_id: string | null;
  trigger: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  status: string;
  params_json: string | null;
  output_summary: string | null;
  error_message: string | null;
}

export interface SkillAgent {
  skill_id: string;
  agent_id: string;
  assigned_at: string;
}

// ---------- DB Singleton ----------

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (!_db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    _db = new Database(DB_PATH);
    _db.pragma('journal_mode = WAL');
    _db.pragma('foreign_keys = ON');
    initSchema(_db);
  }
  return _db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      source TEXT NOT NULL,
      category TEXT DEFAULT 'general',
      risk_level TEXT DEFAULT 'low',
      risk_reasons TEXT,
      has_exec INTEGER DEFAULT 0,
      has_state INTEGER DEFAULT 0,
      has_config INTEGER DEFAULT 0,
      is_idempotent INTEGER DEFAULT 1,
      is_destructive INTEGER DEFAULT 0,
      enabled INTEGER DEFAULT 1,
      file_count INTEGER DEFAULT 0,
      size_bytes INTEGER DEFAULT 0,
      version TEXT,
      template_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      last_invoked_at TEXT,
      invoke_count INTEGER DEFAULT 0,
      error_count INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS skill_agents (
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      assigned_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY (skill_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS skill_params (
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      param_name TEXT NOT NULL,
      param_type TEXT DEFAULT 'string',
      description TEXT,
      default_value TEXT,
      required INTEGER DEFAULT 0,
      options TEXT,
      PRIMARY KEY (skill_id, param_name)
    );

    CREATE TABLE IF NOT EXISTS skill_invocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
      agent_id TEXT,
      cron_job_id TEXT,
      trigger TEXT,
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT,
      duration_ms INTEGER,
      status TEXT,
      params_json TEXT,
      output_summary TEXT,
      error_message TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_inv_skill ON skill_invocations(skill_id, started_at DESC);
    CREATE INDEX IF NOT EXISTS idx_inv_cron ON skill_invocations(cron_job_id);

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL,
      version TEXT DEFAULT '1.0.0',
      author TEXT,
      risk_level TEXT DEFAULT 'low',
      skeleton_json TEXT NOT NULL,
      default_params_json TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// ---------- Risk Assessment ----------

function assessRisk(skillPath: string): { level: string; reasons: string[] } {
  const reasons: string[] = [];
  let level = 'low';

  const skillMd = path.join(skillPath, 'SKILL.md');
  const content = fs.existsSync(skillMd) ? fs.readFileSync(skillMd, 'utf-8') : '';
  const scriptsDir = path.join(skillPath, 'scripts');

  if (fs.existsSync(scriptsDir)) {
    try {
      const scripts = fs.readdirSync(scriptsDir).filter(f =>
        f.endsWith('.sh') || f.endsWith('.py') || f.endsWith('.js')
      );
      if (scripts.length > 0) {
        level = 'medium';
        reasons.push('contains executable scripts');
      }
      for (const script of scripts) {
        try {
          const sc = fs.readFileSync(path.join(scriptsDir, script), 'utf-8');
          if (/\b(sudo|rm\s+-rf|systemctl\s+(stop|disable|mask)|docker\s+rm)\b/.test(sc)) {
            level = 'high';
            reasons.push(`${script}: elevated/destructive commands`);
          }
        } catch { /* skip unreadable */ }
      }
    } catch { /* skip unreadable dir */ }
  }

  if (/\b(sudo|rm\s+-rf|curl[^;]*\|\s*(ba)?sh|eval\s)\b/.test(content)) {
    level = 'high';
    reasons.push('dangerous commands in SKILL.md');
  }

  if (/\b(secret|token|api[_-]?key|password)\b/i.test(content)) {
    if (level === 'low') level = 'medium';
    reasons.push('references secrets/tokens');
  }

  if (/\b(delete|remove|drop|truncate|purge|destroy)\b/i.test(content)) {
    if (level === 'low') level = 'medium';
    reasons.push('potentially destructive operations');
  }

  return { level, reasons };
}

// ---------- Helpers ----------

function dirSizeBytes(dir: string): number {
  let total = 0;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        total += dirSizeBytes(full);
      } else {
        try { total += fs.statSync(full).size; } catch { /* skip */ }
      }
    }
  } catch { /* skip */ }
  return total;
}

function detectCategory(name: string, content: string): string {
  const lc = (name + ' ' + content).toLowerCase();
  if (/backup|restore|snapshot/.test(lc)) return 'backup';
  if (/monitor|health|check|alert|watch/.test(lc)) return 'monitoring';
  if (/automat|cron|schedule|periodic/.test(lc)) return 'automation';
  if (/api|integrat|webhook|fetch|endpoint/.test(lc)) return 'api';
  if (/workflow|pipeline|multi.?step/.test(lc)) return 'workflow';
  if (/noticias|news|rss|blog|content/.test(lc)) return 'content';
  if (/deploy|infra|docker|server/.test(lc)) return 'infrastructure';
  return 'general';
}

// ---------- Scan & Sync ----------

/**
 * Discover all skill directories to scan:
 * 1. ~/.openclaw/skills           → source: 'custom'
 * 2. ~/.openclaw/workspace/skills → source: 'workspace'
 * 3. ~/.openclaw/workspace/<agent>/skills  → source: 'agent:<agent>' (only if dir exists)
 */
function discoverSkillDirs(): { dirPath: string; source: string; agentId?: string }[] {
  const dirs: { dirPath: string; source: string; agentId?: string }[] = [
    { dirPath: path.join(OPENCLAW_DIR, 'skills'), source: 'custom' },
    { dirPath: path.join(OPENCLAW_DIR, 'workspace', 'skills'), source: 'workspace' },
  ];

  const workspaceDir = path.join(OPENCLAW_DIR, 'workspace');
  if (!fs.existsSync(workspaceDir)) return dirs;

  // Known non-agent entries to skip
  const SKIP = new Set(['skills', 'state', 'memory']);

  try {
    const entries = fs.readdirSync(workspaceDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP.has(entry.name)) continue;
      const agentSkillsPath = path.join(workspaceDir, entry.name, 'skills');
      if (fs.existsSync(agentSkillsPath)) {
        // Only include if the agent actually has at least one skill folder
        const hasSkills = fs.readdirSync(agentSkillsPath).some(f => {
          try { return fs.statSync(path.join(agentSkillsPath, f)).isDirectory(); } catch { return false; }
        });
        if (hasSkills) {
          dirs.push({ dirPath: agentSkillsPath, source: `agent:${entry.name}`, agentId: entry.name });
        }
      }
    }
  } catch { /* skip unreadable workspace */ }

  return dirs;
}

export function scanAndSync(): SkillRecord[] {
  const db = getDb();

  const skillDirs = discoverSkillDirs();

  const upsert = db.prepare(`
    INSERT INTO skills (id, name, description, location, source, category, risk_level, risk_reasons,
      has_exec, has_state, has_config, file_count, size_bytes, updated_at)
    VALUES (@id, @name, @description, @location, @source, @category, @risk_level, @risk_reasons,
      @has_exec, @has_state, @has_config, @file_count, @size_bytes, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, location=excluded.location,
      source=excluded.source, category=excluded.category, risk_level=excluded.risk_level,
      risk_reasons=excluded.risk_reasons, has_exec=excluded.has_exec, has_state=excluded.has_state,
      has_config=excluded.has_config, file_count=excluded.file_count, size_bytes=excluded.size_bytes,
      updated_at=datetime('now')
  `);

  const upsertAgent = db.prepare(
    'INSERT OR IGNORE INTO skill_agents (skill_id, agent_id) VALUES (?, ?)'
  );

  const foundIds: string[] = [];

  const transaction = db.transaction(() => {
    for (const { dirPath, source, agentId } of skillDirs) {
      if (!fs.existsSync(dirPath)) continue;
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(dirPath, { withFileTypes: true }); } catch { continue; }

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name.startsWith('.')) continue;
        const skillPath = path.join(dirPath, entry.name);
        const skill = parseSkill(skillPath, entry.name);
        if (!skill) continue;

        const { level, reasons } = assessRisk(skillPath);
        const hasExec = fs.existsSync(path.join(skillPath, 'scripts')) ? 1 : 0;
        const hasState = fs.existsSync(path.join(skillPath, 'data')) ? 1 : 0;
        const hasConfig = fs.existsSync(path.join(skillPath, 'config.json')) ? 1 : 0;
        const sizeBytes = dirSizeBytes(skillPath);
        const category = detectCategory(entry.name, skill.description);

        // Use source-scoped ID to avoid collisions between agents with same skill name
        const skillId = agentId ? `${agentId}:${entry.name}` : entry.name;

        upsert.run({
          id: skillId,
          name: skill.name,
          description: skill.description,
          location: skillPath,
          source,
          category,
          risk_level: level,
          risk_reasons: JSON.stringify(reasons),
          has_exec: hasExec,
          has_state: hasState,
          has_config: hasConfig,
          file_count: skill.fileCount,
          size_bytes: sizeBytes,
        });

        // Auto-assign agent to skill if scanned from agent workspace
        if (agentId) {
          upsertAgent.run(skillId, agentId);
        }

        foundIds.push(skillId);
      }
    }
  });

  transaction();
  return db.prepare('SELECT * FROM skills ORDER BY source, name').all() as SkillRecord[];
}

// ---------- CRUD ----------

export interface SkillWithAgents extends SkillRecord {
  agents: string[];
}

export function getAllSkills(): SkillWithAgents[] {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number };
  if (count.c === 0) {
    const scanned = scanAndSync();
    return scanned.map(s => ({ ...s, agents: [] }));
  }
  const skills = db.prepare('SELECT * FROM skills ORDER BY source, name').all() as SkillRecord[];
  const agentRows = db.prepare('SELECT skill_id, agent_id FROM skill_agents').all() as { skill_id: string; agent_id: string }[];
  const agentMap = new Map<string, string[]>();
  for (const row of agentRows) {
    const list = agentMap.get(row.skill_id) || [];
    list.push(row.agent_id);
    agentMap.set(row.skill_id, list);
  }
  return skills.map(s => ({ ...s, agents: agentMap.get(s.id) || [] }));
}

export function getSkillById(id: string): SkillRecord | undefined {
  return getDb().prepare('SELECT * FROM skills WHERE id = ?').get(id) as SkillRecord | undefined;
}

export function updateSkill(id: string, patch: Record<string, unknown>) {
  const allowed = ['category', 'risk_level', 'enabled', 'is_idempotent', 'is_destructive', 'version'];
  const entries = Object.entries(patch).filter(([k]) => allowed.includes(k));
  if (entries.length === 0) return;

  const sets = entries.map(([k]) => `${k} = @${k}`).join(', ');
  const sql = `UPDATE skills SET ${sets}, updated_at = datetime('now') WHERE id = @id`;
  getDb().prepare(sql).run({ id, ...Object.fromEntries(entries) });
}

export function deleteSkill(id: string) {
  getDb().prepare('UPDATE skills SET enabled = 0, updated_at = datetime(\'now\') WHERE id = ?').run(id);
}

// ---------- Agents ----------

export function getSkillAgents(skillId: string): SkillAgent[] {
  return getDb().prepare('SELECT * FROM skill_agents WHERE skill_id = ?').all(skillId) as SkillAgent[];
}

export function assignAgent(skillId: string, agentId: string) {
  getDb().prepare(
    'INSERT OR IGNORE INTO skill_agents (skill_id, agent_id) VALUES (?, ?)'
  ).run(skillId, agentId);
}

export function unassignAgent(skillId: string, agentId: string) {
  getDb().prepare(
    'DELETE FROM skill_agents WHERE skill_id = ? AND agent_id = ?'
  ).run(skillId, agentId);
}

export function setSkillAgents(skillId: string, agentIds: string[]) {
  const db = getDb();
  const transaction = db.transaction(() => {
    db.prepare('DELETE FROM skill_agents WHERE skill_id = ?').run(skillId);
    const insert = db.prepare('INSERT INTO skill_agents (skill_id, agent_id) VALUES (?, ?)');
    for (const agentId of agentIds) {
      insert.run(skillId, agentId);
    }
  });
  transaction();
}

// ---------- Invocations ----------

export function getSkillInvocations(skillId: string, limit = 50): SkillInvocation[] {
  return getDb().prepare(
    'SELECT * FROM skill_invocations WHERE skill_id = ? ORDER BY started_at DESC LIMIT ?'
  ).all(skillId, limit) as SkillInvocation[];
}

export function recordInvocation(data: {
  skillId: string;
  agentId?: string;
  cronJobId?: string;
  trigger: string;
  status: string;
  durationMs?: number;
  paramsJson?: string;
  outputSummary?: string;
  errorMessage?: string;
}) {
  const db = getDb();
  db.prepare(`
    INSERT INTO skill_invocations (skill_id, agent_id, cron_job_id, trigger, status, duration_ms, params_json, output_summary, error_message)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.skillId, data.agentId || null, data.cronJobId || null,
    data.trigger, data.status, data.durationMs || null,
    data.paramsJson || null, data.outputSummary || null, data.errorMessage || null
  );

  db.prepare(`
    UPDATE skills SET invoke_count = invoke_count + 1,
    error_count = error_count + CASE WHEN ? = 'error' THEN 1 ELSE 0 END,
    last_invoked_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(data.status, data.skillId);
}

// ---------- Stats ----------

export function getSkillStats() {
  const db = getDb();
  const total = (db.prepare('SELECT COUNT(*) as c FROM skills').get() as { c: number }).c;
  const byCategory = db.prepare('SELECT category, COUNT(*) as count FROM skills GROUP BY category ORDER BY count DESC').all() as { category: string; count: number }[];
  const byRisk = db.prepare('SELECT risk_level, COUNT(*) as count FROM skills GROUP BY risk_level').all() as { risk_level: string; count: number }[];
  const withExec = (db.prepare('SELECT COUNT(*) as c FROM skills WHERE has_exec = 1').get() as { c: number }).c;
  const enabled = (db.prepare('SELECT COUNT(*) as c FROM skills WHERE enabled = 1').get() as { c: number }).c;
  const totalInvocations = (db.prepare('SELECT COUNT(*) as c FROM skill_invocations').get() as { c: number }).c;
  const weekInvocations = (db.prepare("SELECT COUNT(*) as c FROM skill_invocations WHERE started_at >= datetime('now', '-7 days')").get() as { c: number }).c;
  const errors = (db.prepare("SELECT COUNT(*) as c FROM skill_invocations WHERE status = 'error'").get() as { c: number }).c;

  return { total, enabled, withExec, totalInvocations, weekInvocations, errors, byCategory, byRisk };
}