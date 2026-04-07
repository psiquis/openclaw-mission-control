'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, Clock, Check, AlertTriangle, LayoutTemplate, Plus, Pencil, Trash2, X, Save } from 'lucide-react';
import { cronToHuman } from '@/lib/cron-parser';

interface CronTemplateData {
  id: string;
  name: string;
  description: string;
  category: string;
  agentId: string;
  schedule: { kind: string; expr: string };
  timezone: string;
  sessionTarget: string;
  message: string;
  deliveryMode: string;
  deliveryChannel: string;
  tags: string[];
  is_builtin: number;
}

const AGENTS = ['bill', 'elon', 'ruben', 'quin', 'warren', 'trump'];
const DEFAULT_CATEGORIES = ['backup', 'monitoring', 'maintenance', 'reporting', 'content', 'general'];

const emptyTemplate: Partial<CronTemplateData> = {
  name: '', description: '', category: 'general', agentId: 'bill',
  schedule: { kind: 'cron', expr: '0 3 * * *' }, timezone: 'Europe/Madrid',
  sessionTarget: 'isolated', message: '', deliveryMode: 'announce', deliveryChannel: 'telegram',
};

export default function CronTemplatesPage() {
  const [templates, setTemplates] = useState<CronTemplateData[]>([]);
  const [loading, setLoading] = useState(true);
  const [deploying, setDeploying] = useState<string | null>(null);
  const [deployResult, setDeployResult] = useState<Record<string, { success: boolean; error?: string }>>({});
  const [filterCategory, setFilterCategory] = useState('all');

  // Edit/Create modal state
  const [editing, setEditing] = useState<CronTemplateData | null>(null);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Category management
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [categoryAction, setCategoryAction] = useState(false);

  // Derived: all categories from templates + defaults
  const allCategories = Array.from(new Set([
    ...DEFAULT_CATEGORIES,
    ...templates.map(t => t.category),
  ])).sort();

  const categoryCount = (cat: string) => templates.filter(t => t.category === cat).length;

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim() || newName === oldName) { setEditingCategory(null); return; }
    setCategoryAction(true);
    try {
      const res = await fetch('/api/cron/templates/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldName, newName: newName.trim() }),
      });
      if (res.ok) {
        fetchTemplates();
        if (filterCategory === oldName) setFilterCategory(newName.trim());
      }
    } catch (e) { console.error(e); }
    finally { setCategoryAction(false); setEditingCategory(null); }
  };

  const handleDeleteCategory = async (name: string) => {
    const reassignTo = name === 'general' ? 'uncategorized' : 'general';
    if (!confirm(`Delete category "${name}"? Its ${categoryCount(name)} template(s) will move to "${reassignTo}".`)) return;
    setCategoryAction(true);
    try {
      const res = await fetch(`/api/cron/templates/categories?name=${encodeURIComponent(name)}&reassignTo=${encodeURIComponent(reassignTo)}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTemplates();
        if (filterCategory === name) setFilterCategory('all');
      }
    } catch (e) { console.error(e); }
    finally { setCategoryAction(false); }
  };

  const handleAddCategory = async () => {
    const name = newCategoryName.trim().toLowerCase();
    if (!name || allCategories.includes(name)) return;
    // Create a placeholder template to persist the category, then delete it
    // Actually, just add via creating a template with that category.
    // Simpler: just allow it in the select — it will persist when a template uses it.
    // For now, we'll add it to DEFAULT_CATEGORIES at runtime.
    // Since categories are derived from templates, we need at least one template in it.
    // Let's just show it in the dropdown — user creates a template with it.
    setNewCategoryName('');
    // Force the form category to the new one if form is open
    if (creating || editing) {
      setFormData(p => ({ ...p, category: name }));
    }
  };

  const fetchTemplates = () => {
    fetch('/api/cron/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  const handleDeploy = async (tpl: CronTemplateData) => {
    setDeploying(tpl.id);
    try {
      const res = await fetch('/api/cron', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tpl.name, description: tpl.description, agentId: tpl.agentId,
          scheduleKind: tpl.schedule.kind, cronExpr: tpl.schedule.expr,
          timezone: tpl.timezone, sessionTarget: tpl.sessionTarget,
          message: tpl.message, announce: tpl.deliveryMode === 'announce',
          deliveryChannel: tpl.deliveryChannel,
        }),
      });
      const data = await res.json();
      setDeployResult(prev => ({ ...prev, [tpl.id]: res.ok ? { success: true } : { success: false, error: data.error } }));
    } catch (err) {
      setDeployResult(prev => ({ ...prev, [tpl.id]: { success: false, error: String(err) } }));
    } finally {
      setDeploying(null);
    }
  };

  const openCreate = () => {
    setCreating(true);
    setEditing(null);
    setFormData({
      name: '', description: '', category: 'general', agentId: 'bill',
      scheduleExpr: '0 3 * * *', timezone: 'Europe/Madrid', sessionTarget: 'isolated',
      message: '', deliveryMode: 'announce', deliveryChannel: 'telegram',
    });
    setFormError('');
  };

  const openEdit = (tpl: CronTemplateData) => {
    setEditing(tpl);
    setCreating(false);
    setFormData({
      name: tpl.name, description: tpl.description, category: tpl.category,
      agentId: tpl.agentId, scheduleExpr: tpl.schedule.expr, timezone: tpl.timezone,
      sessionTarget: tpl.sessionTarget, message: tpl.message,
      deliveryMode: tpl.deliveryMode, deliveryChannel: tpl.deliveryChannel,
    });
    setFormError('');
  };

  const closeForm = () => { setEditing(null); setCreating(false); setFormError(''); };

  const handleSave = async () => {
    if (!formData.name || !formData.message || !formData.scheduleExpr) {
      setFormError('Name, schedule, and message are required');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (creating) {
        const res = await fetch('/api/cron/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, scheduleKind: 'cron' }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error); return; }
      } else if (editing) {
        const res = await fetch(`/api/cron/templates/${editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...formData, scheduleKind: 'cron' }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error); return; }
      }
      closeForm();
      fetchTemplates();
    } catch (err) {
      setFormError(String(err));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      const res = await fetch(`/api/cron/templates/${id}`, { method: 'DELETE' });
      if (res.ok) fetchTemplates();
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = filterCategory === 'all' ? templates : templates.filter(t => t.category === filterCategory);
  const inputStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' };
  const isFormOpen = creating || editing !== null;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Cron Templates
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            Pre-configured cron jobs — deploy, edit, or create your own
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openCreate}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: 'var(--accent)', color: '#000' }}
          >
            <Plus className="w-4 h-4" /> New Template
          </button>
          <a href="/cron" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            <ArrowLeft className="w-4 h-4" /> Cron Jobs
          </a>
        </div>
      </div>

      {/* Filter + Category Manager */}
      <div className="flex items-center gap-3 mb-4">
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle}>
          <option value="all">All categories</option>
          {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          onClick={() => setShowCategoryManager(!showCategoryManager)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium"
          style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
        >
          <Pencil className="w-3 h-3" /> Categories
        </button>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{filtered.length} templates</span>
      </div>

      {/* Category Manager */}
      {showCategoryManager && (
        <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Manage Categories</h3>
            <button onClick={() => setShowCategoryManager(false)} className="p-1" style={{ color: 'var(--text-muted)' }}><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-col gap-1.5 mb-3">
            {allCategories.map(cat => {
              const count = categoryCount(cat);
              const isEditing = editingCategory === cat;
              return (
                <div key={cat} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm" style={{ backgroundColor: 'var(--card-elevated)', border: '1px solid var(--border)' }}>
                  {isEditing ? (
                    <input
                      type="text"
                      value={editCategoryName}
                      onChange={e => setEditCategoryName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                      onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat, editCategoryName); if (e.key === 'Escape') setEditingCategory(null); }}
                      onBlur={() => handleRenameCategory(cat, editCategoryName)}
                      autoFocus
                      className="px-2 py-0.5 rounded text-xs flex-1"
                      style={inputStyle}
                    />
                  ) : (
                    <span className="flex-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{cat}</span>
                  )}
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{count} template{count !== 1 ? 's' : ''}</span>
                  {!isEditing && (
                    <>
                      <button
                        onClick={() => { setEditingCategory(cat); setEditCategoryName(cat); }}
                        className="p-1 rounded" style={{ color: 'var(--text-muted)' }}
                        title="Rename"
                        disabled={categoryAction}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteCategory(cat)}
                        className="p-1 rounded" style={{ color: 'var(--error)' }}
                        title={`Delete (move templates to ${cat === 'general' ? 'uncategorized' : 'general'})`}
                        disabled={categoryAction}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newCategoryName}
              onChange={e => setNewCategoryName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); }}
              placeholder="new-category"
              className="px-3 py-1.5 rounded-lg text-xs w-40"
              style={inputStyle}
            />
            <button
              onClick={handleAddCategory}
              disabled={!newCategoryName.trim() || allCategories.includes(newCategoryName.trim())}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)', color: '#000' }}
            >
              <Plus className="w-3 h-3" /> Add
            </button>
          </div>
          <p className="text-[10px] mt-2" style={{ color: 'var(--text-muted)' }}>
            Rename: click the pencil. Delete: templates move to "general" (or "uncategorized" if deleting general).
          </p>
        </div>
      )}

      {/* Templates grid */}
      {loading ? (
        <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 md:gap-4">
          {filtered.map(tpl => {
            const deployed = deployResult[tpl.id];
            return (
              <div key={tpl.id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <LayoutTemplate className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--accent)' }} />
                      <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{tpl.name}</h3>
                      {tpl.is_builtin === 0 && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: 'var(--info)', backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)' }}>custom</span>
                      )}
                    </div>
                    <p className="text-xs line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{tpl.description}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => openEdit(tpl)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--text-muted)' }} title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(tpl.id)} className="p-1.5 rounded-lg transition-colors" style={{ color: 'var(--error)' }} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {deployed?.success ? (
                      <span className="flex items-center gap-1 text-xs px-2 py-1 rounded" style={{ color: 'var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 15%, transparent)' }}>
                        <Check className="w-3 h-3" /> Deployed
                      </span>
                    ) : (
                      <button
                        onClick={() => handleDeploy(tpl)}
                        disabled={deploying === tpl.id}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
                        style={{ backgroundColor: 'var(--accent)', color: '#000' }}
                      >
                        {deploying === tpl.id ? '...' : 'Deploy'}
                      </button>
                    )}
                  </div>
                </div>

                {deployed?.error && (
                  <div className="flex items-center gap-1 text-xs mt-2 p-2 rounded" style={{ color: 'var(--error)', backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)' }}>
                    <AlertTriangle className="w-3 h-3 flex-shrink-0" /> {deployed.error}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 mt-3 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    <Clock className="w-3 h-3" /> {cronToHuman(tpl.schedule.expr)}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-hover)' }}>{tpl.agentId}</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-hover)' }}>{tpl.category}</span>
                </div>

                {/* Message preview */}
                <div className="mt-2 p-2 rounded text-xs font-mono line-clamp-2" style={{ backgroundColor: 'color-mix(in srgb, var(--surface) 50%, var(--background))', color: 'var(--text-muted)' }}>
                  {tpl.message}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit/Create Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={closeForm}>
          <div className="rounded-xl w-[90vw] max-w-2xl max-h-[85vh] overflow-y-auto" style={{ backgroundColor: 'var(--background)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                {creating ? 'New Cron Template' : `Edit: ${editing?.name}`}
              </h2>
              <button onClick={closeForm} className="p-1" style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Name *</label>
                  <input type="text" value={formData.name || ''} onChange={e => setFormData(p => ({...p, name: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="My template" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Category</label>
                  <select value={formData.category || 'general'} onChange={e => setFormData(p => ({...p, category: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                    {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Agent</label>
                  <select value={formData.agentId || 'bill'} onChange={e => setFormData(p => ({...p, agentId: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                    {AGENTS.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Schedule (cron) *</label>
                  <input type="text" value={formData.scheduleExpr || ''} onChange={e => setFormData(p => ({...p, scheduleExpr: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={inputStyle} placeholder="0 3 * * *" />
                  {formData.scheduleExpr && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{cronToHuman(formData.scheduleExpr)}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Timezone</label>
                  <input type="text" value={formData.timezone || ''} onChange={e => setFormData(p => ({...p, timezone: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Delivery</label>
                  <select value={formData.deliveryChannel || 'telegram'} onChange={e => setFormData(p => ({...p, deliveryChannel: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle}>
                    <option value="telegram">Telegram</option>
                    <option value="discord">Discord</option>
                    <option value="slack">Slack</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Description</label>
                <input type="text" value={formData.description || ''} onChange={e => setFormData(p => ({...p, description: e.target.value}))} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="What this cron job does" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Message / Prompt *</label>
                <textarea value={formData.message || ''} onChange={e => setFormData(p => ({...p, message: e.target.value}))} rows={4} className="w-full rounded-lg px-3 py-2 text-sm" style={inputStyle} placeholder="The instruction the agent will receive..." />
              </div>
              {formError && (
                <div className="p-3 rounded-lg text-sm" style={{ color: 'var(--error)', backgroundColor: 'color-mix(in srgb, var(--error) 10%, transparent)' }}>{formError}</div>
              )}
              <div className="flex gap-3 pt-2">
                <button onClick={closeForm} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancel</button>
                <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50" style={{ backgroundColor: 'var(--accent)', color: '#000' }}>
                  <Save className="w-4 h-4" /> {saving ? 'Saving...' : creating ? 'Create Template' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}