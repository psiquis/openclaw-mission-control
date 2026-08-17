"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gauge,
  Bot,
  Bolt,
  ScrollText,
  TerminalSquare,
  GitCompareArrows,
  Route,
  ListChecks,
  Activity,
  BrainCircuit,
  FolderTree,
  CalendarClock,
  MessageSquareText,
  SearchCode,
  TrendingUp,
  ClipboardList,
  Blocks,
  CircleUser,
  LogOut,
  Cog,
  Menu,
  X,
  PanelLeftClose,
} from "lucide-react";

const navSections = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: Gauge },
      { href: "/agents", label: "Agents", icon: Bot },
      { href: "/actions", label: "Quick Actions", icon: Bolt },
    ],
  },
  {
    label: "Infrastructure",
    items: [
      { href: "/logs", label: "Live Logs", icon: ScrollText },
      { href: "/terminal", label: "Terminal", icon: TerminalSquare },
      { href: "/git", label: "Git", icon: GitCompareArrows },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/workflows", label: "Workflows", icon: Route },
      { href: "/tasks", label: "Tasks", icon: ListChecks },
      { href: "/activity", label: "Activity", icon: Activity },
      { href: "/cron", label: "Cron Jobs", icon: CalendarClock },
      { href: "/skills", label: "Skills", icon: Blocks },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/memory", label: "Memory", icon: BrainCircuit },
      { href: "/files", label: "Files", icon: FolderTree },
      { href: "/sessions", label: "Sessions", icon: MessageSquareText },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { href: "/search", label: "Search", icon: SearchCode },
      { href: "/analytics", label: "Analytics", icon: TrendingUp },
      { href: "/reports", label: "Reports", icon: ClipboardList },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth >= 768) setIsOpen(false);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  useEffect(() => {
    if (isMobile) setIsOpen(false);
  }, [pathname, isMobile]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  };

  return (
    <>
      {/* Mobile toggle */}
      {isMobile && !isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed top-2.5 left-3 z-50 p-2 rounded-md"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
          aria-label="Open navigation"
        >
          <Menu className="w-4 h-4" style={{ color: "var(--text-primary)" }} />
        </button>
      )}

      {/* Overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 z-40"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen z-50 flex flex-col overflow-y-auto transition-transform duration-200 ${
          isMobile && !isOpen ? "-translate-x-full" : "translate-x-0"
        }`}
        style={{
          width: "220px",
          backgroundColor: "var(--surface)",
          borderRight: "1px solid var(--border)",
        }}
      >
        {/* Header */}
        <div className="sidebar-brand">
          <div className="mark">
            <PanelLeftClose style={{ width: 13, height: 13 }} />
          </div>
          <h1>Mission Control</h1>
          {!isMobile && <span className="env">prod</span>}
          {isMobile && (
            <button
              onClick={() => setIsOpen(false)}
              style={{ marginLeft: "auto", color: "var(--text-muted)" }}
              aria-label="Close navigation"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2.5 py-3">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <span className="nav-label">{section.label}</span>
              <ul className="space-y-px">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`nav-item${isActive ? " active" : ""}`}
                      >
                        <Icon />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-2.5 pb-3" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-2.5 space-y-px">
            <Link
              href="/about"
              className={`nav-item${pathname === "/about" ? " active" : ""}`}
            >
              <CircleUser />
              About
            </Link>
            <Link
              href="/settings"
              className={`nav-item${pathname === "/settings" ? " active" : ""}`}
            >
              <Cog />
              Settings
            </Link>
            <button onClick={handleLogout} className="nav-item danger w-full">
              <LogOut />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
