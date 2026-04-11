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

    // Cross-tab sync: the storage event fires when another tab changes localStorage
    const handleStorage = () => {
      setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    };
    window.addEventListener("storage", handleStorage);

    // Same-tab sync: the sidebar component dispatches this custom event when toggled
    const handleSidebarToggle = () => {
      setSidebarCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
    };
    window.addEventListener("sidebar-toggle", handleSidebarToggle);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("sidebar-toggle", handleSidebarToggle);
    };
  }, []);

  return (
    <div className="min-h-screen bg-background impersonation-content-offset">
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
