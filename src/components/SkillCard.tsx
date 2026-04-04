'use client';

import { FileText, Play, AlertTriangle, Zap, Users } from 'lucide-react';
import { RiskBadge, CategoryBadge, ExecBadge } from './SkillBadges';

interface SkillCardProps {
  skill: {
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
    agents?: string[];
  };
  onClick?: () => void;
}

export default function SkillCard({ skill, onClick }: SkillCardProps) {
  const desc = skill.description || 'No description';
  const truncDesc = desc.length > 140 ? desc.slice(0, 140) + '…' : desc;
  const agents = skill.agents || [];

  return (
    <div
      onClick={onClick}
      className="group rounded-xl border cursor-pointer transition-all hover:scale-[1.01]"
      style={{
        backgroundColor: skill.enabled ? 'var(--surface)' : 'color-mix(in srgb, var(--error) 5%, var(--surface))',
        borderColor: skill.enabled ? 'var(--border)' : 'color-mix(in srgb, var(--error) 20%, var(--border))',
        opacity: skill.enabled ? 1 : 0.7,
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--text-primary)' }}>
            {skill.name}
          </h3>
          {!skill.enabled && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded" style={{ color: 'var(--error)', backgroundColor: 'color-mix(in srgb, var(--error) 15%, transparent)' }}>
              disabled
            </span>
          )}
        </div>

        {/* Description */}
        <p className="text-xs mb-3 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
          {truncDesc}
        </p>

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          <CategoryBadge category={skill.category} />
          <RiskBadge level={skill.risk_level} />
          {skill.has_exec === 1 && <ExecBadge />}
          {agents.length > 0 && (
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
              style={{ color: 'var(--info)', backgroundColor: 'color-mix(in srgb, var(--info) 15%, transparent)' }}
            >
              <Users className="w-3 h-3" />
              {agents.join(', ')}
            </span>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
          <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <FileText className="w-3 h-3" /> {skill.file_count}
          </span>
          {skill.invoke_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}>
              <Play className="w-3 h-3" /> {skill.invoke_count}
            </span>
          )}
          {skill.error_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs" style={{ color: 'var(--error)' }}>
              <AlertTriangle className="w-3 h-3" /> {skill.error_count}
            </span>
          )}
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {new Date(skill.updated_at).toLocaleDateString()}
          </span>
        </div>
      </div>
    </div>
  );
}
