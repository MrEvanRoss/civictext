"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getOrgBrandingAction } from "@/server/actions/org-settings";
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
  Inbox,
  MessageSquare,
  GitBranch,
  ClipboardList,
  UsersRound,
  TrendingUp,
  CalendarClock,
  Megaphone,
  Link2,
  QrCode,
  MessageCircle,
  Globe,
  ShoppingBag,
  FileInput,
  Shield,
  Settings,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
} from "lucide-react";

// --- Types ---

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: boolean;
}

interface NavGroupCollapsible {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  collapsible: true;
  items: NavItem[];
}

type NavEntry = NavItem | NavGroupCollapsible;

// --- Navigation structure ---

const navItems: NavEntry[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/inbox", label: "Messages", icon: Inbox, badge: true },
  { href: "/campaigns", label: "Campaigns", icon: MessageSquare },
  { href: "/flows", label: "Flows", icon: GitBranch },
  { href: "/surveys", label: "Surveys", icon: ClipboardList },
  { href: "/subcommunities", label: "Subcommunities", icon: UsersRound },
  { href: "/analytics", label: "Insights", icon: TrendingUp },
  { href: "/scheduled", label: "Scheduled", icon: CalendarClock },
  {
    label: "Growth Tools",
    icon: Megaphone,
    collapsible: true,
    items: [
      { href: "/growth/custom-url", label: "Custom URL", icon: Link2 },
      { href: "/growth/qr-code", label: "QR Code", icon: QrCode },
      { href: "/growth/activation-text", label: "Activation", icon: MessageCircle },
      { href: "/growth/popup", label: "Website", icon: Globe },
      { href: "/growth/shopify", label: "Shopify", icon: ShoppingBag },
      { href: "/growth/integrations", label: "Forms", icon: FileInput },
    ],
  },
  { href: "/supervisor", label: "Supervisor", icon: Shield },
  { href: "/settings", label: "Settings", icon: Settings },
];

// Flat export for consumers like the command palette that iterate all nav items.
// Includes all items (top-level + nested growth sub-items).
const navGroups = [
  {
    label: "NAVIGATION",
    items: navItems.flatMap((entry) => {
      if ("collapsible" in entry && entry.collapsible) {
        return entry.items;
      }
      return [entry as NavItem];
    }),
  },
];

// --- Helpers ---

function isCollapsibleGroup(entry: NavEntry): entry is NavGroupCollapsible {
  return "collapsible" in entry && entry.collapsible === true;
}

// --- Collapsible Group Component ---

function CollapsibleNavGroup({
  group,
  collapsed: sidebarCollapsed,
  pathname,
}: {
  group: NavGroupCollapsible;
  collapsed: boolean;
  pathname: string;
}) {
  const isChildActive = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href)
  );

  const [expanded, setExpanded] = useState(isChildActive);

  // Auto-expand when a child route is active
  useEffect(() => {
    if (isChildActive) setExpanded(true);
  }, [isChildActive]);

  const GroupIcon = group.icon;

  // When the sidebar itself is collapsed, render just the icon with a tooltip
  if (sidebarCollapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className={cn(
              "flex items-center justify-center px-2 py-2 text-sm rounded-lg transition-all duration-150 w-full",
              isChildActive
                ? "bg-primary text-primary-foreground font-medium shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <GroupIcon className={cn("h-4 w-4 shrink-0", isChildActive && "text-primary-foreground")} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8} className="space-y-1">
          <p className="font-medium">{group.label}</p>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "block px-2 py-1 text-xs rounded hover:bg-accent",
                pathname === item.href || pathname.startsWith(item.href)
                  ? "text-primary font-medium"
                  : "text-muted-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </TooltipContent>
      </Tooltip>
    );
  }

  // Expanded sidebar: show group header + collapsible children
  return (
    <div>
      <button
        onClick={() => setExpanded((prev) => !prev)}
        className={cn(
          "flex items-center gap-3 px-3 py-2 text-sm rounded-lg transition-all duration-150 w-full",
          isChildActive
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:bg-accent hover:text-foreground"
        )}
      >
        <GroupIcon className="h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{group.label}</span>
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform duration-200",
            expanded && "rotate-90"
          )}
        />
      </button>
      {expanded && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-border/50 pl-2">
          {group.items.map((item) => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-1.5 text-sm rounded-lg transition-all duration-150",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary-foreground")} />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// --- NavContent ---

interface OrgBranding {
  name: string;
  logoUrl: string | null;
}

function NavContent({
  collapsed,
  onToggle,
  orgBranding,
}: {
  collapsed: boolean;
  onToggle?: () => void;
  orgBranding: OrgBranding | null;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Organization Branding Header */}
      <div className="flex items-center h-16 px-4 border-b border-border/50">
        <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0">
          {orgBranding?.logoUrl ? (
            <Image
              src={orgBranding.logoUrl}
              alt={orgBranding.name}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center shadow-sm">
              <span className="text-primary-foreground font-bold text-sm">
                {orgBranding?.name?.charAt(0)?.toUpperCase() || "O"}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <span className="font-semibold text-sm block leading-tight truncate">
                {orgBranding?.name || "My Organization"}
              </span>
            </div>
          )}
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 overflow-y-auto space-y-0.5">
        {navItems.map((entry) => {
          // Collapsible group (Growth Tools)
          if (isCollapsibleGroup(entry)) {
            return (
              <CollapsibleNavGroup
                key={entry.label}
                group={entry}
                collapsed={collapsed}
                pathname={pathname}
              />
            );
          }

          // Regular nav item
          const item = entry as NavItem;
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
      </nav>

      {/* Bottom: CivicText branding + collapse toggle */}
      <div className="border-t border-border/50">
        {/* CivicText logo */}
        <div className={cn("flex items-center px-4 py-2", collapsed ? "justify-center" : "gap-2")}>
          {collapsed ? (
            <Image src="/logo-icon.png" alt="CivicText" width={24} height={17} className="shrink-0 opacity-50" />
          ) : (
            <div className="flex items-center gap-1.5 opacity-50">
              <Image src="/logo-icon.png" alt="CivicText" width={18} height={13} className="shrink-0" />
              <span className="text-[10px] text-muted-foreground">Powered by CivicText</span>
            </div>
          )}
        </div>

        {/* Collapse toggle (desktop only) */}
        {onToggle && (
          <div className="px-2 pb-2">
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
    </div>
  );
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [orgBranding, setOrgBranding] = useState<OrgBranding | null>(null);

  const loadBranding = useCallback(async () => {
    try {
      const data = await getOrgBrandingAction();
      setOrgBranding(data);
    } catch {
      // Silently fail — sidebar will show fallback
    }
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved === "true") setCollapsed(true);
    loadBranding();
  }, [loadBranding]);

  // Re-fetch branding when org settings change (custom event)
  useEffect(() => {
    const handleBrandingUpdate = () => { loadBranding(); };
    window.addEventListener("org-branding-update", handleBrandingUpdate);
    return () => window.removeEventListener("org-branding-update", handleBrandingUpdate);
  }, [loadBranding]);

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
        <NavContent collapsed={collapsed} onToggle={toggle} orgBranding={orgBranding} />
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
  const [orgBranding, setOrgBranding] = useState<OrgBranding | null>(null);

  const loadBranding = useCallback(async () => {
    try {
      const data = await getOrgBrandingAction();
      setOrgBranding(data);
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    loadBranding();
  }, [loadBranding]);

  useEffect(() => {
    const handleBrandingUpdate = () => { loadBranding(); };
    window.addEventListener("org-branding-update", handleBrandingUpdate);
    return () => window.removeEventListener("org-branding-update", handleBrandingUpdate);
  }, [loadBranding]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="p-0 w-64">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <NavContent collapsed={false} orgBranding={orgBranding} />
      </SheetContent>
    </Sheet>
  );
}

export function MobileNav() {
  const pathname = usePathname();

  const mobileItems = [
    { href: "/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/inbox", label: "Messages", icon: Inbox },
    { href: "/campaigns", label: "Campaigns", icon: MessageSquare },
    { href: "/analytics", label: "Insights", icon: TrendingUp },
    { href: "/settings", label: "Settings", icon: Settings },
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
