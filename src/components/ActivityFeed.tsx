"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  FileText,
  Search,
  MessageSquare,
  Terminal,
  CheckCircle,
  XCircle,
  Clock,
  Zap,
  Shield,
  Hammer,
  Timer,
  Brain,
} from "lucide-react";
import { RichDescription } from "./RichDescription";

interface Activity {
  id: string;
  timestamp: string;
  type: string;
  description: string;
  status: string;
  duration_ms: number | null;
  tokens_used: number | null;
}

interface ActivitiesResponse {
  activities: Activity[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

const typeConfig: Record<string, { 
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bgColor: string;
}> = {
  file: { icon: FileText, color: 'var(--type-file)', bgColor: 'var(--type-file-bg)' },
  search: { icon: Search, color: 'var(--type-search)', bgColor: 'var(--type-search-bg)' },
  message: { icon: MessageSquare, color: 'var(--type-message)', bgColor: 'var(--type-message-bg)' },
  command: { icon: Terminal, color: 'var(--type-command)', bgColor: 'var(--type-command-bg)' },
  security: { icon: Shield, color: 'var(--type-security)', bgColor: 'var(--type-security-bg)' },
  build: { icon: Hammer, color: 'var(--type-build)', bgColor: 'var(--type-build-bg)' },
  cron: { icon: Timer, color: 'var(--type-cron)', bgColor: 'var(--type-cron-bg)' },
  memory: { icon: Brain, color: 'var(--info)', bgColor: 'var(--info-bg)' },
  default: { icon: Zap, color: 'var(--text-secondary)', bgColor: 'var(--card-elevated)' },
};

const statusConfig: Record<string, { 
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color: string;
  bgColor: string;
}> = {
  success: { icon: CheckCircle, color: 'var(--success)', bgColor: 'var(--success-bg)' },
  error: { icon: XCircle, color: 'var(--error)', bgColor: 'var(--error-bg)' },
  pending: { icon: Clock, color: 'var(--warning)', bgColor: 'var(--warning-bg)' },
};

interface ActivityFeedProps {
  limit?: number;
}

export function ActivityFeed({ limit = 10 }: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[] | null>(null);

  useEffect(() => {
    fetch(`/api/activities?limit=${limit}&sort=newest`)
      .then((res) => res.json())
      .then((data: ActivitiesResponse) => setActivities(data.activities))
      .catch(() => setActivities([]));
  }, [limit]);

  if (!activities) {
    return (
      <div className="animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div 
            key={i} 
            className="h-16 mx-4 my-2 rounded-lg"
            style={{ backgroundColor: 'var(--card-elevated)' }}
          />
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12" style={{ color: 'var(--text-secondary)' }}>
        <Zap className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>No activities logged yet</p>
      </div>
    );
  }

  return (
    <div>
      {activities.map((activity) => {
        const type = typeConfig[activity.type] || typeConfig.default;
        const status = statusConfig[activity.status] || statusConfig.success;
        const TypeIcon = type.icon;

        return (
          <div
            key={activity.id}
            className="flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-3 transition-colors cursor-pointer"
            style={{ 
              borderRadius: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--card-elevated)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {/* Icon */}
            <div 
              className="w-7 h-7 md:w-9 md:h-9 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: type.bgColor }}
            >
              <TypeIcon className="w-3.5 h-3.5 md:w-[18px] md:h-[18px]" style={{ color: type.color }} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 md:gap-2 mb-0.5">
                <span 
                  className="text-[11px] md:text-xs font-semibold"
                  style={{ color: type.color }}
                >
                  {activity.type}
                </span>
                {activity.status === 'success' && (
                  <span 
                    className="badge text-[11px] md:text-xs py-0.5 px-1.5 md:px-2 hidden sm:inline-block"
                    style={{ 
                      backgroundColor: status.bgColor,
                      color: status.color,
                    }}
                  >
                    Success
                  </span>
                )}
                {activity.status === 'error' && (
                  <span 
                    className="badge text-[11px] md:text-xs py-0.5 px-1.5 md:px-2"
                    style={{ 
                      backgroundColor: status.bgColor,
                      color: status.color,
                    }}
                  >
                    Error
                  </span>
                )}
              </div>
              <RichDescription 
                text={activity.description}
                className="text-xs md:text-sm"
                style={{ color: 'var(--text-primary)' }}
              />
            </div>

            {/* Time */}
            <time 
              className="text-[11px] md:text-xs whitespace-nowrap flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              {formatDistanceToNow(new Date(activity.timestamp), { addSuffix: false, locale: es })}
            </time>
          </div>
        );
      })}
    </div>
  );
}
