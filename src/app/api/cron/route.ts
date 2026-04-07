import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";

function loadTemplateCategoryMap(): Record<string, string> {
  try {
    const Database = require('better-sqlite3');
    const path = require('path');
    const fs = require('fs');
    const map: Record<string, string> = {};

    // 1. Load from cron-templates.db (match by name)
    const dbPath = path.join(process.cwd(), 'data', 'cron-templates.db');
    if (fs.existsSync(dbPath)) {
      const db = new Database(dbPath, { readonly: true });
      const rows = db.prepare('SELECT name, category FROM cron_templates').all() as Array<{ name: string; category: string }>;
      db.close();
      for (const r of rows) map[r.name.toLowerCase()] = r.category;
    }

    // 2. Load manual overrides from cron-categories.json (jobId -> category)
    const overridesPath = path.join(process.cwd(), 'data', 'cron-categories.json');
    if (fs.existsSync(overridesPath)) {
      const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf-8'));
      for (const [key, val] of Object.entries(overrides)) {
        map[key.toLowerCase()] = val as string;
      }
    }

    return map;
  } catch { return {}; }
}

// GET: List all cron jobs from the OpenClaw gateway
export async function GET() {
  try {
    const output = execSync("openclaw cron list --json --all 2>/dev/null", {
      timeout: 10000,
      encoding: "utf-8",
    });

    const categoryMap = loadTemplateCategoryMap();
    const data = JSON.parse(output);
    const jobs = (data.jobs || []).map((job: Record<string, unknown>) => {
      const payload = (job.payload || {}) as Record<string, unknown>;
      const delivery = (job.delivery || {}) as Record<string, unknown>;
      const schedule = (job.schedule || {}) as Record<string, unknown>;
      const state = (job.state || {}) as Record<string, unknown>;

      return {
        id: job.id,
        agentId: job.agentId || "main",
        name: job.name || "Unnamed",
        enabled: job.enabled ?? true,
        createdAtMs: job.createdAtMs,
        updatedAtMs: job.updatedAtMs,
        schedule: job.schedule,
        sessionTarget: job.sessionTarget,
        payload: job.payload,
        delivery: job.delivery,
        state: job.state,
        // Derived fields for the UI
        description: formatDescription(job),
        scheduleDisplay: formatSchedule(schedule),
        timezone: (schedule.tz as string) || "UTC",
        nextRun: state.nextRunAtMs
          ? new Date(state.nextRunAtMs as number).toISOString()
          : null,
        lastRun: state.lastRunAtMs
          ? new Date(state.lastRunAtMs as number).toISOString()
          : null,
        // Enhanced fields
        payloadKind: payload.kind as string || undefined,
        message: (payload.message as string) || (payload.text as string) || undefined,
        model: payload.model as string || undefined,
        thinking: payload.thinking as string || undefined,
        lightContext: payload.lightContext as boolean || undefined,
        tools: payload.toolsAllow as string || undefined,
        deliveryMode: delivery.mode as string || undefined,
        deliveryChannel: delivery.channel as string || undefined,
        deliveryTo: delivery.to as string || undefined,
        category: categoryMap[(job.id as string || '').toLowerCase()] || categoryMap[(job.name as string || '').toLowerCase()] || undefined,
      };
    });

    return NextResponse.json(jobs);
  } catch (error) {
    console.error("Error fetching cron jobs from gateway:", error);
    return NextResponse.json(
      { error: "Failed to fetch cron jobs from OpenClaw gateway" },
      { status: 500 }
    );
  }
}

function formatDescription(job: Record<string, unknown>): string {
  const payload = job.payload as Record<string, unknown>;
  if (!payload) return "";
  if (payload.kind === "agentTurn") {
    const msg = (payload.message as string) || "";
    return msg.length > 120 ? msg.substring(0, 120) + "..." : msg;
  }
  if (payload.kind === "systemEvent") {
    const text = (payload.text as string) || "";
    return text.length > 120 ? text.substring(0, 120) + "..." : text;
  }
  return "";
}

function formatSchedule(schedule: Record<string, unknown>): string {
  if (!schedule) return "Unknown";
  switch (schedule.kind) {
    case "cron":
      return `${schedule.expr}${schedule.tz ? ` (${schedule.tz})` : ""}`;
    case "every": {
      const ms = schedule.everyMs as number;
      if (ms >= 3600000) return `Every ${ms / 3600000}h`;
      if (ms >= 60000) return `Every ${ms / 60000}m`;
      return `Every ${ms / 1000}s`;
    }
    case "at":
      return `Once at ${schedule.at}`;
    default:
      return JSON.stringify(schedule);
  }
}

// PUT: Toggle enable/disable a cron job
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled } = body;

    if (!id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    const action = enabled ? "enable" : "disable";
    execSync(
      `openclaw cron ${action} ${id} 2>/dev/null`,
      { timeout: 10000, encoding: "utf-8" }
    );

    return NextResponse.json({ success: true, id, enabled });
  } catch (error) {
    console.error("Error updating cron job:", error);
    return NextResponse.json(
      { error: "Failed to update cron job" },
      { status: 500 }
    );
  }
}

// POST: Create a new cron job
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const args: string[] = ["openclaw", "cron", "add"];

    // Required
    if (body.name) args.push("--name", JSON.stringify(body.name));

    // Schedule
    if (body.scheduleKind === "cron" && body.cronExpr) {
      args.push("--cron", JSON.stringify(body.cronExpr));
    } else if (body.scheduleKind === "every" && body.every) {
      args.push("--every", body.every);
    } else if (body.scheduleKind === "at" && body.at) {
      args.push("--at", body.at);
    }

    // Timezone
    if (body.timezone) args.push("--tz", body.timezone);

    // Session target
    if (body.sessionTarget) args.push("--session", body.sessionTarget);

    // Payload — enforce correct type based on session
    // Main sessions REQUIRE --system-event, isolated/custom REQUIRE --message
    const resolvedSession = body.sessionTarget || "isolated";
    const isMain = resolvedSession === "main";
    const text = (body.message || body.systemEvent || "").trim();

    if (text) {
      if (isMain) {
        args.push("--system-event", JSON.stringify(text));
      } else {
        args.push("--message", JSON.stringify(text));
      }
    }

    // Agent
    if (body.agentId) args.push("--agent", body.agentId);

    // Model
    if (body.model) args.push("--model", body.model);

    // Thinking
    if (body.thinking) args.push("--thinking", body.thinking);

    // Delivery
    if (body.announce === true) args.push("--announce");
    if (body.announce === false) args.push("--no-deliver");
    if (body.deliveryChannel) args.push("--channel", body.deliveryChannel);
    if (body.deliveryTo) args.push("--to", body.deliveryTo);
    // Delivery account (which bot to use)
    if (body.deliveryAccount) args.push("--account", body.deliveryAccount);

    // Timeout
    if (body.timeoutSeconds) args.push("--timeout-seconds", String(body.timeoutSeconds));

    // Light context
    if (body.lightContext) args.push("--light-context");

    // Tools
    if (body.tools) args.push("--tools", body.tools);

    // One-shot options
    if (body.deleteAfterRun) args.push("--delete-after-run");
    if (body.keepAfterRun) args.push("--keep-after-run");

    // Stagger
    if (body.exact) args.push("--exact");
    else if (body.stagger) args.push("--stagger", body.stagger);

    // Disabled
    if (body.disabled) args.push("--disabled");

    // Description
    if (body.description) args.push("--description", JSON.stringify(body.description));

    args.push("--json");

    const cmd = args.join(" ");
    const output = execSync(cmd, { timeout: 15000, encoding: "utf-8" });
    const result = JSON.parse(output);

    return NextResponse.json({ success: true, job: result });
  } catch (error) {
    console.error("Error creating cron job:", error);
    const message = error instanceof Error ? error.message : "Failed to create job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// PATCH: Edit an existing cron job
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...patch } = body;
    if (!id) return NextResponse.json({ error: "Job ID required" }, { status: 400 });
    if (!/^[a-zA-Z0-9_-]+$/.test(id)) return NextResponse.json({ error: "Invalid job ID" }, { status: 400 });

    const args: string[] = ["openclaw", "cron", "edit", id];

    if (patch.name) args.push("--name", JSON.stringify(patch.name));
    if (patch.cronExpr) args.push("--cron", JSON.stringify(patch.cronExpr));
    if (patch.every) args.push("--every", patch.every);
    if (patch.at) args.push("--at", patch.at);
    if (patch.timezone) args.push("--tz", patch.timezone);
    if (patch.session) args.push("--session", patch.session);
    // Payload — enforce correct type based on session
    // Main sessions REQUIRE --system-event, isolated/custom REQUIRE --message
    const patchResolvedSession = patch.session || body.sessionTarget || "isolated";
    const patchIsMain = patchResolvedSession === "main";
    const patchText = (patch.message || patch.systemEvent || "").trim();
    if (patchText) {
      if (patchIsMain) {
        args.push("--system-event", JSON.stringify(patchText));
      } else {
        args.push("--message", JSON.stringify(patchText));
      }
    }
    if (patch.agentId) args.push("--agent", patch.agentId);
    if (patch.model) args.push("--model", patch.model);
    if (patch.thinking) args.push("--thinking", patch.thinking);
    if (patch.announce === true) args.push("--announce");
    if (patch.announce === false) args.push("--no-deliver");
    if (patch.deliveryChannel) args.push("--channel", patch.deliveryChannel);
    if (patch.deliveryTo) args.push("--to", patch.deliveryTo);
    if (patch.deliveryAccount) args.push("--account", patch.deliveryAccount);
    if (patch.timeoutSeconds) args.push("--timeout-seconds", String(patch.timeoutSeconds));
    if (patch.lightContext === true) args.push("--light-context");
    if (patch.description) args.push("--description", JSON.stringify(patch.description));
    if (patch.enabled === true) args.push("--enable");
    if (patch.enabled === false) args.push("--disable");

    // Note: openclaw cron edit does NOT support --json (unlike add/list/rm)

    const cmd = args.join(" ");
    execSync(cmd, { timeout: 15000, encoding: "utf-8" });

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Error editing cron job:", error);
    const message = error instanceof Error ? error.message : "Failed to edit job";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE: Remove a cron job
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Job ID is required" }, { status: 400 });
    }

    execSync(`openclaw cron remove ${id} 2>/dev/null`, {
      timeout: 10000,
      encoding: "utf-8",
    });

    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    console.error("Error deleting cron job:", error);
    return NextResponse.json(
      { error: "Failed to delete cron job" },
      { status: 500 }
    );
  }
}
