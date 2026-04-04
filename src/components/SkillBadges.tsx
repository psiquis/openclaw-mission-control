'use client';

import { ShieldAlert, ShieldCheck, Shield, Zap } from 'lucide-react';

export function RiskBadge({ level }: { level: string }) {
  if (level === 'low') return null; // Only show medium+ risks
  const config: Record<string, { color: string; label: string }> = {
    medium: { color: 'var(--warning)', label: 'Medium Risk' },
    high: { color: 'var(--error)', label: 'High Risk' },
    critical: { color: 'var(--error)', label: 'Critical' },
  };
  const c = config[level] || config.medium;
  const Icon = level === 'high' || level === 'critical' ? ShieldAlert : Shield;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: c.color, backgroundColor: `color-mix(in srgb, ${c.color} 15%, transparent)` }}
    >
      <Icon className="w-3 h-3" />
      {c.label}
    </span>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--surface-hover)' }}
    >
      {category}
    </span>
  );
}

export function SourceBadge({ source }: { source: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: 'var(--text-muted)', backgroundColor: 'var(--surface-hover)' }}
    >
      {source}
    </span>
  );
}

export function ExecBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium"
      style={{ color: 'var(--warning)', backgroundColor: `color-mix(in srgb, var(--warning) 15%, transparent)` }}
    >
      <Zap className="w-3 h-3" />
      exec
    </span>
  );
}
