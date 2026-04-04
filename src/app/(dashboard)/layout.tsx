"use client";

import { Sidebar } from "@/components/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }}>
      <Sidebar />
      <main
        style={{
          marginLeft: "220px",
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
