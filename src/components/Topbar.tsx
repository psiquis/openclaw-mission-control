"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { NotificationDropdown } from "@/components/NotificationDropdown";

const LABELS: Record<string, string> = {
  "": "Dashboard",
  agents: "Agents",
  actions: "Quick Actions",
  logs: "Live Logs",
  terminal: "Terminal",
  git: "Git",
  workflows: "Workflows",
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
      <Link href="/search" className="topbar-search">
        <Search style={{ width: 13, height: 13, flexShrink: 0 }} />
        <span>Search</span>
        <kbd>⌘K</kbd>
      </Link>
      <NotificationDropdown />
    </header>
  );
}
