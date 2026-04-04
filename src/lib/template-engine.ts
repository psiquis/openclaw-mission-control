import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';
import { BUILTIN_TEMPLATES, type TemplateDef } from './templates-seed';
import { scanAndSync } from './skills-db';

const DB_PATH = path.join(process.cwd(), 'data', 'skills.db');
const OPENCLAW_DIR = process.env.OPENCLAW_DIR || '/home/ola3/.openclaw';
const SKILLS_DIR = path.join(OPENCLAW_DIR, 'skills');

function getDb(): Database.Database {
  const db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  return db;
}

// ---- Seed templates into DB ----

export function seedTemplates() {
  const db = getDb();
  const upsert = db.prepare(`
    INSERT INTO templates (id, name, description, category, version, author, risk_level, skeleton_json, default_params_json, updated_at)
    VALUES (@id, @name, @description, @category, @version, @author, @risk_level, @skeleton_json, @default_params_json, datetime('now'))
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, description=excluded.description, category=excluded.category,
      version=excluded.version, risk_level=excluded.risk_level, skeleton_json=excluded.skeleton_json,
      default_params_json=excluded.default_params_json, updated_at=datetime('now')
  `);

  const transaction = db.transaction(() => {
    for (const tpl of BUILTIN_TEMPLATES) {
      upsert.run({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        version: tpl.version,
        author: tpl.author,
        risk_level: tpl.risk_level,
        skeleton_json: JSON.stringify(tpl.files),
        default_params_json: JSON.stringify(tpl.params),
      });
    }
  });

  transaction();
  db.close();
}

// ---- Get templates ----

export function getAllTemplates() {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c;
  if (count === 0) {
    db.close();
    seedTemplates();
    const db2 = getDb();
    const result = db2.prepare('SELECT * FROM templates ORDER BY category, name').all();
    db2.close();
    return result;
  }
  const result = db.prepare('SELECT * FROM templates ORDER BY category, name').all();
  db.close();
  return result;
}

export function getTemplateById(id: string) {
  const db = getDb();
  const count = (db.prepare('SELECT COUNT(*) as c FROM templates').get() as { c: number }).c;
  if (count === 0) {
    db.close();
    seedTemplates();
    const db2 = getDb();
    const result = db2.prepare('SELECT * FROM templates WHERE id = ?').get(id);
    db2.close();
    return result;
  }
  const result = db.prepare('SELECT * FROM templates WHERE id = ?').get(id);
  db.close();
  return result;
}

// ---- Generate skill from template ----

function interpolate(template: string, params: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

export function generateSkillFromTemplate(
  templateId: string,
  params: Record<string, string>
): { success: boolean; skillPath?: string; error?: string } {
  // Find template
  const builtin = BUILTIN_TEMPLATES.find(t => t.id === templateId);
  if (!builtin) {
    return { success: false, error: `Template '${templateId}' not found` };
  }

  const skillName = params.name;
  if (!skillName || !/^[a-z0-9][a-z0-9-]*$/.test(skillName)) {
    return { success: false, error: 'Invalid skill name. Use lowercase kebab-case.' };
  }

  const skillPath = path.join(SKILLS_DIR, skillName);

  // Check if already exists
  if (fs.existsSync(skillPath)) {
    return { success: false, error: `Skill '${skillName}' already exists at ${skillPath}` };
  }

  try {
    // Create skill directory
    fs.mkdirSync(skillPath, { recursive: true });

    // Generate each file
    for (const file of builtin.files) {
      const filePath = interpolate(file.path, params);
      const fileContent = interpolate(file.template, params);
      const fullPath = path.join(skillPath, filePath);

      // Create parent dirs
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });

      // Write file
      fs.writeFileSync(fullPath, fileContent, 'utf-8');

      // Make executable if needed
      if (file.executable) {
        fs.chmodSync(fullPath, 0o755);
      }
    }

    // Re-scan to register in DB
    scanAndSync();

    return { success: true, skillPath };
  } catch (err) {
    // Cleanup on error
    try { fs.rmSync(skillPath, { recursive: true, force: true }); } catch { /* ignore */ }
    return { success: false, error: `Failed to generate skill: ${err}` };
  }
}
