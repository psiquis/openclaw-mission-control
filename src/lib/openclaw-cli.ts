import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const BIN = process.env.OPENCLAW_BIN || "openclaw";

export interface CliResult<T = unknown> {
  ok: boolean;
  data?: T;
  raw?: string;
  error?: string;
}

/**
 * Ejecuta un subcomando de openclaw y parsea la salida JSON.
 * Nunca pasa por shell: args como array.
 */
export async function runOpenclaw<T = unknown>(
  args: string[],
  timeoutMs = 30_000
): Promise<CliResult<T>> {
  try {
    const { stdout } = await execFileAsync(BIN, args, {
      timeout: timeoutMs,
      maxBuffer: 16 * 1024 * 1024,
      env: { ...process.env, NO_COLOR: "1" },
    });
    const text = stdout.trim();
    try {
      return { ok: true, data: JSON.parse(text) as T, raw: text };
    } catch {
      // El comando no devolvio JSON puro: intenta extraer el primer bloque JSON
      const start = text.indexOf("{");
      const startArr = text.indexOf("[");
      const idx = start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
      if (idx >= 0) {
        try {
          return { ok: true, data: JSON.parse(text.slice(idx)) as T, raw: text };
        } catch { /* cae al raw */ }
      }
      return { ok: true, raw: text };
    }
  } catch (err) {
    const e = err as { stdout?: string; stderr?: string; message?: string };
    return {
      ok: false,
      error: (e.stderr || e.stdout || e.message || "openclaw CLI error").toString().slice(0, 4000),
    };
  }
}
