import { NextRequest, NextResponse } from "next/server";
import { runOpenclaw } from "@/lib/openclaw-cli";

export const maxDuration = 300;

interface AgentJson {
  payloads?: Array<{ text?: string }>;
  reply?: string;
  text?: string;
  result?: { payloads?: Array<{ text?: string }> };
}

function extractReply(data: AgentJson | undefined, raw: string | undefined): string {
  if (data) {
    const payloads = data.payloads || data.result?.payloads;
    if (Array.isArray(payloads) && payloads.length) {
      const texts = payloads.map((p) => p?.text).filter(Boolean);
      if (texts.length) return texts.join("\n\n");
    }
    if (typeof data.reply === "string" && data.reply) return data.reply;
    if (typeof data.text === "string" && data.text) return data.text;
  }
  return (raw || "").slice(0, 8000) || "(sin respuesta)";
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  if (!/^[a-zA-Z0-9_-]+$/.test(id)) {
    return NextResponse.json({ error: "Agente invalido" }, { status: 400 });
  }
  let message = "";
  try {
    const body = await request.json();
    message = String(body.message || "").trim();
  } catch { /* body invalido */ }
  if (!message) {
    return NextResponse.json({ error: "Mensaje vacio" }, { status: 400 });
  }
  if (message.length > 8000) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 400 });
  }

  const started = Date.now();
  const res = await runOpenclaw<AgentJson>(
    ["agent", "--agent", id, "--message", message, "--timeout", "240", "--json"],
    250_000
  );
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: 502 });
  }
  return NextResponse.json({
    reply: extractReply(res.data, res.raw),
    duration_ms: Date.now() - started,
  });
}
