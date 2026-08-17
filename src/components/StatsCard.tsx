"use client";

import { ReactNode } from "react";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  iconColor?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
}

export function StatsCard({
  title,
  value,
  icon,
  iconColor = "var(--text-muted)",
  trend,
}: StatsCardProps) {
  return (
    <div
      className="rounded-lg p-4"
      style={{
        backgroundColor: 'var(--card)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <span
          className="text-[11.5px] font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          {title}
        </span>
        <div className="[&>svg]:w-3.5 [&>svg]:h-3.5" style={{ color: iconColor, opacity: 0.8 }}>
          {icon}
        </div>
      </div>

      <div className="flex items-end justify-between">
        <span
          className="text-[22px] font-medium tabular"
          style={{
            fontFamily: 'var(--font-mono)',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          {value}
        </span>
        {trend && (
          <span
            className="text-[11px] font-medium tabular"
            style={{
              fontFamily: 'var(--font-mono)',
              color: trend.isPositive ? 'var(--success)' : 'var(--error)',
            }}
          >
            {trend.isPositive ? "+" : "−"}{Math.abs(trend.value)}%
          </span>
        )}
      </div>
    </div>
  );
}
