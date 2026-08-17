/**
 * Service action API
 * POST /api/system/services
 * Body: { name, backend, action }  action: restart | stop | start | logs
 */
import { NextRequest, NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const ALLOWED_SERVICES_PM2 = ['classvault', 'content-vault', 'postiz-simple', 'brain', 'mission-control'];
// openclaw-gateway runs as a systemd --user unit; caddy runs as a system-wide unit
// (needs sudo, which is passwordless for this operator on this host).
const SYSTEMD_USER_SERVICES = ['openclaw-gateway'];
const SYSTEMD_SYSTEM_SERVICES = ['caddy'];
const ALLOWED_SERVICES_SYSTEMD = [...SYSTEMD_USER_SERVICES, ...SYSTEMD_SYSTEM_SERVICES];
const ALLOWED_DOCKER_IDS_PATTERN = /^[a-f0-9]{6,64}$|^[a-zA-Z0-9_-]+$/;

async function pm2Action(name: string, action: string): Promise<string> {
  if (!ALLOWED_SERVICES_PM2.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    // Get last 100 lines of PM2 logs
    try {
      const logFile = `/root/.pm2/logs/${name}-out.log`;
      const { stdout } = await execAsync(`tail -100 "${logFile}" 2>/dev/null || echo "No logs available"`);
      const errFile = `/root/.pm2/logs/${name}-error.log`;
      const { stdout: errOut } = await execAsync(`tail -50 "${errFile}" 2>/dev/null || echo ""`).catch(() => ({ stdout: '' }));
      return `=== STDOUT (last 100 lines) ===\n${stdout}\n${errOut ? `\n=== STDERR (last 50 lines) ===\n${errOut}` : ''}`;
    } catch {
      return 'Could not retrieve logs';
    }
  }

  const { stdout, stderr } = await execAsync(`pm2 ${action} "${name}" 2>&1`);
  return stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
}

async function systemdAction(name: string, action: string): Promise<string> {
  if (!ALLOWED_SERVICES_SYSTEMD.includes(name)) {
    throw new Error(`Service "${name}" not in allowlist`);
  }
  if (!['restart', 'stop', 'start', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  // openclaw-gateway is a --user unit for this account; caddy is a system-wide
  // unit that needs sudo (passwordless, scoped to systemctl/journalctl only).
  const isUserScope = SYSTEMD_USER_SERVICES.includes(name);
  const systemctlCmd = isUserScope ? 'systemctl --user' : 'sudo -n systemctl';
  const journalctlCmd = isUserScope ? 'journalctl --user' : 'sudo -n journalctl';

  if (action === 'logs') {
    const { stdout } = await execAsync(`${journalctlCmd} -u "${name}" -n 100 --no-pager 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`${systemctlCmd} ${action} "${name}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

async function dockerAction(id: string, action: string): Promise<string> {
  if (!ALLOWED_DOCKER_IDS_PATTERN.test(id)) {
    throw new Error(`Invalid container ID "${id}"`);
  }
  if (!['start', 'stop', 'restart', 'logs'].includes(action)) {
    throw new Error(`Invalid action "${action}"`);
  }

  if (action === 'logs') {
    const { stdout } = await execAsync(`docker logs --tail 100 "${id}" 2>&1`);
    return stdout;
  }

  const { stdout } = await execAsync(`docker ${action} "${id}" 2>&1`);
  return stdout || `${action} executed successfully`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, backend, action } = body;

    if (!name || !backend || !action) {
      return NextResponse.json({ error: 'Missing name, backend or action' }, { status: 400 });
    }

    let output = '';

    switch (backend) {
      case 'pm2':
        output = await pm2Action(name, action);
        break;
      case 'systemd':
        output = await systemdAction(name, action);
        break;
      case 'docker':
        output = await dockerAction(name, action);
        break;
      default:
        return NextResponse.json({ error: `Unknown backend "${backend}"` }, { status: 400 });
    }

    return NextResponse.json({ success: true, output, action, name, backend });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[services API] Error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
