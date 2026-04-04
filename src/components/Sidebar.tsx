"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Gauge,
  Bot,
  Bolt,
  Cpu,
  ScrollText,
  TerminalSquare,
  GitCompareArrows,
  Route,
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
      { href: "/system", label: "System", icon: Cpu },
      { href: "/logs", label: "Live Logs", icon: ScrollText },
      { href: "/terminal", label: "Terminal", icon: TerminalSquare },
      { href: "/git", label: "Git", icon: GitCompareArrows },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/workflows", label: "Workflows", icon: Route },
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
          className="fixed top-3 left-3 z-50 p-2 rounded-lg"
          style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Menu className="w-5 h-5" style={{ color: "var(--text-primary)" }} />
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
        <div className="flex items-center justify-between px-4 pt-5 pb-4">
          <div className="flex items-center gap-2.5">
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              <PanelLeftClose className="w-4 h-4" />
            </div>
            <h1
              className="text-sm font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-heading)",
                color: "var(--text-primary)",
                letterSpacing: "-0.3px",
              }}
            >
              Mission Control
            </h1>
          </div>
          {isMobile && (
            <button onClick={() => setIsOpen(false)} style={{ color: "var(--text-muted)" }}>
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pb-4">
          {navSections.map((section) => (
            <div key={section.label} className="mb-4">
              <p
                className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--text-muted)" }}
              >
                {section.label}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const isActive = pathname === item.href;
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className="flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium transition-colors"
                        style={
                          isActive
                            ? {
                                backgroundColor: "var(--accent-soft)",
                                color: "var(--accent)",
                              }
                            : {
                                color: "var(--text-secondary)",
                              }
                        }
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = "var(--surface-hover)";
                            e.currentTarget.style.color = "var(--text-primary)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.backgroundColor = "transparent";
                            e.currentTarget.style.color = "var(--text-secondary)";
                          }
                        }}
                      >
                        <Icon
                          className="w-[16px] h-[16px]"
                          style={{ color: isActive ? "var(--accent)" : "var(--text-muted)" }}
                        />
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
        <div className="px-3 pb-4" style={{ borderTop: "1px solid var(--border)" }}>
          <div className="pt-3 space-y-0.5">
            <Link
              href="/about"
              className="flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium"
              style={{ color: pathname === "/about" ? "var(--accent)" : "var(--text-secondary)" }}
            >
              <CircleUser
                className="w-[16px] h-[16px]"
                style={{ color: pathname === "/about" ? "var(--accent)" : "var(--text-muted)" }}
              />
              About
            </Link>
            <Link
              href="/settings"
              className="flex items-center gap-2.5 px-3 py-[7px] rounded-lg text-[13px] font-medium"
              style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--text-secondary)" }}
            >
              <Cog
                className="w-[16px] h-[16px]"
                style={{ color: pathname === "/settings" ? "var(--accent)" : "var(--text-muted)" }}
              />
              Settings
            </Link>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2.5 px-3 py-[7px] w-full rounded-lg text-[13px] font-medium transition-colors"
              style={{ color: "var(--text-muted)" }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--error)";
                e.currentTarget.style.backgroundColor = "var(--surface-hover)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--text-muted)";
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <LogOut className="w-[16px] h-[16px]" />
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
