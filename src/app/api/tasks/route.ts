import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";

export async function GET() {
  const [tasks, flows] = await Promise.all([
    runOpenclaw<{ tasks?: unknown[] }>(["tasks", "list", "--json"], 25_000),
    runOpenclaw<{ flows?: unknown[] }>(["tasks", "flow", "list", "--json"], 25_000),
  ]);
  return NextResponse.json({
    tasks: tasks.ok ? tasks.data?.tasks || [] : [],
    flows: flows.ok ? flows.data?.flows || [] : [],
    errors: [tasks.error, flows.error].filter(Boolean),
  });
}

export async function POST(request: NextRequest) {
  let action = "", id = "";
  try {
    const body = await request.json();
    action = String(body.action || "");
    id = String(body.id || "");
  } catch { /* invalido */ }
  if (!/^[a-zA-Z0-9:_.-]+$/.test(id) || !["cancel", "flow-cancel"].includes(action)) {
    return NextResponse.json({ error: "Peticion invalida" }, { status: 400 });
  }
  const args = action === "cancel" ? ["tasks", "cancel", id] : ["tasks", "flow", "cancel", id];
  const res = await runOpenclaw(args, 25_000);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: 502 });
  return NextResponse.json({ success: true, raw: res.raw });
}
