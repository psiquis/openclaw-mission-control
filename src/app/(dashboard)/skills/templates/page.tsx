'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft, ChevronRight, Check, LayoutTemplate } from 'lucide-react';
import { RiskBadge, CategoryBadge } from '@/components/SkillBadges';

interface TemplateParam {
  name: string;
  type: string;
  required?: boolean;
  default?: string;
  description: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  risk_level: string;
  version: string;
  params: TemplateParam[];
}

type Step = 'select' | 'params' | 'done';

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<Step>('select');
  const [selected, setSelected] = useState<Template | null>(null);
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message?: string; error?: string } | null>(null);

  useEffect(() => {
    fetch('/api/templates')
      .then(r => r.json())
      .then(d => setTemplates(d.templates || []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSelect = (tpl: Template) => {
    setSelected(tpl);
    const defaults: Record<string, string> = {};
    for (const p of tpl.params) defaults[p.name] = p.default || '';
    setParamValues(defaults);
    setStep('params');
    setResult(null);
  };

  const handleGenerate = async () => {
    if (!selected) return;
    setGenerating(true);
    setResult(null);
    try {
      const res = await fetch('/api/templates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId: selected.id, params: paramValues }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ success: true, message: data.message });
        setStep('done');
      } else {
        setResult({ success: false, error: data.error });
      }
    } catch (err) {
      setResult({ success: false, error: String(err) });
    } finally {
      setGenerating(false);
    }
  };

  const reset = () => { setStep('select'); setSelected(null); setParamValues({}); setResult(null); };

  const inputStyle = { backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' };

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Skill Templates
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            Create standardized skills from templates
          </p>
        </div>
        <div className="flex items-center gap-2">
          {step !== 'select' && (
            <button onClick={reset} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <a href="/skills" className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
            View Skills
          </a>
        </div>
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-6">
        {[
          { key: 'select', label: 'Choose Template' },
          { key: 'params', label: 'Configure' },
          { key: 'done', label: 'Created' },
        ].map((s, i) => {
          const steps: Step[] = ['select', 'params', 'done'];
          const currentIdx = steps.indexOf(step);
          const isActive = step === s.key;
          const isDone = currentIdx > i;
          return (
            <div key={s.key} className="flex items-center gap-2">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: isActive ? 'var(--accent)' : isDone ? 'var(--success)' : 'var(--surface)',
                  color: isActive || isDone ? 'white' : 'var(--text-muted)',
                  border: !isActive && !isDone ? '1px solid var(--border)' : 'none',
                }}
              >
                {isDone ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              <span className="text-xs" style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</span>
              {i < 2 && <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />}
            </div>
          );
        })}
      </div>

      {/* Step: Select */}
      {step === 'select' && (
        loading ? (
          <div className="text-center py-10" style={{ color: 'var(--text-muted)' }}>Loading templates...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
            {templates.map(tpl => (
              <div
                key={tpl.id}
                onClick={() => handleSelect(tpl)}
                className="rounded-xl p-4 cursor-pointer transition-all hover:scale-[1.01]"
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{tpl.name}</h3>
                </div>
                <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>{tpl.description}</p>
                <div className="flex gap-1.5">
                  <CategoryBadge category={tpl.category} />
                  <RiskBadge level={tpl.risk_level} />
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>v{tpl.version}</span>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Step: Params */}
      {step === 'params' && selected && (
        <div className="max-w-xl">
          <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center gap-2 mb-1">
              <LayoutTemplate className="w-4 h-4" style={{ color: 'var(--accent)' }} />
              <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{selected.name}</span>
              <CategoryBadge category={selected.category} />
              <RiskBadge level={selected.risk_level} />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
          </div>

          <div className="space-y-4">
            {selected.params.map(p => (
              <div key={p.name}>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
                  {p.name} {p.required && <span style={{ color: 'var(--error)' }}>*</span>}
                </label>
                <input
                  type="text"
                  value={paramValues[p.name] || ''}
                  onChange={e => setParamValues(prev => ({ ...prev, [p.name]: e.target.value }))}
                  placeholder={p.description}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={inputStyle}
                />
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{p.description}</p>
              </div>
            ))}
          </div>

          {result?.error && (
            <div className="mt-4 p-3 rounded-lg text-sm" style={{ color: 'var(--error)', backgroundColor: 'color-mix(in srgb, var(--error) 10%, var(--surface))' }}>
              {result.error}
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button onClick={reset} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>Cancel</button>
            <button
              onClick={handleGenerate}
              disabled={generating || !paramValues.name}
              className="px-6 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)', color: 'white' }}
            >
              {generating ? 'Creating...' : 'Create Skill'}
            </button>
          </div>
        </div>
      )}

      {/* Step: Done */}
      {step === 'done' && result?.success && (
        <div className="text-center py-16 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Check className="w-12 h-12 mx-auto mb-4" style={{ color: 'var(--success)' }} />
          <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Skill Created</h2>
          <p className="mb-6" style={{ color: 'var(--text-secondary)' }}>{result.message}</p>
          <div className="flex gap-3 justify-center">
            <button onClick={reset} className="px-4 py-2 text-sm rounded-lg" style={{ color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
              Create another
            </button>
            <a href="/skills" className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--accent)', color: 'white' }}>
              View Skills
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
