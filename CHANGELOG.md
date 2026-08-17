# Changelog

All notable changes to Mission Control are documented in this file.

## [0.4.0] - 2026-08-17 - "pro-minimal" redesign

### Added
- Full visual redesign - a calmer, denser, "pro-minimal" UI built on CSS custom properties, consistent across every page
- Real gateway telemetry on Settings and System pages, read live from `openclaw status --json`: reachability, PID, restarts, latency, active model, agent identity
- Built-in Security Audit card - surfaces `openclaw security audit --json` findings (critical/warn/info) with remediation hints
- Workflows / Automations page - a single, OpenClaw-only view of every scheduled task, no other automation engine required
- Working Quick Actions - restart the gateway or tail its logs from the UI, backed by real systemd calls (correctly scoped between `--user` and system-wide services)

### Fixed
- Password change flow now actually persists and restarts the app for you
- Removed a hardcoded personal hostname from the breadcrumb - now driven by `NEXT_PUBLIC_APP_TITLE`

### Changed
- Every user-facing label (agent name, company, hostname breadcrumb) now comes from `.env.local` - nothing is hardcoded to a specific deployment
- Bumped to Next.js 16

---

## [0.3.0] - 2026-04 to 2026-05

### Added
- System Cron Jobs - new section on the `/cron` page to view and manage the system crontab (add, edit, delete inline with human-readable schedule descriptions)
- Delete button in the Cron Modal - delete any OpenClaw cron job directly from its edit modal
- New API - `GET/POST/PUT/DELETE /api/cron/system` for full system crontab management
- Smart Cron Presets - one-click task profiles: Script directo, Tarea de agente, Respuesta simple, or fully custom
- Inline tooltips on every cron field
- Simplified delivery - single checkbox to route results to Telegram, auto-configured per agent
- Run Now fix - instant manual cron execution from the dashboard
- Weekly Timeline - visual cron schedule across the week
- Cron Templates - 8 pre-built automation templates ready to deploy
- Cron Categories - organize jobs by type (backup, monitoring, content, etc.)

---

For the full backlog of planned work, see [ROADMAP.md](ROADMAP.md).
