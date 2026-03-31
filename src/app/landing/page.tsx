'use client'

import Link from 'next/link'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-zinc-950 text-white" style={{ scrollBehavior: 'smooth' }}>

      {/* ── Nav ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-zinc-800/60 bg-zinc-950/80 backdrop-blur-md">
        <div className="mx-auto max-w-7xl flex items-center justify-between px-4 sm:px-6 h-14">
          <span className="text-base sm:text-lg font-bold tracking-tight text-white">
            ⚡ OpenClaw Mission Control
          </span>
          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://github.com/psiquis/openclaw-mission-control"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-zinc-400 hover:text-white transition-colors"
            >
              ⭐ Star on GitHub
            </a>
            <Link
              href="/setup"
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-semibold transition-colors"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 text-center pt-14">
        {/* Background orbs */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="animate-pulse absolute -top-32 -left-32 h-96 w-96 rounded-full bg-emerald-500/20 blur-3xl"
            style={{ animationDuration: '4s' }}
          />
          <div
            className="animate-pulse absolute top-1/3 -right-48 h-[28rem] w-[28rem] rounded-full bg-violet-600/15 blur-3xl"
            style={{ animationDuration: '6s', animationDelay: '1s' }}
          />
          <div
            className="animate-pulse absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-400/10 blur-3xl"
            style={{ animationDuration: '5s', animationDelay: '2s' }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-4xl mx-auto">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs sm:text-sm font-medium text-emerald-400">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Open-source · Self-hosted · Production ready
          </div>

          <h1 className="mb-6 text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.08]">
            Your AI Agent Fleet,{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-violet-500 bg-clip-text text-transparent">
              Under Control
            </span>
          </h1>

          <p className="mb-10 max-w-2xl mx-auto text-base sm:text-lg text-zinc-400 leading-relaxed">
            Open-source orchestration dashboard for AI agent fleets. Manage tasks, track costs,
            monitor security — all from one self-hosted dashboard.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            <a
              href="https://github.com/psiquis/openclaw-mission-control"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-bold transition-all hover:scale-105 shadow-lg shadow-emerald-500/25"
            >
              ⭐ Star on GitHub
            </a>
            <Link
              href="/setup"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border border-zinc-700 hover:border-zinc-500 bg-zinc-900 hover:bg-zinc-800 text-white text-sm font-semibold transition-all hover:scale-105"
            >
              → Launch Dashboard
            </Link>
          </div>

          {/* Badge row */}
          <div className="flex flex-wrap justify-center gap-2 mb-12">
            {['MIT License', 'Next.js 16', 'React 19', 'SQLite', 'Zero Config'].map((b) => (
              <span
                key={b}
                className="px-3 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-xs text-zinc-400"
              >
                {b}
              </span>
            ))}
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-2xl mx-auto">
            {[
              { value: '32+', label: 'Panels' },
              { value: '101', label: 'API Routes' },
              { value: '6', label: 'Framework Adapters' },
              { value: '0', label: 'External Deps' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl bg-zinc-900/60 border border-zinc-800 p-4">
                <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{s.value}</div>
                <div className="text-xs text-zinc-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-zinc-600 text-xs animate-bounce">
          ↓ scroll
        </div>
      </section>

      {/* ── Feature Grid ── */}
      <section className="py-24 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">Everything You Need</h2>
            <p className="text-zinc-400 max-w-xl mx-auto">
              32+ specialized panels purpose-built for AI agent orchestration — no glue code required.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                icon: '🎯',
                title: 'Kanban Task Board',
                desc: 'Visualize task pipelines across agents with drag-and-drop Kanban lanes. Auto-dispatch work to available agents based on capacity and skills.',
              },
              {
                icon: '🤖',
                title: 'Agent Fleet Manager',
                desc: 'Register, monitor, and control every agent in your fleet from one place. Set capacity limits, view health status, and manage lifecycle events.',
              },
              {
                icon: '🧠',
                title: 'Memory Knowledge Graph',
                desc: 'Persistent structured memory across all agents with cross-session recall. Build a living knowledge graph that grows smarter over time.',
              },
              {
                icon: '💰',
                title: 'Cost & Token Tracking',
                desc: 'Real-time token burn rates, cost breakdowns by agent and model, and budget alerts. Keep your AI spend transparent and under control.',
              },
              {
                icon: '🔐',
                title: 'Security Audit',
                desc: 'Full audit trail of agent actions, API calls, and permission changes. Detect anomalies and enforce least-privilege policies with ease.',
              },
              {
                icon: '⏰',
                title: 'Cron Scheduler',
                desc: 'Schedule recurring agent tasks with cron expressions and visual calendars. Trigger workflows on any cadence with retry and failure handling.',
              },
              {
                icon: '📁',
                title: 'Projects Panel',
                desc: 'Organize agents and tasks into projects with dedicated scopes and permissions. Multi-tenant ready for teams managing multiple AI workstreams.',
              },
              {
                icon: '🗓️',
                title: 'Weekly Schedule',
                desc: 'Calendar view of all scheduled agent activity across the week. Identify bottlenecks and rebalance workloads at a glance.',
              },
              {
                icon: '🔧',
                title: 'Skills Hub',
                desc: 'Register reusable agent skills and tool definitions in a central registry. Version, test, and share capabilities across your fleet.',
              },
              {
                icon: '📡',
                title: 'Live AI Status',
                desc: 'Real-time uptime and latency for OpenAI, Anthropic, Gemini, and more. Get ahead of provider incidents before they impact your agents.',
              },
              {
                icon: '🔗',
                title: 'Webhooks & Alerts',
                desc: 'Fire outbound webhooks on task events, cost thresholds, and agent status changes. Integrate with Slack, PagerDuty, or any HTTP endpoint.',
              },
              {
                icon: '🏗️',
                title: 'Pipeline Orchestration',
                desc: 'Chain agents into multi-step pipelines with conditional branching and parallel execution. Compose complex workflows without writing orchestration code.',
              },
            ].map((card) => (
              <div
                key={card.title}
                className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-emerald-500/50 transition-colors group"
              >
                <div className="text-3xl mb-3">{card.icon}</div>
                <h3 className="text-base font-bold mb-2 text-white group-hover:text-emerald-400 transition-colors">
                  {card.title}
                </h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-4 sm:px-6 border-t border-zinc-800/60">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">How It Works</h2>
            <p className="text-zinc-400">Up and running in under 60 seconds.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {[
              {
                n: '1',
                title: 'Clone & Install',
                desc: 'One command gets the server running with zero mandatory configuration.',
              },
              {
                n: '2',
                title: 'Agents Register',
                desc: 'Agents join via the gateway, CLI, REST API, or MCP server interface.',
              },
              {
                n: '3',
                title: 'Tasks Flow',
                desc: 'Kanban board surfaces queued work; agents auto-claim by capacity.',
              },
              {
                n: '4',
                title: 'Monitor & Scale',
                desc: 'Real-time dashboards reveal cost, health, and throughput across your fleet.',
              },
            ].map((step, i) => (
              <div key={step.n} className="relative flex flex-col items-center text-center">
                {i < 3 && (
                  <div className="hidden lg:block absolute top-5 left-[calc(50%+2rem)] right-[-50%] h-px border-t border-dashed border-zinc-700" />
                )}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500/10 border border-emerald-500/40 text-emerald-400 font-bold text-sm mb-4 z-10">
                  {step.n}
                </div>
                <h3 className="font-bold text-white mb-2">{step.title}</h3>
                <p className="text-sm text-zinc-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Framework Adapters ── */}
      <section className="py-16 px-4 sm:px-6 border-t border-zinc-800/60">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Works With Your Stack</h2>
          <p className="text-zinc-400 text-sm mb-8">
            First-class adapters for the most popular agent frameworks.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {['OpenClaw', 'CrewAI', 'LangGraph', 'AutoGen', 'Claude SDK', 'Generic'].map((fw) => (
              <span
                key={fw}
                className="px-4 py-2 rounded-full bg-zinc-900 border border-zinc-700 text-sm font-medium text-zinc-300 hover:border-violet-500/60 hover:text-violet-300 transition-colors cursor-default"
              >
                {fw}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Tech Stack ── */}
      <section className="py-16 px-4 sm:px-6 border-t border-zinc-800/60">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-2xl sm:text-3xl font-extrabold mb-2">Built on Solid Foundations</h2>
          <p className="text-zinc-400 text-sm mb-8">
            Modern, battle-tested libraries — no surprise dependencies.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              'Next.js 16',
              'React 19',
              'TypeScript 5.7',
              'SQLite + WAL',
              'Zustand 5',
              'Recharts 3',
              'WebSocket + SSE',
              'Zod 4',
              'Vitest + Playwright',
            ].map((tech) => (
              <div
                key={tech}
                className="flex items-center gap-2 rounded-lg bg-zinc-900 border border-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-300"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Quick Start ── */}
      <section className="py-24 px-4 sm:px-6 border-t border-zinc-800/60">
        <div className="mx-auto max-w-3xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl sm:text-4xl font-extrabold mb-3">Quick Start</h2>
            <p className="text-zinc-400">Clone, install, and run — 30 seconds to your first dashboard.</p>
          </div>

          <div className="rounded-xl bg-zinc-900 border border-zinc-800 overflow-hidden">
            {/* Code block header */}
            <div className="flex items-center gap-1.5 px-4 py-3 border-b border-zinc-800 bg-zinc-950/60">
              <span className="h-3 w-3 rounded-full bg-red-500/70" />
              <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
              <span className="h-3 w-3 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-zinc-500 font-mono">terminal</span>
            </div>
            <pre className="p-5 sm:p-6 text-sm font-mono leading-relaxed overflow-x-auto">
              <code>
                <span className="text-zinc-500"># Clone and start in 30 seconds{'\n'}</span>
                <span className="text-emerald-400">git clone </span>
                <span className="text-white">https://github.com/psiquis/openclaw-mission-control{'\n'}</span>
                <span className="text-emerald-400">cd </span>
                <span className="text-white">
                  openclaw-mission-control{' '}
                </span>
                <span className="text-zinc-500">&amp;&amp;</span>
                <span className="text-emerald-400"> pnpm install </span>
                <span className="text-zinc-500">&amp;&amp;</span>
                <span className="text-emerald-400"> pnpm dev{'\n\n'}</span>
                <span className="text-zinc-500"># Or with Docker{'\n'}</span>
                <span className="text-emerald-400">docker compose up</span>
              </code>
            </pre>
          </div>

          <p className="text-center text-sm text-zinc-500 mt-4">
            Requires Node.js &ge; 22 and pnpm. Visit{' '}
            <code className="text-emerald-400 text-xs">http://localhost:3000/setup</code>{' '}
            to create your admin account.
          </p>
        </div>
      </section>

      {/* ── Star CTA ── */}
      <section className="py-28 px-4 sm:px-6 border-t border-zinc-800/60">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-5xl mb-6">⭐</div>
          <h2 className="text-3xl sm:text-4xl font-extrabold mb-4">Love what you see?</h2>
          <p className="text-zinc-400 text-base sm:text-lg mb-10 leading-relaxed">
            Give us a star on GitHub — it helps the project grow and motivates continued
            development. Every star counts.
          </p>
          <a
            href="https://github.com/psiquis/openclaw-mission-control"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2.5 px-8 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-base font-bold transition-all hover:scale-105 shadow-2xl shadow-emerald-500/30"
          >
            ⭐ Star on GitHub
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-800/60 py-8 px-4 sm:px-6">
        <div className="mx-auto max-w-7xl flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-zinc-500">
          <span>MIT License &bull; 2026 &bull; OpenClaw Mission Control</span>
          <a
            href="https://github.com/psiquis/openclaw-mission-control"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GitHub →
          </a>
        </div>
      </footer>

    </div>
  )
}
