'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, FileText, Users, Clock, Settings, Eye } from 'lucide-react';
import { RiskBadge, CategoryBadge, SourceBadge, ExecBadge } from './SkillBadges';
import { MarkdownPreview } from './MarkdownPreview';

interface SkillDetail {
  id: string;
  name: string;
  description: string | null;
  location: string;
  source: string;
  category: string;
  risk_level: string;
  risk_reasons: string[];
  has_exec: number;
  has_state: number;
  is_idempotent: number;
  is_destructive: number;
  enabled: number;
  file_count: number;
  size_bytes: number;
  invoke_count: number;
  error_count: number;
  created_at: string;
  updated_at: string;
  last_invoked_at: string | null;
  skillMdContent: string;
  files: string[];
  agents: string[];
  invocations: Array<{
    id: number;
    trigger: string;
    agent_id: string | null;
    started_at: string;
    status: string;
    duration_ms: number | null;
    error_message: string | null;
  }>;
}

const TABS = [
  { id: 'overview', label: 'Overview', icon: Eye },
  { id: 'files', label: 'Files', icon: FileText },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'history', label: 'History', icon: Clock },
  { id: 'config', label: 'Config', icon: Settings },
] as const;
type TabId = typeof TABS[number]['id'];

const ALL_AGENTS = ['bill', 'elon', 'ruben', 'quin', 'warren', 'trump'];
const CATEGORIES = ['general', 'backup', 'monitoring', 'automation', 'api', 'workflow', 'content', 'infrastructure'];
const RISK_LEVELS = ['low', 'medium', 'high'];

interface Props {
  skillId: string | null;
  onClose: () => void;
  onUpdate?: () => void;
}

export default function SkillDetailModal({ skillId, onClose, onUpdate }: Props) {
  const [skill, setSkill] = useState<SkillDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<TabId>('overview');
  const [saving, setSaving] = useState(false);

  const fetchSkill = useCallback(async () => {
    if (!skillId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skillId}`);
      if (res.ok) setSkill(await res.json());
    } catch (err) {
      console.error('Failed to fetch skill:', err);
    } finally {
      setLoading(false);
    }
  }, [skillId]);

  useEffect(() => { fetchSkill(); setTab('overview'); }, [fetchSkill]);

  const handleSave = async (patch: Record<string, unknown>) => {
    if (!skillId) return;
    setSaving(true);
    try {
      await fetch(`/api/skills/${skillId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      await fetchSkill();
      onUpdate?.();
    } catch (err) {
      console.error('Failed to save:', err);
    } finally {
      setSaving(false);
    }
  };

  if (!skillId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="rounded-xl w-[90vw] max-w-4xl max-h-[85vh] overflow-hidden flex flex-col"
        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>{skill?.name || skillId}</h2>
            {skill && (
              <div className="flex gap-1.5 flex-shrink-0">
                <CategoryBadge category={skill.category} />
                <RiskBadge level={skill.risk_level} />
                {skill.has_exec === 1 && <ExecBadge />}
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-4" style={{ borderBottom: '1px solid var(--border)' }}>
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors"
                style={{
                  color: tab === t.id ? 'var(--accent)' : 'var(--text-muted)',
                  borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-muted)' }}>Loading...</div>
          ) : !skill ? (
            <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-muted)' }}>Skill not found</div>
          ) : (
            <>
              {tab === 'overview' && <OverviewTab skill={skill} />}
              {tab === 'files' && <FilesTab skill={skill} />}
              {tab === 'agents' && <AgentsTab skill={skill} onSave={handleSave} saving={saving} />}
              {tab === 'history' && <HistoryTab skill={skill} />}
              {tab === 'config' && <ConfigTab skill={skill} onSave={handleSave} saving={saving} />}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ skill }: { skill: SkillDetail }) {
  const content = skill.skillMdContent.replace(/^---[\s\S]*?---\s*\n/, '');
  return <div className="prose prose-invert prose-sm max-w-none"><MarkdownPreview content={content} /></div>;
}

function FilesTab({ skill }: { skill: SkillDetail }) {
  return (
    <div>
      <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
        {skill.file_count} files · {formatBytes(skill.size_bytes)} · {skill.location}
      </p>
      <div className="rounded-lg p-3 font-mono text-xs" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
        {skill.files.length > 0 ? skill.files.map((f, i) => (
          <div key={i} className="py-0.5" style={{ color: 'var(--text-secondary)' }}>
            {f.includes('/') ? (
              <><span style={{ color: 'var(--text-muted)' }}>{f.substring(0, f.lastIndexOf('/') + 1)}</span>{f.substring(f.lastIndexOf('/') + 1)}</>
            ) : (
              <span className="font-semibold">{f}</span>
            )}
          </div>
        )) : <span style={{ color: 'var(--text-muted)' }}>No files</span>}
      </div>
    </div>
  );
}

function AgentsTab({ skill, onSave, saving }: { skill: SkillDetail; onSave: (p: Record<string, unknown>) => void; saving: boolean }) {
  const [selected, setSelected] = useState<string[]>(skill.agents);
  const toggle = (id: string) => setSelected(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);

  return (
    <div>
      <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>Assign this skill to agents:</p>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
        {ALL_AGENTS.map(agent => (
          <label
            key={agent}
            className="flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors"
            style={{
              backgroundColor: selected.includes(agent) ? 'color-mix(in srgb, var(--accent) 10%, var(--surface))' : 'var(--surface)',
              border: `1px solid ${selected.includes(agent) ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <input type="checkbox" checked={selected.includes(agent)} onChange={() => toggle(agent)} className="rounded" />
            <span className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{agent}</span>
          </label>
        ))}
      </div>
      <button
        onClick={() => onSave({ agents: selected })}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'white' }}
      >
        {saving ? 'Saving...' : 'Save'}
      </button>
    </div>
  );
}

function HistoryTab({ skill }: { skill: SkillDetail }) {
  if (skill.invocations.length === 0) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No invocations recorded yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
            <th className="text-left py-2 pr-3">Date</th>
            <th className="text-left py-2 pr-3">Trigger</th>
            <th className="text-left py-2 pr-3">Agent</th>
            <th className="text-left py-2 pr-3">Status</th>
            <th className="text-right py-2">Duration</th>
          </tr>
        </thead>
        <tbody>
          {skill.invocations.map(inv => (
            <tr key={inv.id} style={{ borderBottom: '1px solid var(--border)' }}>
              <td className="py-1.5 pr-3" style={{ color: 'var(--text-secondary)' }}>{new Date(inv.started_at).toLocaleString()}</td>
              <td className="py-1.5 pr-3" style={{ color: 'var(--text-muted)' }}>{inv.trigger}</td>
              <td className="py-1.5 pr-3" style={{ color: 'var(--text-muted)' }}>{inv.agent_id || '—'}</td>
              <td className="py-1.5 pr-3">
                <span className="px-1.5 py-0.5 rounded text-xs" style={{
                  color: inv.status === 'success' ? 'var(--success)' : inv.status === 'error' ? 'var(--error)' : 'var(--text-muted)',
                  backgroundColor: inv.status === 'success' ? 'color-mix(in srgb, var(--success) 15%, transparent)' : inv.status === 'error' ? 'color-mix(in srgb, var(--error) 15%, transparent)' : 'var(--surface-hover)',
                }}>{inv.status}</span>
              </td>
              <td className="py-1.5 text-right" style={{ color: 'var(--text-muted)' }}>{inv.duration_ms ? `${(inv.duration_ms / 1000).toFixed(1)}s` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ConfigTab({ skill, onSave, saving }: { skill: SkillDetail; onSave: (p: Record<string, unknown>) => void; saving: boolean }) {
  const [category, setCategory] = useState(skill.category);
  const [riskLevel, setRiskLevel] = useState(skill.risk_level);
  const [enabled, setEnabled] = useState(skill.enabled === 1);
  const [isIdempotent, setIsIdempotent] = useState(skill.is_idempotent === 1);
  const [isDestructive, setIsDestructive] = useState(skill.is_destructive === 1);

  const inputStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="space-y-4 max-w-lg">
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
        <select value={category} onChange={e => setCategory(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Risk Level</label>
        <select value={riskLevel} onChange={e => setRiskLevel(e.target.value)} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
          {RISK_LEVELS.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {skill.risk_reasons.length > 0 && (
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Auto-detected: {skill.risk_reasons.join(', ')}</p>
        )}
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} className="rounded" />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Enabled</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isIdempotent} onChange={e => setIsIdempotent(e.target.checked)} className="rounded" />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Idempotent (safe to repeat)</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={isDestructive} onChange={e => setIsDestructive(e.target.checked)} className="rounded" />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Destructive (can delete data)</span>
        </label>
      </div>
      <div className="text-xs space-y-1" style={{ color: 'var(--text-muted)' }}>
        <p>Location: {skill.location}</p>
        <p>Created: {new Date(skill.created_at).toLocaleString()}</p>
        <p>Updated: {new Date(skill.updated_at).toLocaleString()}</p>
        {skill.last_invoked_at && <p>Last invoked: {new Date(skill.last_invoked_at).toLocaleString()}</p>}
      </div>
      <button
        onClick={() => onSave({ category, risk_level: riskLevel, enabled: enabled ? 1 : 0, is_idempotent: isIdempotent ? 1 : 0, is_destructive: isDestructive ? 1 : 0 })}
        disabled={saving}
        className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        style={{ backgroundColor: 'var(--accent)', color: 'white' }}
      >
        {saving ? 'Saving...' : 'Save Config'}
      </button>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}