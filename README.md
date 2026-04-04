<div align="center">

# Mission Control

### The definitive open-source dashboard for managing OpenClaw AI agent fleets

[![Next.js](https://img.shields.io/badge/Next.js-15-000?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org)
[![SQLite](https://img.shields.io/badge/SQLite-WAL-003B57?logo=sqlite)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-6366F1)](LICENSE)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-2026.4+-000?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmYiIHN0cm9rZS13aWR0aD0iMiI+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiLz48L3N2Zz4=)](https://github.com/openclaw/openclaw)

**Monitor agents · Manage skills · Schedule automation · Track everything**

</div>

---

## Overview

Mission Control is a self-hosted Next.js dashboard designed to manage [OpenClaw](https://github.com/openclaw/openclaw) AI agent deployments. It provides real-time visibility into your agent fleet, skill management, cron scheduling, session history, system monitoring, and more — all from a single, clean interface.

Built for teams and solo operators running multi-agent OpenClaw setups on Linux servers, Raspberry Pis, or VPS instances.

---

## Screenshots

<table>
<tr>
<td width="50%">

**Dashboard**
![Dashboard](docs/screenshots/dashboard.png)

</td>
<td width="50%">

**Agents**
![Agents](docs/screenshots/agents.png)

</td>
</tr>
<tr>
<td>

**Skills Management**
![Skills](docs/screenshots/skills.png)

</td>
<td>

**Skill Templates**
![Skill Templates](docs/screenshots/skill-templates.png)

</td>
</tr>
<tr>
<td>

**Cron Jobs**
![Cron](docs/screenshots/cron.png)

</td>
<td>

**Cron Templates**
![Cron Templates](docs/screenshots/cron-templates.png)

</td>
</tr>
<tr>
<td>

**Sessions**
![Sessions](docs/screenshots/sessions.png)

</td>
<td>

**File Browser**
![Files](docs/screenshots/files.png)

</td>
</tr>
<tr>
<td>

**Memory Search**
![Memory](docs/screenshots/memory.png)

</td>
<td>

&nbsp;

</td>
</tr>
</table>

---

## Features

### Agent Fleet Management
- Multi-agent overview with status, models, and configuration
- Per-agent workspace browsing and memory search
- Agent organigram visualization

### Skill Operating System
- **Skill Registry** — SQLite-backed inventory with automatic risk assessment, category detection, and file scanning
- **Skill Detail View** — SKILL.md preview, file tree, agent assignment, invocation history, and configuration
- **Skill Templates** — 7 built-in templates (basic, exec, stateful, automation, API, workflow, monitoring) with guided wizard for creating standardized skills
- **Risk Assessment** — Automatic detection of `sudo`, `rm -rf`, elevated commands, and secrets references

### Cron Scheduling
- Full CRUD for OpenClaw cron jobs via the gateway CLI
- Weekly timeline visualization
- **Cron Templates** — 8 pre-configured job templates (backups, health checks, cleanups, reporting) ready to deploy with one click
- Create, edit, and delete custom cron templates
- Human-readable schedule descriptions

### System Monitoring
- Real-time CPU, RAM, and disk usage
- Service status (systemd, Ollama, proxies)
- Hardware and software inventory

### Session History
- Browse all agent sessions (main, cron, sub-agents, chats)
- Token usage tracking per session
- Filter by agent, type, and date

### Additional Features
- **File Browser** — Navigate and edit workspace files with Monaco editor
- **Memory Search** — Semantic search across agent memory databases
- **Activity Feed** — Real-time activity stream with type filtering
- **Git Integration** — Repository status and recent commits
- **Analytics** — Usage patterns and activity heatmaps
- **Live Logs** — Real-time log streaming
- **Terminal** — Web-based terminal access
- **Search** — Global search across files, memory, and sessions
- **Quick Actions** — One-click system operations
- **PWA Support** — Installable as a Progressive Web App

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org) 22+
- [OpenClaw](https://github.com/openclaw/openclaw) installed and running
- Linux/macOS (tested on Ubuntu 24.04)

### Install

```bash
git clone https://github.com/psiquis/openclaw-mission-control.git
cd openclaw-mission-control
npm install
```

### Configure

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Required
ADMIN_PASSWORD=your-secure-password
AUTH_SECRET=$(openssl rand -base64 32)
OPENCLAW_DIR=/home/your-user/.openclaw

# Optional — Branding
NEXT_PUBLIC_AGENT_NAME=Mission Control
NEXT_PUBLIC_COMPANY_NAME=Your Company
NEXT_PUBLIC_APP_TITLE=Mission Control
```

### Run

```bash
# Development
npm run dev

# Production
npm run build
npm run start
```

Open `http://localhost:3000` and log in with your `ADMIN_PASSWORD`.

### Docker

```bash
docker build -t mission-control .
docker run -d \
  -p 3000:3000 \
  -v /home/your-user/.openclaw:/root/.openclaw:ro \
  -e ADMIN_PASSWORD=your-password \
  -e AUTH_SECRET=$(openssl rand -base64 32) \
  mission-control
```

---

## Architecture

```
mission-control/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (dashboard)/        # All dashboard pages
│   │   │   ├── skills/         # Skill management + templates
│   │   │   ├── cron/           # Cron jobs + templates
│   │   │   ├── agents/         # Agent fleet overview
│   │   │   ├── system/         # System monitoring
│   │   │   ├── sessions/       # Session history
│   │   │   ├── files/          # File browser
│   │   │   ├── memory/         # Memory search
│   │   │   └── ...             # Other pages
│   │   ├── api/                # API routes
│   │   │   ├── skills/         # Skill CRUD + scan + stats
│   │   │   ├── templates/      # Skill template engine
│   │   │   ├── cron/           # Cron CRUD + templates
│   │   │   ├── agents/         # Agent status
│   │   │   ├── system/         # System metrics
│   │   │   └── ...             # Other APIs
│   │   └── login/              # Authentication
│   ├── components/             # React components
│   ├── lib/                    # Business logic
│   │   ├── skills-db.ts        # Skill registry (SQLite)
│   │   ├── skill-parser.ts     # SKILL.md frontmatter parser
│   │   ├── template-engine.ts  # Skill generation from templates
│   │   ├── cron-templates-db.ts # Cron template persistence
│   │   └── ...
│   └── config/                 # Branding configuration
├── data/                       # SQLite databases (auto-created)
│   ├── skills.db               # Skill registry + invocations
│   ├── cron-templates.db       # Cron template storage
│   └── activities.db           # Activity log
├── public/                     # Static assets
└── docs/                       # Documentation + screenshots
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS 4 + CSS Variables |
| Database | SQLite via better-sqlite3 (WAL mode) |
| Icons | Lucide React |
| Charts | Recharts |
| Editor | Monaco Editor |
| Fonts | Inter + Sora + JetBrains Mono |

### Data Flow

```
Browser ←→ Next.js API Routes ←→ OpenClaw CLI / SQLite / Filesystem
                                       ↓
                              OpenClaw Gateway (agents, cron, sessions)
```

Mission Control reads from and writes to:
- `~/.openclaw/openclaw.json` — Agent and skill configuration
- `~/.openclaw/cron/jobs.json` — Cron job definitions (via `openclaw cron` CLI)
- `~/.openclaw/agents/` — Agent session data
- `~/.openclaw/workspace/` — Agent workspaces
- `~/.openclaw/skills/` — Custom skills
- `~/.openclaw/memory/` — Agent memory databases
- `data/skills.db` — Local skill registry with metadata, risk assessment, invocations
- `data/cron-templates.db` — Custom cron job templates

---

## Customization

### Branding

All branding is configured via environment variables — no code changes needed:

```env
NEXT_PUBLIC_AGENT_NAME=My Dashboard
NEXT_PUBLIC_COMPANY_NAME=My Company
NEXT_PUBLIC_APP_TITLE=Control Center
NEXT_PUBLIC_OWNER_USERNAME=admin
```

### Design System

The design system uses CSS custom properties defined in `src/app/globals.css`. Override any variable to customize:

```css
:root {
  --accent: #6366F1;       /* Primary accent (indigo) */
  --bg: #09090B;           /* Background */
  --surface: #111113;      /* Card surfaces */
  --border: #1F1F23;       /* Borders */
  --text-primary: #FAFAFA; /* Primary text */
}
```

---

## Contributing

Contributions are welcome. Please open an issue first to discuss what you'd like to change.

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'Add my feature'`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---

## License

MIT — see [LICENSE](LICENSE) for details.

---

<div align="center">

Built for [OpenClaw](https://github.com/openclaw/openclaw) · Made by [OpenCloud](https://github.com/psiquis)

</div>
