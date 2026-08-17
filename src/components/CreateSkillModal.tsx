'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface AgentOpt { id: string; name?: string }

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateSkillModal({ onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [agentId, setAgentId] = useState('');
  const [skillMd, setSkillMd] = useState('');
  const [createScript, setCreateScript] = useState(false);
  const [agents, setAgents] = useState<AgentOpt[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => {
        const list = Array.isArray(d) ? d : (d.agents || []);
        setAgents(list.map((a: { id?: string; name?: string }) => ({ id: (a.id || a.name || '').toString().toLowerCase(), name: a.name || a.id })));
      })
      .catch(() => {});
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/skills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, agentId, skillMdContent: skillMd, createScript }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Error creando la skill'); return; }
      onCreated();
      onClose();
    } catch {
      setError('Error de red');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={onClose}>
      <div
        className="rounded-xl w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto flex flex-col"
        style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>New Skill</h2>
          <button onClick={onClose} className="p-1 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          {error && (
            <div className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'rgba(239,68,68,0.12)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.35)' }}>
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Nombre *</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="mi-nueva-skill"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Se convierte a minusculas-con-guiones (slug).</p>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Agente (opcional)</label>
            <select value={agentId} onChange={e => setAgentId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>
              <option value="">Workspace global (sin agente)</option>
              {agents.map(a => <option key={a.id} value={a.id}>{a.name || a.id}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Descripcion</label>
            <input value={description} onChange={e => setDescription(e.target.value)} placeholder="Que hace esta skill"
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <div>
            <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>SKILL.md (opcional, si lo dejas vacio se genera uno basico)</label>
            <textarea value={skillMd} onChange={e => setSkillMd(e.target.value)} rows={8} placeholder="# mi-skill ..."
              className="w-full px-3 py-2 rounded-lg text-sm font-mono"
              style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={createScript} onChange={e => setCreateScript(e.target.checked)} className="rounded" />
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Crear scripts/run.py de ejemplo</span>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}>Cancelar</button>
            <button onClick={handleCreate} disabled={saving}
              className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              {saving ? 'Creando...' : 'Crear Skill'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
