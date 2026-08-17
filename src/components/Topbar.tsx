"use client";

import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { CommandPalette } from "@/components/CommandPalette";
import { AgentChatPanel } from "@/components/AgentChatPanel";
import { useEffect, useState } from "react";

const LABELS: Record<string, string> = {
  "": "Dashboard",
  agents: "Agents",
  actions: "Quick Actions",
  logs: "Live Logs",
  terminal: "Terminal",
  git: "Git",
  workflows: "Workflows",
  tasks: "Tasks",
  activity: "Activity",
  cron: "Cron Jobs",
  skills: "Skills",
  memory: "Memory",
  files: "Files",
  sessions: "Sessions",
  search: "Search",
  analytics: "Analytics",
  reports: "Reports",
  costs: "Costs",
  calendar: "Calendar",
  system: "System",
  about: "About",
  settings: "Settings",
};

export function Topbar() {
  const pathname = usePathname() || "/";
  const [chatAgent, setChatAgent] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id) setChatAgent({ id: d.id, name: d.name || d.id });
    };
    window.addEventListener("open-agent-chat", onOpen);
    return () => window.removeEventListener("open-agent-chat", onOpen);
  }, []);
  const segments = pathname.split("/").filter(Boolean);
  const primary = segments[0] ?? "";
  const label = LABELS[primary] ?? primary;
  const sub = segments[1];

  return (
    <header className="topbar">
      <div className="crumb">
        <span>delorian</span>
        <span className="sep">/</span>
        <b>{label}</b>
        {sub && (
          <>
            <span className="sep">/</span>
            <span style={{ color: "var(--text-secondary)" }}>{sub}</span>
          </>
        )}
      </div>
      <div style={{ flex: 1 }} />
      <button
        onClick={() => window.dispatchEvent(new Event("open-command-palette"))}
        className="topbar-search"
        aria-label="Abrir paleta de comandos"
      >
        <Search style={{ width: 13, height: 13, flexShrink: 0 }} />
        <span>Buscar…</span>
        <kbd>⌘K</kbd>
      </button>
      <NotificationDropdown />
      <CommandPalette />
      {chatAgent && (
        <AgentChatPanel agentId={chatAgent.id} agentName={chatAgent.name} onClose={() => setChatAgent(null)} />
      )}
    </header>
  );
}
