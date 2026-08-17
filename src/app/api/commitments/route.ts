import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";

export async function GET() {
  const res = await runOpenclaw<{ count?: number; commitments?: unknown[] }>(["commitments", "list", "--json"], 20_000);
  if (!res.ok) return NextResponse.json({ error: res.error, commitments: [] });
  return NextResponse.json({ commitments: res.data?.commitments || [], count: res.data?.count || 0 });
}

export async function POST(request: NextRequest) {
  let id = "";
  try {
    const body = await request.json();
    id = String(body.id || "");
  } catch { /* invalido */ }
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) return NextResponse.json({ error: "id invalido" }, { status: 400 });
  const res = await runOpenclaw(["commitments", "dismiss", id], 20_000);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ success: true });
}
