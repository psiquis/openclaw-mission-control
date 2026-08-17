import { NextResponse } from "next/server";

const N8N_URL = process.env.N8N_URL || "http://localhost:5678";
const N8N_KEY = process.env.N8N_API_KEY;

interface N8nWorkflow {
  id: string;
  name: string;
  active: boolean;
  updatedAt?: string;
  tags?: Array<{ name: string }>;
}

export async function GET() {
  if (!N8N_KEY) {
    return NextResponse.json({ connected: false, reason: "sin_api_key" });
  }
  try {
    const res = await fetch(`${N8N_URL}/api/v1/workflows?limit=100`, {
      headers: { "X-N8N-API-KEY": N8N_KEY },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return NextResponse.json({ connected: false, reason: `http_${res.status}` });
    }
    const data = await res.json();
    const workflows: N8nWorkflow[] = (data.data || []).map((w: N8nWorkflow) => ({
      id: w.id,
      name: w.name,
      active: w.active,
      updatedAt: w.updatedAt,
      tags: w.tags,
    }));
    return NextResponse.json({ connected: true, workflows });
  } catch {
    return NextResponse.json({ connected: false, reason: "inaccesible" });
  }
}
