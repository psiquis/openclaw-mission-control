'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useMissionControl } from '@/store'
import { Button } from '@/components/ui/button'

type UpdateState = 'idle' | 'updating' | 'restarting' | 'error'

export function UpdateBanner() {
  const { updateAvailable, updateDismissedVersion, dismissUpdate } = useMissionControl()
  const t = useTranslations('updateBanner')
  const tc = useTranslations('common')
  const [state, setState] = useState<UpdateState>('idle')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [showDockerInstructions, setShowDockerInstructions] = useState(false)

  if (!updateAvailable) return null
  if (updateDismissedVersion === updateAvailable.latestVersion) return null

  const deploymentMode = (updateAvailable as { deploymentMode?: string }).deploymentMode

  async function handleUpdate() {
    // Docker deployments cannot self-update from inside the container —
    // show instructions to rebuild on the host instead.
    if (deploymentMode === 'docker') {
      setShowDockerInstructions(prev => !prev)
      return
    }

    setState('updating')
    setErrorMsg(null)

    try {
      const res = await fetch('/api/releases/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetVersion: updateAvailable!.latestVersion }),
      })
      const data = await res.json()

      if (!res.ok) {
        setState('error')
        setErrorMsg(data.error || t('updateFailed'))
        return
      }

      if (data.restartRequired) {
        setState('restarting')
        const poll = setInterval(async () => {
          try {
            const check = await fetch('/api/releases/check', { cache: 'no-store' })
            if (check.ok) { clearInterval(poll); window.location.reload() }
          } catch { /* still restarting */ }
        }, 2000)
        setTimeout(() => { clearInterval(poll); setState('idle'); window.location.reload() }, 120_000)
      } else {
        window.location.reload()
      }
    } catch {
      setState('error')
      setErrorMsg(t('networkError'))
    }
  }

  const isBusy = state === 'updating' || state === 'restarting'

  return (
    <div className="mx-4 mt-3 mb-0 rounded-xl border border-emerald-500/20 bg-emerald-500/8 overflow-hidden">
      {/* Main banner row */}
      <div className="flex items-center gap-3 px-4 py-2.5">
        {/* Pulsing dot */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>

        <p className="flex-1 text-xs text-emerald-300 min-w-0">
          {state === 'updating' && (
            <span className="font-medium text-amber-300">⚙️ {t('updating')}</span>
          )}
          {state === 'restarting' && (
            <span className="font-medium text-amber-300">🔄 {t('restartingServer')}</span>
          )}
          {state === 'error' && (
            <span className="font-medium text-red-300">⚠️ {errorMsg}</span>
          )}
          {state === 'idle' && (
            <>
              <span className="font-semibold text-emerald-200">
                🚀 v{updateAvailable.latestVersion} available
              </span>
            </>
          )}
        </p>

        {!isBusy && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleUpdate}
              className="text-2xs font-semibold text-zinc-950 bg-emerald-500 hover:bg-emerald-400 active:scale-95 px-3 py-1.5 rounded-lg transition-all shadow shadow-emerald-500/20"
            >
              {deploymentMode === 'docker' ? '📋 How to update' : tc('updateNow')}
            </button>
            <a
              href={updateAvailable.releaseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xs font-medium text-emerald-400 hover:text-emerald-300 px-2 py-1.5 rounded-lg border border-emerald-500/20 hover:border-emerald-500/40 transition-colors"
            >
              {tc('viewRelease')}
            </a>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => { dismissUpdate(updateAvailable.latestVersion); setShowDockerInstructions(false) }}
              className="text-emerald-500/40 hover:text-emerald-400 hover:bg-transparent"
              title={tc('dismiss')}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M4 4l8 8M12 4l-8 8" />
              </svg>
            </Button>
          </div>
        )}

        {isBusy && (
          <svg className="w-4 h-4 animate-spin text-amber-400 shrink-0" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v3a5 5 0 00-5 5H4z" />
          </svg>
        )}
      </div>

      {/* Docker update instructions — expands inline */}
      {showDockerInstructions && deploymentMode === 'docker' && (
        <div className="px-4 pb-4 border-t border-emerald-500/15">
          <p className="text-xs text-zinc-400 mb-2 mt-3">
            Run these commands on your server to update:
          </p>
          <div className="bg-zinc-950 rounded-lg border border-zinc-800 p-3 font-mono text-xs space-y-1 select-all">
            <div><span className="text-zinc-600"># Pull latest code</span></div>
            <div><span className="text-emerald-400">cd</span><span className="text-zinc-300"> ~/openclaw-mission-control</span></div>
            <div><span className="text-emerald-400">git pull</span></div>
            <div className="pt-1"><span className="text-zinc-600"># Rebuild and restart</span></div>
            <div><span className="text-emerald-400">docker compose down</span></div>
            <div><span className="text-emerald-400">docker compose up --build -d</span></div>
          </div>
          <button
            onClick={() => setShowDockerInstructions(false)}
            className="mt-2 text-2xs text-zinc-500 hover:text-zinc-400 transition-colors"
          >
            ✕ Close
          </button>
        </div>
      )}
    </div>
  )
}
