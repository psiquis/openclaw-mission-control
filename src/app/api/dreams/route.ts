import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const WORKSPACE = process.env.OPENCLAW_WORKSPACE || join(homedir(), ".openclaw", "workspace");

export async function GET() {
  try {
    const diaryPath = join(WORKSPACE, "DREAMS.md");
    const diary = existsSync(diaryPath) ? readFileSync(diaryPath, "utf-8").slice(0, 200_000) : null;
    const phases: Record<string, string[]> = {};
    for (const phase of ["light", "rem", "deep"]) {
      const dir = join(WORKSPACE, "memory", "dreaming", phase);
      phases[phase] = existsSync(dir)
        ? readdirSync(dir).filter((f) => f.endsWith(".md")).sort().reverse().slice(0, 10)
        : [];
    }
    const memoryPath = join(WORKSPACE, "MEMORY.md");
    const memoryMtime = existsSync(memoryPath) ? (await import("fs")).statSync(memoryPath).mtimeMs : null;
    return NextResponse.json({ diary, phases, memoryMtime });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}
