'use client'

import { useEffect, useRef, useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type AIStatus = 'active' | 'thinking' | 'idle'

interface StatusData {
  status:          AIStatus
  description:     string
  agent?:          string
  channel?:        string
  chatType?:       string
  staleSecs?:      number
  lastActivityMs?: number
}

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CFG = {
  active: {
    ring:        '#22c55e',                     // green-500
    ringAlpha:   'rgba(34,197,94,0.45)',
    dot:         'bg-emerald-400',
    label:       'Working...',
    labelColor:  'text-emerald-400',
    animation:   'ai-pulse-active',
  },
  thinking: {
    ring:        '#eab308',                     // yellow-500
    ringAlpha:   'rgba(234,179,8,0.4)',
    dot:         'bg-yellow-400',
    label:       'Thinking...',
    labelColor:  'text-yellow-400',
    animation:   'ai-pulse-thinking',
  },
  idle: {
    ring:        '#52525b',                     // zinc-600
    ringAlpha:   'rgba(82,82,91,0.0)',
    dot:         'bg-zinc-600',
    label:       'Ready',
    labelColor:  'text-zinc-500',
    animation:   '',
  },
} as const

// ── Keyframes injected once into <head> ───────────────────────────────────────

const KEYFRAMES = `
@keyframes ai-pulse-active {
  0%, 100% {
    box-shadow: 0 0 0 2px #22c55e, 0 0 6px 3px rgba(34,197,94,0.5), 0 0 14px 6px rgba(34,197,94,0.2);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 0 2px #22c55e, 0 0 10px 5px rgba(34,197,94,0.7), 0 0 22px 10px rgba(34,197,94,0.3);
    transform: scale(1.03);
  }
}
@keyframes ai-pulse-thinking {
  0%, 100% {
    box-shadow: 0 0 0 2px #eab308, 0 0 5px 2px rgba(234,179,8,0.4), 0 0 12px 5px rgba(234,179,8,0.15);
  }
  50% {
    box-shadow: 0 0 0 2px #eab308, 0 0 8px 4px rgba(234,179,8,0.6), 0 0 18px 8px rgba(234,179,8,0.25);
  }
}
@keyframes ai-dot-blink {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.4; }
}
@keyframes ai-thinking-dots {
  0%   { content: ''; }
  25%  { content: '.'; }
  50%  { content: '..'; }
  75%  { content: '...'; }
  100% { content: ''; }
}
.ai-pulse-active  { animation: ai-pulse-active   1.6s ease-in-out infinite; }
.ai-pulse-thinking{ animation: ai-pulse-thinking 2.2s ease-in-out infinite; }
.ai-dot-blink     { animation: ai-dot-blink      1.2s ease-in-out infinite; }
`

let stylesInjected = false
function ensureStyles() {
  if (stylesInjected || typeof document === 'undefined') return
  const el = document.createElement('style')
  el.textContent = KEYFRAMES
  document.head.appendChild(el)
  stylesInjected = true
}

// ── Collapsed widget (icon-only sidebar) ─────────────────────────────────────

export function AIStatusDot({ status }: { status: AIStatus }) {
  const cfg = STATUS_CFG[status]
  return (
    <div className="relative flex items-center justify-center w-8 h-8" title={cfg.label}>
      <div className={`w-2 h-2 rounded-full ${cfg.dot} ${status !== 'idle' ? 'ai-dot-blink' : ''}`} />
    </div>
  )
}

// ── Expanded widget ───────────────────────────────────────────────────────────

interface AIStatusWidgetProps {
  expanded: boolean
}

export function AIStatusWidget({ expanded }: AIStatusWidgetProps) {
  const [data, setData]       = useState<StatusData | null>(null)
  const [error, setError]     = useState(false)
  const intervalRef           = useRef<NodeJS.Timeout | undefined>(undefined)
  const mountedRef            = useRef(true)

  useEffect(() => {
    ensureStyles()
  }, [])

  const poll = async () => {
    try {
      const res = await fetch('/api/ai-status', { cache: 'no-store' })
      if (!mountedRef.current) return
      if (res.ok) {
        setData(await res.json())
        setError(false)
      } else {
        setError(true)
      }
    } catch {
      if (mountedRef.current) setError(true)
    }
  }

  useEffect(() => {
    mountedRef.current = true
    poll()                                          // immediate first fetch
    intervalRef.current = setInterval(poll, 5_000)  // then every 5 s
    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  // ── Collapsed: just a tiny status dot ────────────────────────────────────
  if (!expanded) {
    return (
      <div className="flex justify-center py-2">
        <AIStatusDot status={data?.status ?? 'idle'} />
      </div>
    )
  }

  // ── Expanded ─────────────────────────────────────────────────────────────
  const status = data?.status ?? 'idle'
  const cfg    = STATUS_CFG[status]

  if (error) {
    return (
      <div className="mx-3 mb-2 px-2.5 py-2 rounded-lg border border-zinc-800 text-[10px] text-zinc-600">
        AI status unavailable
      </div>
    )
  }

  return (
    <div className="mx-2 mb-2 px-2.5 py-2.5 rounded-lg border border-zinc-800/80 bg-zinc-900/40 select-none">
      <div className="flex items-center gap-2.5">

        {/* Avatar ring with glow animation */}
        <div className="relative shrink-0">
          <div
            className={`w-8 h-8 rounded-full overflow-hidden ${cfg.animation}`}
            style={status !== 'idle' ? {
              boxShadow: `0 0 0 2px ${cfg.ring}, 0 0 8px 3px ${cfg.ringAlpha}`,
            } : {
              boxShadow: `0 0 0 1.5px ${cfg.ring}`,
            }}
          >
            {/* Avatar: stylised "AI" glyph */}
            <div
              className="w-full h-full flex items-center justify-center text-[10px] font-bold"
              style={{
                background: status === 'active'
                  ? 'linear-gradient(135deg,#052e16 0%,#14532d 100%)'
                  : status === 'thinking'
                    ? 'linear-gradient(135deg,#1c1400 0%,#422006 100%)'
                    : 'linear-gradient(135deg,#09090b 0%,#18181b 100%)',
                color: cfg.ring,
              }}
            >
              AI
            </div>
          </div>

          {/* Live status dot */}
          <span
            className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${cfg.dot} ${status !== 'idle' ? 'ai-dot-blink' : ''}`}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-semibold leading-none ${cfg.labelColor}`}>
            {cfg.label}
          </div>
          <div className="text-[10px] text-zinc-500 mt-1 leading-tight truncate">
            {data ? data.description : 'Checking…'}
          </div>
        </div>
      </div>

      {/* Activity detail line (only when non-idle) */}
      {status !== 'idle' && data?.agent && (
        <div className="mt-2 pt-2 border-t border-zinc-800/60 flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot} ai-dot-blink`} />
          <span className="text-[10px] text-zinc-500 truncate">
            {data.agent}
            {data.channel ? ` · ${data.channel}` : ''}
            {data.staleSecs !== undefined && data.staleSecs < 60 ? ` · ${data.staleSecs}s ago` : ''}
          </span>
        </div>
      )}
    </div>
  )
}
