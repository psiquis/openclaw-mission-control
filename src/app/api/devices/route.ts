import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";

export async function GET() {
  const res = await runOpenclaw<{ pending?: unknown[]; paired?: unknown[] }>(["devices", "list", "--json"], 20_000);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({
    pending: res.data?.pending || [],
    paired: res.data?.paired || [],
  });
}

export async function POST(request: NextRequest) {
  let action = "", requestId = "";
  try {
    const body = await request.json();
    action = String(body.action || "");
    requestId = String(body.requestId || "");
  } catch { /* invalido */ }
  if (!/^[a-zA-Z0-9_-]+$/.test(requestId) || !["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Peticion invalida" }, { status: 400 });
  }
  const res = await runOpenclaw(["devices", action, requestId], 20_000);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ success: true, raw: res.raw });
}
