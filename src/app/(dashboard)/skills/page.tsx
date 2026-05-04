'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Search, Package, ShieldAlert, Zap, Play, LayoutTemplate } from 'lucide-react';
import SkillCard from '@/components/SkillCard';
import SkillDetailModal from '@/components/SkillDetailModal';

interface SkillData {
  id: string;
  name: string;
  description: string | null;
  source: string;
  category: string;
  risk_level: string;
  has_exec: number;
  enabled: number;
  file_count: number;
  invoke_count: number;
  error_count: number;
  updated_at: string;
}

interface Stats {
  total: number;
  enabled: number;
  withExec: number;
  totalInvocations: number;
  weekInvocations: number;
  errors: number;
  byCategory: { category: string; count: number }[];
  byRisk: { risk_level: string; count: number }[];
}

export default function SkillsPage() {
  const [skills, setSkills] = useState<SkillData[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [selectedSkillId, setSelectedSkillId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterRisk, setFilterRisk] = useState<string>('all');
  const [filterAgent, setFilterAgent] = useState<string>('all');

  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch('/api/skills');
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to fetch skills:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSkills(); }, [fetchSkills]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch('/api/skills/scan', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
        setStats(data.stats || null);
      }
    } catch (err) {
      console.error('Failed to scan:', err);
    } finally {
      setScanning(false);
    }
  };

  const categories = Array.from(new Set(skills.map(s => s.category))).sort();

  // Extract unique agent IDs from source field (format: 'agent:agentId')
  const agentIds = Array.from(new Set(
    skills
      .filter(s => s.source.startsWith('agent:'))
      .map(s => s.source.replace('agent:', ''))
  )).sort();

  const filtered = skills.filter(s => {
    if (searchQuery && !s.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !(s.description || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    if (filterRisk !== 'all' && s.risk_level !== filterRisk) return false;
    if (filterAgent !== 'all') {
      if (filterAgent === 'global') {
        if (s.source.startsWith('agent:')) return false;
      } else {
        if (s.source !== `agent:${filterAgent}`) return false;
      }
    }
    return true;
  });

  const highRiskCount = stats?.byRisk.find(r => r.risk_level === 'high')?.count || 0;

  return (
    <div className="p-4 md:p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
            Skills
          </h1>
          <p className="text-sm md:text-base" style={{ color: 'var(--text-secondary)' }}>
            Manage, monitor and configure agent skills
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="/skills/templates"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <LayoutTemplate className="w-4 h-4" />
            Templates
          </a>
          <button
            onClick={handleScan}
            disabled={scanning}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          >
            <RefreshCw className={`w-4 h-4 ${scanning ? 'animate-spin' : ''}`} />
            {scanning ? 'Scanning...' : 'Scan Skills'}
          </button>
        </div>
      </div>

      {/* Agent filter tabs — only show if there are agent skills */}
      {agentIds.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          {['all', 'global', ...agentIds].map(agent => (
            <button
              key={agent}
              onClick={() => setFilterAgent(agent)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{
                backgroundColor: filterAgent === agent ? 'var(--accent)' : 'var(--surface)',
                color: filterAgent === agent ? '#fff' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
              }}
            >
              {agent === 'all' ? 'All' : agent === 'global' ? 'Global' : agent}
            </button>
          ))}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4 md:mb-8">
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total Skills</p>
              </div>
              <Package className="w-6 h-6" style={{ color: 'var(--info)' }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.withExec}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>With exec</p>
              </div>
              <Zap className="w-6 h-6" style={{ color: 'var(--warning)' }} />
            </div>
          </div>
          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold" style={{ color: highRiskCount > 0 ? 'var(--error)' : 'var(--text-primary)' }}>{highRiskCount}</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>High Risk</p>
              </div>
              <ShieldAlert className="w-6 h-6" style={{ color: highRiskCount > 0 ? 'var(--error)' : 'var(--text-muted)' }} />
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-4 md:mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search skills..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
        <select
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="all">All categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select
          value={filterRisk}
          onChange={e => setFilterRisk(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm"
          style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
        >
          <option value="all">All risk levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-muted)' }}>
          {filtered.length} of {skills.length} skills
        </span>
      </div>

      {/* Skills Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-40" style={{ color: 'var(--text-muted)' }}>
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading skills...
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-xl" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Package className="w-10 h-10 mb-3" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
            {skills.length === 0 ? 'No skills found' : 'No skills match filters'}
          </p>
          {skills.length === 0 && (
            <button onClick={handleScan} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>
              Scan for skills
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
          {filtered.map(skill => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onClick={() => setSelectedSkillId(skill.id)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedSkillId && (
        <SkillDetailModal
          skillId={selectedSkillId}
          onClose={() => setSelectedSkillId(null)}
          onUpdate={fetchSkills}
        />
      )}
    </div>
  );
}
