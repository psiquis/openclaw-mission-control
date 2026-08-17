import { NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";

interface ChannelsStatus {
  channels?: Record<string, { ok?: boolean; state?: string; detail?: string; accounts?: Array<{ accountId?: string; ok?: boolean; state?: string; detail?: string }> }>;
  eventLoop?: { degraded?: boolean; reasons?: string[] };
  [k: string]: unknown;
}
interface ModelsStatus {
  defaultModel?: string;
  auth?: { missingProvidersInUse?: string[]; providers?: Array<{ provider?: string; status?: string; detail?: string; expiresAt?: number }> };
  [k: string]: unknown;
}

let cache: { ts: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.ts < 30_000) {
    return NextResponse.json(cache.body);
  }
  const [channels, models] = await Promise.all([
    runOpenclaw<ChannelsStatus>(["channels", "status", "--json"], 25_000),
    runOpenclaw<ModelsStatus>(["models", "status", "--json"], 30_000),
  ]);
  const body = {
    channels: channels.ok ? channels.data ?? null : null,
    models: models.ok ? models.data ?? null : null,
    errors: [channels.error, models.error].filter(Boolean),
  };
  cache = { ts: Date.now(), body };
  return NextResponse.json(body);
}
