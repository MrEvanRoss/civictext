"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Building2,
  BarChart3,
  Shield,
  Activity,
  ArrowLeft,
} from "lucide-react";

const adminNav = [
  { href: "/admin/orgs", label: "Organizations", icon: Building2 },
  { href: "/admin/analytics", label: "Global Analytics", icon: BarChart3 },
  { href: "/admin/compliance", label: "Compliance", icon: Shield },
  { href: "/admin/system", label: "System Health", icon: Activity },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      {/* Admin Sidebar */}
      <aside className="w-64 border-r bg-card flex flex-col">
        <div className="flex items-center h-16 px-6 border-b">
          <Link href="/admin/orgs" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-red-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">CT</span>
            </div>
            <div>
              <span className="font-semibold text-lg">CivicText</span>
              <span className="text-xs text-red-600 ml-1">Admin</span>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {adminNav.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm rounded-md transition-colors",
                  isActive
                    ? "bg-red-50 text-red-700 font-medium"
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
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-md hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
