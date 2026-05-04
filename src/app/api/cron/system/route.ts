import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface SystemCronEntry {
  index: number;
  expr: string;
  command: string;
  comment?: string;
  raw: string;
}

function parseCrontab(raw: string): SystemCronEntry[] {
  const lines = raw.split("\n");
  const entries: SystemCronEntry[] = [];
  let pendingComment: string | undefined = undefined;
  let entryIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      // blank line resets pending comment
      pendingComment = undefined;
      continue;
    }
    if (trimmed.startsWith("#")) {
      // Save as pending comment (strip the # and any leading space)
      pendingComment = trimmed.replace(/^#+\s*/, "");
      continue;
    }

    // Try to parse as a cron entry (5 fields + command)
    const match = trimmed.match(
      /^(@\S+|\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/
    );
    if (match) {
      entries.push({
        index: entryIndex++,
        expr: match[1].trim(),
        command: match[2].trim(),
        comment: pendingComment,
        raw: trimmed,
      });
    }
    // Reset pending comment regardless
    pendingComment = undefined;
  }

  return entries;
}

async function readCrontab(): Promise<string> {
  try {
    const { stdout } = await execAsync("crontab -l");
    return stdout;
  } catch {
    // crontab -l exits with 1 if no crontab — return empty
    return "";
  }
}

async function writeCrontab(content: string): Promise<void> {
  // Write via echo piped to crontab
  const escaped = content.replace(/'/g, "'\\''");
  await execAsync(`echo '${escaped}' | crontab -`);
}

function buildCrontabLine(
  expr: string,
  command: string,
  comment?: string
): string {
  const lines: string[] = [];
  if (comment && comment.trim()) {
    lines.push(`# ${comment.trim()}`);
  }
  lines.push(`${expr} ${command}`);
  return lines.join("\n");
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const raw = await readCrontab();
    const entries = parseCrontab(raw);
    return NextResponse.json(entries);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

// ─── POST (add) ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const { expr, command, comment } = await req.json();
    if (!expr || !command) {
      return NextResponse.json(
        { error: "expr and command are required" },
        { status: 400 }
      );
    }

    const raw = await readCrontab();
    const newLine = buildCrontabLine(expr, command, comment);
    const newContent = raw.trim()
      ? raw.trimEnd() + "\n" + newLine + "\n"
      : newLine + "\n";

    await writeCrontab(newContent);
    const entries = parseCrontab(newContent);
    return NextResponse.json(entries);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

// ─── PUT (edit) ───────────────────────────────────────────────────────────────

export async function PUT(req: NextRequest) {
  try {
    const { index, expr, command, comment } = await req.json();
    if (index === undefined || !expr || !command) {
      return NextResponse.json(
        { error: "index, expr and command are required" },
        { status: 400 }
      );
    }

    const raw = await readCrontab();
    const entries = parseCrontab(raw);
    const target = entries[index];
    if (!target) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    // Rebuild the crontab by replacing the matched entry (and its comment if any)
    const lines = raw.split("\n");
    const newLines: string[] = [];
    let entryIdx = 0;
    let i = 0;

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      if (!trimmed) {
        newLines.push(lines[i]);
        i++;
        continue;
      }

      if (trimmed.startsWith("#")) {
        // Check if the NEXT non-empty line is an entry that matches our index
        let nextEntryLine = i + 1;
        while (nextEntryLine < lines.length && !lines[nextEntryLine].trim()) {
          nextEntryLine++;
        }
        const nextTrimmed = lines[nextEntryLine]?.trim() ?? "";
        const isNextEntry =
          nextTrimmed &&
          !nextTrimmed.startsWith("#") &&
          nextTrimmed.match(/^(@\S+|\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/);

        if (isNextEntry && entryIdx === index) {
          // Skip this comment (we'll write the new one below when we hit the entry line)
          i++;
          continue;
        }
        newLines.push(lines[i]);
        i++;
        continue;
      }

      const isEntry = trimmed.match(
        /^(@\S+|\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/
      );
      if (isEntry) {
        if (entryIdx === index) {
          // Replace with new entry
          const newLine = buildCrontabLine(expr, command, comment);
          newLines.push(newLine);
        } else {
          newLines.push(lines[i]);
        }
        entryIdx++;
      } else {
        newLines.push(lines[i]);
      }
      i++;
    }

    const newContent = newLines.join("\n");
    await writeCrontab(newContent);
    const updatedEntries = parseCrontab(newContent);
    return NextResponse.json(updatedEntries);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const { index } = await req.json();
    if (index === undefined) {
      return NextResponse.json(
        { error: "index is required" },
        { status: 400 }
      );
    }

    const raw = await readCrontab();
    const entries = parseCrontab(raw);
    if (entries[index] === undefined) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }

    const lines = raw.split("\n");
    const newLines: string[] = [];
    let entryIdx = 0;
    let i = 0;

    while (i < lines.length) {
      const trimmed = lines[i].trim();

      if (!trimmed) {
        newLines.push(lines[i]);
        i++;
        continue;
      }

      if (trimmed.startsWith("#")) {
        // Check if the next entry is the one we're deleting
        let nextEntryLine = i + 1;
        while (nextEntryLine < lines.length && !lines[nextEntryLine].trim()) {
          nextEntryLine++;
        }
        const nextTrimmed = lines[nextEntryLine]?.trim() ?? "";
        const isNextEntry =
          nextTrimmed &&
          !nextTrimmed.startsWith("#") &&
          nextTrimmed.match(/^(@\S+|\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/);

        if (isNextEntry && entryIdx === index) {
          // Skip this comment
          i++;
          continue;
        }
        newLines.push(lines[i]);
        i++;
        continue;
      }

      const isEntry = trimmed.match(
        /^(@\S+|\S+\s+\S+\s+\S+\s+\S+\s+\S+)\s+(.+)$/
      );
      if (isEntry) {
        if (entryIdx !== index) {
          newLines.push(lines[i]);
        }
        entryIdx++;
      } else {
        newLines.push(lines[i]);
      }
      i++;
    }

    const newContent = newLines.join("\n");
    await writeCrontab(newContent);
    const updatedEntries = parseCrontab(newContent);
    return NextResponse.json(updatedEntries);
  } catch (err) {
    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}
