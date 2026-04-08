"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Building2,
  BarChart3,
  Shield,
  Activity,
  MessageSquare,
  ArrowLeft,
  Menu,
  Settings,
} from "lucide-react";

const adminNav = [
  { href: "/admin/orgs", label: "Organizations", icon: Building2 },
  { href: "/admin/messages", label: "Message Log", icon: MessageSquare },
  { href: "/admin/analytics", label: "Global Analytics", icon: BarChart3 },
  { href: "/admin/compliance", label: "Compliance", icon: Shield },
  { href: "/admin/system", label: "System Health", icon: Activity },
  { href: "/admin/settings", label: "Settings", icon: Settings },
];

function AdminNavContent({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {adminNav.map((item) => {
          const isActive =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                isActive
                  ? "bg-red-50 text-red-700 font-medium dark:bg-red-950 dark:text-red-400"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t">
        <Link
          href="/dashboard"
          onClick={onNavigate}
          className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
    </>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      {/* Desktop Admin Sidebar */}
      <aside className="hidden md:flex w-64 border-r bg-card flex-col fixed inset-y-0">
        <div className="flex items-center h-16 px-6 border-b">
          <Link href="/admin/orgs" className="flex items-center gap-2">
            <Image src="/logo-icon.png" alt="CivicText" width={32} height={23} className="shrink-0" />
            <div>
              <span className="font-semibold text-lg">CivicText</span>
              <span className="text-xs text-red-600 ml-1">Admin</span>
            </div>
          </Link>
        </div>
        <AdminNavContent />
      </aside>

      {/* Mobile Admin Header */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 flex items-center px-4 gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setMobileOpen(true)}
          aria-label="Open admin navigation"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2">
          <Image src="/logo-icon.png" alt="CivicText" width={28} height={20} className="shrink-0" />
          <span className="font-semibold">Admin</span>
        </div>
      </div>

      {/* Mobile Admin Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          <div className="flex items-center h-16 px-6 border-b">
            <Link href="/admin/orgs" className="flex items-center gap-2">
              <Image src="/logo-icon.png" alt="CivicText" width={32} height={23} className="shrink-0" />
              <div>
                <span className="font-semibold text-lg">CivicText</span>
                <span className="text-xs text-red-600 ml-1">Admin</span>
              </div>
            </Link>
          </div>
          <AdminNavContent onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Content */}
      <main className="flex-1 md:ml-64 pt-14 md:pt-0 p-4 md:p-6 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
