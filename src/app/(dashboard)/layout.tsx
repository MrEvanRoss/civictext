"use client";

import { useState, useEffect } from "react";
import { Sidebar, MobileNav } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { ImpersonationBanner } from "@/components/layout/impersonation-banner";
import { CommandPalette } from "@/components/layout/command-palette";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setSidebarCollapsed(true);

    const handleStorage = () => {
      setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    };
    window.addEventListener("storage", handleStorage);

    // Also listen for same-tab changes via a custom event
    const observer = new MutationObserver(() => {
      setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    });

    // Poll for changes (simple approach for same-tab localStorage sync)
    const interval = setInterval(() => {
      const current = localStorage.getItem("sidebar-collapsed") === "true";
      setSidebarCollapsed((prev) => (prev !== current ? current : prev));
    }, 200);

    return () => {
      window.removeEventListener("storage", handleStorage);
      observer.disconnect();
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <ImpersonationBanner />
      <Sidebar />
      <div
        className={`transition-all duration-200 ${
          sidebarCollapsed ? "md:pl-[60px]" : "md:pl-64"
        }`}
      >
        <Topbar />
        <main className="p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>
      <MobileNav />
      <CommandPalette />
    </div>
  );
}
