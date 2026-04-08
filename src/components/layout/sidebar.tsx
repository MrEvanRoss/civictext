"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Users,
  MessageSquare,
  Inbox,
  BarChart3,
  Phone,
  CreditCard,
  Settings,
  UserPlus,
  Hash,
  FileText,
  Shield,
  PanelLeftClose,
  PanelLeft,
  Menu,
} from "lucide-react";

const navGroups = [
  {
    label: "MESSAGING",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/inbox", label: "Inbox", icon: Inbox, badge: true },
      { href: "/campaigns", label: "Campaigns", icon: MessageSquare },
      { href: "/templates", label: "Templates", icon: FileText },
    ],
  },
  {
    label: "CONTACTS",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/interest-lists", label: "Interest Lists", icon: Hash },
    ],
  },
  {
    label: "MANAGEMENT",
    items: [
      { href: "/supervisor", label: "Supervisor", icon: Shield },
      { href: "/analytics", label: "Analytics", icon: BarChart3 },
      { href: "/phone-numbers", label: "Phone Numbers", icon: Phone },
    ],
  },
  {
    label: "ACCOUNT",
    items: [
      { href: "/billing", label: "Billing", icon: CreditCard },
      { href: "/team", label: "Team", icon: UserPlus },
      { href: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavContent({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Logo */}
      <div className="flex items-center h-16 px-4 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
            <span className="text-primary-foreground font-bold text-sm">CT</span>
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-lg block leading-tight">CivicText</span>
              <span className="text-[10px] text-muted-foreground leading-none">Political Texting Platform</span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-4">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold tracking-wider text-muted-foreground/60 uppercase">
                {group.label}
              </p>
            )}
            {collapsed && <div className="h-px bg-border/50 mx-2 mb-2" />}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));

                const linkContent = (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-150",
                      collapsed && "justify-center px-2",
                      isActive
                        ? "bg-primary text-primary-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary-foreground")} />
                    {!collapsed && (
                      <span className="flex-1 truncate">{item.label}</span>
                    )}
                  </Link>
                );

                if (collapsed) {
                  return (
                    <Tooltip key={item.href} delayDuration={0}>
                      <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  );
                }

                return linkContent;
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle (desktop only) */}
      {onToggle && (
        <div className="p-2 border-t border-border/50">
          <button
            onClick={onToggle}
            className="flex items-center justify-center gap-2 w-full px-3 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <PanelLeft className="h-4 w-4" />
            ) : (
              <>
                <PanelLeftClose className="h-4 w-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
  }, []);

  const toggle = () => {
    setCollapsed((prev) => {
      localStorage.setItem("sidebar-collapsed", String(!prev));
      window.dispatchEvent(new Event("sidebar-toggle"));
      return !prev;
    });
  };

  return (
    <TooltipProvider>
      <aside
        className={cn(
          "hidden md:flex md:flex-col md:fixed md:inset-y-0 border-r bg-slate-50 dark:bg-slate-950 transition-all duration-200",
          collapsed ? "md:w-[60px]" : "md:w-64"
        )}
      >
        <NavContent collapsed={collapsed} onToggle={toggle} />
      </aside>
    </TooltipProvider>
  );
}

export function MobileSidebar({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-64">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <NavContent collapsed={false} />
      </SheetContent>
    </Sheet>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  const mobileItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/inbox", label: "Inbox", icon: Inbox },
    { href: "/campaigns", label: "Campaigns", icon: MessageSquare },
    { href: "/contacts", label: "Contacts", icon: Users },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="flex items-center justify-around h-14">
        {mobileItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1.5 min-w-[44px] min-h-[44px] justify-center rounded-lg transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export { navGroups };
