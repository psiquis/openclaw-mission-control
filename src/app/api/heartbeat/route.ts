import { NextResponse } from "next/server";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { runOpenclaw } from "@/lib/openclaw-cli";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || join(homedir(), ".openclaw", "workspace");

export async function GET() {
  const hbPath = join(WORKSPACE, "HEARTBEAT.md");
  const heartbeatMd = existsSync(hbPath) ? readFileSync(hbPath, "utf-8").slice(0, 20_000) : null;
  const cfg = await runOpenclaw<Record<string, unknown>>(["config", "get", "agents.defaults.heartbeat", "--json"], 15_000);
  return NextResponse.json({
    config: cfg.ok && cfg.data ? cfg.data : null,
    configured: cfg.ok && !!cfg.data,
    heartbeatMd,
    defaults: { every: "30m", target: "none" },
  });
}
