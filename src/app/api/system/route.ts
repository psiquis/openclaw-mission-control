import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';

import { OPENCLAW_WORKSPACE } from '@/lib/paths';
import { runOpenclaw } from '@/lib/openclaw-cli';

const WORKSPACE_PATH = OPENCLAW_WORKSPACE;
const ENV_LOCAL_PATH = path.join(process.cwd(), '.env.local');
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

interface StatusJson {
  runtimeVersion?: string;
  gateway?: {
    reachable?: boolean;
    connectLatencyMs?: number;
  };
  gatewayService?: {
    runtime?: {
      status?: string;
      state?: string;
      pid?: number | null;
      systemd?: { nRestarts?: number };
    };
    layout?: { packageVersion?: string };
  };
  memoryPlugin?: { enabled?: boolean; slot?: string };
  agents?: {
    defaultId?: string;
    agents?: Array<{ id: string; name?: string }>;
  };
}

interface SecurityFinding {
  checkId: string;
  severity: 'critical' | 'warn' | 'info';
  title: string;
  detail?: string;
  remediation?: string;
}

interface SecurityAudit {
  summary?: { critical: number; warn: number; info: number };
  findings?: SecurityFinding[];
}

function sevRank(s: string): number {
  return s === 'critical' ? 0 : s === 'warn' ? 1 : 2;
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (parts.length === 0) parts.push(`${Math.floor(seconds)}s`);

  return parts.join(' ');
}

async function checkOllama(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${OLLAMA_BASE_URL}/api/tags`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

function getTelegramInfo(): { enabled: boolean; accounts: number } {
  try {
    const openclawConfigPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    const cfg = JSON.parse(fs.readFileSync(openclawConfigPath, 'utf-8'));
    const telegramConfig = cfg?.channels?.telegram;
    const accounts = telegramConfig?.accounts ? Object.keys(telegramConfig.accounts).length : 0;
    return { enabled: !!telegramConfig?.enabled, accounts };
  } catch {
    return { enabled: false, accounts: 0 };
  }
}

async function getActiveModel(): Promise<string> {
  const res = await runOpenclaw<string>(['config', 'get', 'agents.defaults.model.primary']);
  if (res.ok) {
    const text = (res.raw || '').trim();
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed === 'string') return parsed;
    } catch {
      // not JSON — strip surrounding quotes if present
    }
    return text.replace(/^"|"$/g, '') || 'desconocido';
  }
  return 'desconocido';
}

export async function GET() {
  const [statusRes, securityRes, model, ollamaUp, telegram] = await Promise.all([
    runOpenclaw<StatusJson>(['status', '--json']),
    runOpenclaw<SecurityAudit>(['security', 'audit', '--json']),
    getActiveModel(),
    checkOllama(),
    Promise.resolve(getTelegramInfo()),
  ]);

  const status = statusRes.ok ? statusRes.data ?? null : null;
  const security = securityRes.ok ? securityRes.data ?? null : null;

  const mainAgent =
    status?.agents?.agents?.find((a) => a.id === status?.agents?.defaultId) ??
    status?.agents?.agents?.[0] ??
    null;

  const gwSvc = status?.gatewayService ?? null;
  const gw = status?.gateway ?? null;

  const integrations = [
    {
      id: 'telegram',
      name: 'Telegram',
      status: telegram.enabled ? 'connected' : 'disconnected',
      icon: 'MessageCircle',
      detail: telegram.enabled
        ? `${telegram.accounts} bot${telegram.accounts === 1 ? '' : 's'} configurados`
        : 'Canal no habilitado',
    },
    {
      id: 'ollama',
      name: 'Ollama (modelos locales)',
      status: ollamaUp ? 'connected' : 'disconnected',
      icon: 'Cpu',
      detail: ollamaUp ? `Responde en ${OLLAMA_BASE_URL}` : `Sin respuesta en ${OLLAMA_BASE_URL}`,
    },
    {
      id: 'memory',
      name: 'Memoria (memory-core)',
      status: status?.memoryPlugin?.enabled ? 'connected' : 'disconnected',
      icon: 'Brain',
      detail: status?.memoryPlugin?.enabled ? 'Dreaming y promoción a MEMORY.md activos' : 'Plugin no activo',
    },
  ];

  const systemInfo = {
    agent: {
      name: mainAgent?.name || null,
      id: mainAgent?.id || 'main',
    },
    system: {
      missionControlUptimeFormatted: formatUptime(process.uptime()),
      nodeVersion: process.version,
      workspacePath: WORKSPACE_PATH,
      platform: os.platform(),
      hostname: os.hostname(),
      memory: {
        total: os.totalmem(),
        free: os.freemem(),
        used: os.totalmem() - os.freemem(),
      },
    },
    gateway: gwSvc
      ? {
          reachable: !!gw?.reachable,
          status: gwSvc.runtime?.status || 'unknown',
          state: gwSvc.runtime?.state || 'unknown',
          pid: gwSvc.runtime?.pid ?? null,
          restarts: gwSvc.runtime?.systemd?.nRestarts ?? 0,
          version: gwSvc.layout?.packageVersion || status?.runtimeVersion || null,
          latencyMs: gw?.connectLatencyMs ?? null,
          model,
        }
      : null,
    security: security
      ? {
          summary: security.summary || { critical: 0, warn: 0, info: 0 },
          findings: (security.findings || [])
            .filter((f) => f.severity !== 'info')
            .sort((a, b) => sevRank(a.severity) - sevRank(b.severity))
            .slice(0, 6),
        }
      : null,
    integrations,
    timestamp: new Date().toISOString(),
  };

  return NextResponse.json(systemInfo);
}

export async function POST(request: Request) {
  try {
    const { action, data } = await request.json();

    if (action === 'change_password') {
      const { currentPassword, newPassword } = data;

      let envContent = '';
      try {
        envContent = fs.readFileSync(ENV_LOCAL_PATH, 'utf-8');
      } catch {
        return NextResponse.json({ error: 'No se pudo leer la configuración' }, { status: 500 });
      }

      const currentPassMatch = envContent.match(/^ADMIN_PASSWORD=(.*)$/m);
      const storedPassword = currentPassMatch?.[1]?.trim();

      if (storedPassword !== currentPassword) {
        return NextResponse.json({ error: 'La contraseña actual no es correcta' }, { status: 401 });
      }

      const newEnvContent = /^ADMIN_PASSWORD=.*$/m.test(envContent)
        ? envContent.replace(/^ADMIN_PASSWORD=.*$/m, `ADMIN_PASSWORD=${newPassword}`)
        : `${envContent.replace(/\n?$/, '\n')}ADMIN_PASSWORD=${newPassword}\n`;

      fs.writeFileSync(ENV_LOCAL_PATH, newEnvContent);

      // Next.js only reads .env.local at process start, so the running server
      // needs a restart for the new value to take effect. Respond first, then
      // restart shortly after so this response has time to reach the client.
      exec('sleep 1 && PATH="$HOME/.npm-global/bin:$PATH" pm2 restart mission-control', () => {});

      return NextResponse.json({
        success: true,
        restarting: true,
        message: 'Contraseña actualizada. El panel se reiniciará en unos segundos para aplicar el cambio.',
      });
    }

    if (action === 'clear_activity_log') {
      const activitiesPath = path.join(process.cwd(), 'data', 'activities.json');
      fs.writeFileSync(activitiesPath, '[]');
      return NextResponse.json({ success: true, message: 'Registro de actividad borrado' });
    }

    return NextResponse.json({ error: 'Acción desconocida' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'La acción ha fallado' }, { status: 500 });
  }
}
