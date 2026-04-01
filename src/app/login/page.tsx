'use client'

import { useCallback, useEffect, useRef, useState, FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { LanguageSwitcherSelect } from '@/components/ui/language-switcher'

interface GoogleCredentialResponse {
  credential?: string
}

interface GoogleAccountsIdApi {
  initialize(config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
  }): void
  prompt(): void
}

interface GoogleApi {
  accounts: {
    id: GoogleAccountsIdApi
  }
}

type LoginRequestBody =
  | { username: string; password: string }
  | { credential?: string }

type LoginErrorPayload = {
  code?: string
  error?: string
  hint?: string
}

function readLoginErrorPayload(value: unknown): LoginErrorPayload {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    code: typeof record.code === 'string' ? record.code : undefined,
    error: typeof record.error === 'string' ? record.error : undefined,
    hint: typeof record.hint === 'string' ? record.hint : undefined,
  }
}

declare global {
  interface Window {
    google?: GoogleApi
  }
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

/** OpenClaw Mission Control logo — inline SVG, no external deps */
function MCLogo({ size = 48 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Outer ring */}
      <circle cx="24" cy="24" r="22" stroke="#10b981" strokeWidth="1.5" strokeOpacity="0.4" />
      {/* Mid ring */}
      <circle cx="24" cy="24" r="16" stroke="#10b981" strokeWidth="1" strokeOpacity="0.25" strokeDasharray="3 3" />
      {/* Center dot */}
      <circle cx="24" cy="24" r="3" fill="#10b981" />
      {/* Radar sweep lines */}
      <line x1="24" y1="24" x2="24" y2="4" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.8" />
      <line x1="24" y1="24" x2="38" y2="14" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeOpacity="0.5" />
      <line x1="24" y1="24" x2="40" y2="30" stroke="#10b981" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.25" />
      {/* Blip dots */}
      <circle cx="24" cy="9" r="1.5" fill="#10b981" />
      <circle cx="35" cy="17" r="1" fill="#10b981" fillOpacity="0.7" />
      <circle cx="15" cy="33" r="1" fill="#34d399" fillOpacity="0.5" />
      {/* Claw marks */}
      <path d="M17 13 C14 15 13 19 15 22" stroke="#6ee7b7" strokeWidth="1.2" strokeLinecap="round" strokeOpacity="0.6" />
      <path d="M19 11 C15 13 14 17 16 20" stroke="#6ee7b7" strokeWidth="1" strokeLinecap="round" strokeOpacity="0.4" />
    </svg>
  )
}

export default function LoginPage() {
  const t = useTranslations('auth')
  const tc = useTranslations('common')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pendingApproval, setPendingApproval] = useState(false)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [googleReady, setGoogleReady] = useState(false)
  const googleCallbackRef = useRef<((response: GoogleCredentialResponse) => void) | null>(null)

  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  useEffect(() => {
    fetch('/api/setup')
      .then((res) => res.json())
      .then((data) => {
        if (data.needsSetup) window.location.href = '/setup'
      })
      .catch(() => {})
  }, [])

  const completeLogin = useCallback(async (path: string, body: LoginRequestBody) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const data = readLoginErrorPayload(await res.json().catch(() => null))
      if (data.code === 'PENDING_APPROVAL') {
        setPendingApproval(true); setNeedsSetup(false); setError(''); setLoading(false); setGoogleLoading(false)
        return false
      }
      if (data.code === 'NO_USERS') {
        setNeedsSetup(true); setError(''); setLoading(false); setGoogleLoading(false)
        return false
      }
      setError(data.error || t('loginFailed'))
      setPendingApproval(false); setNeedsSetup(false); setLoading(false); setGoogleLoading(false)
      return false
    }

    window.location.href = '/'
    return true
  }, [t])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const form = e.target as HTMLFormElement
    const formUsername = (form.elements.namedItem('username') as HTMLInputElement)?.value || username
    const formPassword = (form.elements.namedItem('password') as HTMLInputElement)?.value || password
    try {
      await completeLogin('/api/auth/login', { username: formUsername, password: formPassword })
    } catch {
      setError(t('networkError'))
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!googleClientId) return
    const onScriptLoad = () => {
      if (!window.google) return
      googleCallbackRef.current = async (response: GoogleCredentialResponse) => {
        setError('')
        setGoogleLoading(true)
        try {
          const ok = await completeLogin('/api/auth/google', { credential: response?.credential })
          if (!ok) return
        } catch {
          setError(t('googleSignInFailed'))
          setGoogleLoading(false)
        }
      }
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response: GoogleCredentialResponse) => googleCallbackRef.current?.(response),
      })
      setGoogleReady(true)
    }
    const existing = document.querySelector('script[data-google-gsi="1"]') as HTMLScriptElement | null
    if (existing) { if (window.google) onScriptLoad(); return }
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true; script.defer = true
    script.setAttribute('data-google-gsi', '1')
    script.onload = onScriptLoad
    script.onerror = () => setError(t('googleSignInFailed'))
    document.head.appendChild(script)
  }, [googleClientId, completeLogin, t])

  const handleGoogleSignIn = () => {
    if (!window.google || !googleReady) return
    window.google.accounts.id.prompt()
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-zinc-950">

      {/* ── Background glow orbs ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-3xl"
          style={{ animation: 'pulse 6s ease-in-out infinite' }}
        />
        <div
          className="absolute -bottom-40 -right-40 h-[400px] w-[400px] rounded-full bg-violet-600/10 blur-3xl"
          style={{ animation: 'pulse 8s ease-in-out infinite', animationDelay: '2s' }}
        />
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-emerald-900/20 blur-3xl"
          style={{ animation: 'pulse 10s ease-in-out infinite', animationDelay: '1s' }}
        />
      </div>

      {/* ── Grid texture overlay ── */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage: 'linear-gradient(#10b981 1px, transparent 1px), linear-gradient(90deg, #10b981 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── Language switcher ── */}
      <div className="absolute top-4 right-4 z-20">
        <LanguageSwitcherSelect />
      </div>

      {/* ── Card ── */}
      <div className="relative z-10 w-full max-w-sm mx-4">
        <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 backdrop-blur-xl shadow-2xl shadow-black/50 p-8">

          {/* ── Logo + heading ── */}
          <div className="flex flex-col items-center mb-8">
            {/* Glow ring behind logo */}
            <div className="relative mb-4">
              <div className="absolute inset-0 rounded-full bg-emerald-500/20 blur-xl scale-150" />
              <div className="relative w-16 h-16 rounded-2xl bg-zinc-950 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                <MCLogo size={42} />
              </div>
              {/* Status dot */}
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-zinc-900 shadow shadow-emerald-500/50" />
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white">
              Mission Control
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              {t('signInToContinue')}
            </p>

            {/* Decorative separator */}
            <div className="mt-4 flex items-center gap-1.5">
              <div className="h-px w-8 bg-gradient-to-r from-transparent to-emerald-500/50" />
              <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <div className="w-1 h-1 rounded-full bg-emerald-500/60" />
              <div className="h-px w-8 bg-gradient-to-l from-transparent to-emerald-500/50" />
            </div>
          </div>

          {/* ── Pending approval ── */}
          {pendingApproval && (
            <div className="mb-5 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
              <div className="text-2xl mb-2">⏳</div>
              <div className="text-sm font-medium text-amber-200">{t('accessRequestSubmitted')}</div>
              <p className="text-xs text-zinc-400 mt-1">{t('accessRequestDescription')}</p>
              <Button
                onClick={() => { setPendingApproval(false); setError(''); setGoogleLoading(false) }}
                variant="ghost"
                size="sm"
                className="mt-3 text-xs text-amber-400 hover:text-amber-300"
              >
                {t('tryAgain')}
              </Button>
            </div>
          )}

          {/* ── Needs setup ── */}
          {needsSetup && (
            <div className="mb-5 p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
              <div className="text-2xl mb-2">🔧</div>
              <div className="text-sm font-medium text-blue-200">{t('noAdminAccount')}</div>
              <p className="text-xs text-zinc-400 mt-1">{t('noAdminDescription')}</p>
              <Button
                onClick={() => { window.location.href = '/setup' }}
                size="sm"
                className="mt-3 bg-blue-500 hover:bg-blue-400 text-white"
              >
                {t('createAdminAccount')}
              </Button>
            </div>
          )}

          {/* ── Error ── */}
          {error && (
            <div role="alert" className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-sm text-red-300">
              <svg className="w-4 h-4 shrink-0 text-red-400" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="8" cy="8" r="7" />
                <path d="M8 5v3.5M8 11v.5" />
              </svg>
              {error}
            </div>
          )}

          {/* ── Google Sign-In ── */}
          {googleClientId && (
            <div className={pendingApproval ? 'opacity-50 pointer-events-none' : ''}>
              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={!googleReady || googleLoading || loading}
                className="w-full h-10 flex items-center justify-center gap-3 rounded-xl border border-zinc-700 bg-white text-[#3c4043] text-sm font-medium hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {googleLoading ? (
                  <><div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />{t('signingIn')}</>
                ) : (
                  <><GoogleIcon className="w-[18px] h-[18px]" />{t('signInWithGoogle')}</>
                )}
              </button>
              {!googleReady && (
                <p className="text-center text-xs text-zinc-500 mt-2">{t('loadingGoogleSignIn')}</p>
              )}
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-zinc-800" />
                <span className="text-xs text-zinc-600">{tc('or')}</span>
                <div className="h-px flex-1 bg-zinc-800" />
              </div>
            </div>
          )}

          {/* ── Credentials form ── */}
          <form onSubmit={handleSubmit} className={`space-y-4 ${pendingApproval ? 'opacity-50 pointer-events-none' : ''}`}>
            <div>
              <label htmlFor="username" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                {t('username')}
              </label>
              <input
                id="username"
                name="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                placeholder={t('enterUsername')}
                autoComplete="username"
                autoFocus
                required
                aria-required="true"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-zinc-400 mb-1.5 uppercase tracking-wider">
                {t('password')}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-10 px-3 rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white text-sm placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
                placeholder={t('enterPassword')}
                autoComplete="current-password"
                required
                aria-required="true"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-emerald-500 hover:bg-emerald-400 active:scale-[0.98] text-zinc-950 font-semibold text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/25 mt-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-zinc-900/30 border-t-zinc-900 rounded-full animate-spin" />
                  {t('signingIn')}
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 8h10M9 4l4 4-4 4" />
                  </svg>
                  {t('signIn')}
                </>
              )}
            </button>
          </form>

          {/* ── Footer tagline ── */}
          <div className="mt-6 pt-5 border-t border-zinc-800/60 flex items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-center text-xs text-zinc-600">{t('orchestrationTagline')}</p>
          </div>
        </div>

        {/* ── Version hint below card ── */}
        <p className="text-center text-xs text-zinc-700 mt-4">
          OpenClaw Mission Control
        </p>
      </div>
    </div>
  )
}
