import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { CRON_TEMPLATES, type CronTemplate } from './cron-templates';

const DB_PATH = path.join(process.cwd(), 'data', 'cron-templates.db');

export interface CronTemplateRecord extends CronTemplate {
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

function getDb(): Database.Database {
  const dbDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cron_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      agent_id TEXT DEFAULT 'bill',
      schedule_kind TEXT DEFAULT 'cron',
      schedule_expr TEXT NOT NULL,
      timezone TEXT DEFAULT 'Europe/Madrid',
      session_target TEXT DEFAULT 'isolated',
      message TEXT NOT NULL,
      delivery_mode TEXT DEFAULT 'announce',
      delivery_channel TEXT DEFAULT 'telegram',
      tags TEXT DEFAULT '[]',
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function seedBuiltins(db: Database.Database) {
  const upsert = db.prepare(`
    INSERT OR IGNORE INTO cron_templates (id, name, description, category, agent_id, schedule_kind, schedule_expr,
      timezone, session_target, message, delivery_mode, delivery_channel, tags, is_builtin)
    VALUES (@id, @name, @description, @category, @agent_id, @schedule_kind, @schedule_expr,
      @timezone, @session_target, @message, @delivery_mode, @delivery_channel, @tags, 1)
  `);
  const tx = db.transaction(() => {
    for (const t of CRON_TEMPLATES) {
      upsert.run({
        id: t.id,
        name: t.name,
        description: t.description,
        category: t.category,
        agent_id: t.agentId,
        schedule_kind: t.schedule.kind,
        schedule_expr: t.schedule.expr,
        timezone: t.timezone,
        session_target: t.sessionTarget,
        message: t.message,
        delivery_mode: t.deliveryMode,
        delivery_channel: t.deliveryChannel,
        tags: JSON.stringify(t.tags),
      });
    }
  });
  tx();
}

function ensureSeeded(db: Database.Database) {
  const count = (db.prepare('SELECT COUNT(*) as c FROM cron_templates WHERE is_builtin = 1').get() as { c: number }).c;
  if (count === 0) seedBuiltins(db);
}

function rowToTemplate(row: Record<string, unknown>): CronTemplateRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    description: row.description as string,
    category: row.category as string,
    agentId: row.agent_id as string,
    schedule: { kind: row.schedule_kind as string, expr: row.schedule_expr as string },
    timezone: row.timezone as string,
    sessionTarget: row.session_target as string,
    message: row.message as string,
    deliveryMode: row.delivery_mode as string,
    deliveryChannel: row.delivery_channel as string,
    tags: row.tags ? JSON.parse(row.tags as string) : [],
    is_builtin: row.is_builtin as number,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function getAllCronTemplates(): CronTemplateRecord[] {
  const db = getDb();
  ensureSeeded(db);
  const rows = db.prepare('SELECT * FROM cron_templates ORDER BY is_builtin DESC, category, name').all() as Record<string, unknown>[];
  db.close();
  return rows.map(rowToTemplate);
}

export function getCronTemplateById(id: string): CronTemplateRecord | undefined {
  const db = getDb();
  ensureSeeded(db);
  const row = db.prepare('SELECT * FROM cron_templates WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  db.close();
  return row ? rowToTemplate(row) : undefined;
}

export function createCronTemplate(data: {
  name: string;
  description: string;
  category: string;
  agentId: string;
  scheduleKind: string;
  scheduleExpr: string;
  timezone: string;
  sessionTarget: string;
  message: string;
  deliveryMode: string;
  deliveryChannel: string;
  tags?: string[];
}): CronTemplateRecord {
  const db = getDb();
  const id = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  db.prepare(`
    INSERT INTO cron_templates (id, name, description, category, agent_id, schedule_kind, schedule_expr,
      timezone, session_target, message, delivery_mode, delivery_channel, tags, is_builtin)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)
  `).run(id, data.name, data.description, data.category, data.agentId, data.scheduleKind,
    data.scheduleExpr, data.timezone, data.sessionTarget, data.message,
    data.deliveryMode, data.deliveryChannel, JSON.stringify(data.tags || []));
  const row = db.prepare('SELECT * FROM cron_templates WHERE id = ?').get(id) as Record<string, unknown>;
  db.close();
  return rowToTemplate(row);
}

export function updateCronTemplate(id: string, data: Record<string, unknown>): CronTemplateRecord | undefined {
  const db = getDb();
  const fieldMap: Record<string, string> = {
    name: 'name', description: 'description', category: 'category',
    agentId: 'agent_id', scheduleKind: 'schedule_kind', scheduleExpr: 'schedule_expr',
    timezone: 'timezone', sessionTarget: 'session_target', message: 'message',
    deliveryMode: 'delivery_mode', deliveryChannel: 'delivery_channel',
  };
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, val] of Object.entries(data)) {
    const col = fieldMap[key];
    if (col && val !== undefined) {
      sets.push(`${col} = ?`);
      values.push(val);
    }
  }
  if (data.tags) {
    sets.push('tags = ?');
    values.push(JSON.stringify(data.tags));
  }
  if (sets.length === 0) { db.close(); return getCronTemplateById(id); }
  sets.push("updated_at = datetime('now')");
  values.push(id);
  db.prepare(`UPDATE cron_templates SET ${sets.join(', ')} WHERE id = ?`).run(...values);
  const row = db.prepare('SELECT * FROM cron_templates WHERE id = ?').get(id) as Record<string, unknown> | undefined;
  db.close();
  return row ? rowToTemplate(row) : undefined;
}

export function deleteCronTemplate(id: string): boolean {
  const db = getDb();
  const tpl = db.prepare('SELECT is_builtin FROM cron_templates WHERE id = ?').get(id) as { is_builtin: number } | undefined;
  if (!tpl) { db.close(); return false; }
  if (tpl.is_builtin) { db.close(); return false; } // Can't delete builtins
  db.prepare('DELETE FROM cron_templates WHERE id = ?').run(id);
  db.close();
  return true;
}
