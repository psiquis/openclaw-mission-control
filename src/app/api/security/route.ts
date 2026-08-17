import { NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";

interface SecurityAudit {
  ts?: number;
  summary?: { critical?: number; warn?: number; info?: number };
  findings?: Array<{ checkId?: string; severity?: string; title?: string; detail?: string; remediation?: string }>;
}

let cache: { ts: number; body: unknown } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.ts < 300_000) {
    return NextResponse.json(cache.body);
  }
  const res = await runOpenclaw<SecurityAudit>(["security", "audit", "--json"], 45_000);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  const body = { summary: res.data?.summary || {}, findings: res.data?.findings || [] };
  cache = { ts: Date.now(), body };
  return NextResponse.json(body);
}
