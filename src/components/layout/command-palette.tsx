"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  LayoutDashboard,
  Inbox,
  MessageSquare,
  FileText,
  Users,
  Hash,
  Shield,
  BarChart3,
  Phone,
  CreditCard,
  UserPlus,
  Settings,
  Plus,
  Moon,
  Sun,
} from "lucide-react";
import { useTheme } from "next-themes";

const pages = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, keywords: ["home", "overview"] },
  { href: "/inbox", label: "Inbox", icon: Inbox, keywords: ["messages", "conversations", "replies"] },
  { href: "/campaigns", label: "Campaigns", icon: MessageSquare, keywords: ["broadcast", "p2p", "drip", "send"] },
  { href: "/templates", label: "Templates", icon: FileText, keywords: ["quick reply", "scripts"] },
  { href: "/contacts", label: "Contacts", icon: Users, keywords: ["people", "list", "import"] },
  { href: "/interest-lists", label: "Interest Lists", icon: Hash, keywords: ["keywords", "subscribe"] },
  { href: "/supervisor", label: "Supervisor", icon: Shield, keywords: ["agents", "escalations", "monitor"] },
  { href: "/analytics", label: "Analytics", icon: BarChart3, keywords: ["reports", "stats", "metrics"] },
  { href: "/phone-numbers", label: "Phone Numbers", icon: Phone, keywords: ["twilio", "10dlc", "numbers"] },
  { href: "/billing", label: "Billing", icon: CreditCard, keywords: ["plan", "balance", "credits", "usage"] },
  { href: "/team", label: "Team", icon: UserPlus, keywords: ["members", "invite", "roles"] },
  { href: "/settings", label: "Settings", icon: Settings, keywords: ["org", "configuration", "webhooks"] },
  { href: "/settings/security", label: "Security / 2FA", icon: Shield, keywords: ["two-factor", "authentication", "totp", "backup codes"] },
];

const actions = [
  { id: "new-campaign", label: "Create Campaign", icon: Plus, href: "/campaigns/new", keywords: ["new", "start"] },
  { id: "import-contacts", label: "Import Contacts", icon: Plus, href: "/contacts", keywords: ["csv", "upload"] },
  { id: "new-template", label: "Create Template", icon: Plus, href: "/templates", keywords: ["quick reply"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, actions..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        <CommandGroup heading="Pages">
          {pages.map((page) => (
            <CommandItem
              key={page.href}
              value={`${page.label} ${page.keywords.join(" ")}`}
              onSelect={() => navigate(page.href)}
            >
              <page.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {page.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Quick Actions">
          {actions.map((action) => (
            <CommandItem
              key={action.id}
              value={`${action.label} ${action.keywords.join(" ")}`}
              onSelect={() => navigate(action.href)}
            >
              <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
              {action.label}
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Theme">
          <CommandItem
            value="toggle dark mode light mode theme"
            onSelect={() => {
              setTheme(theme === "dark" ? "light" : "dark");
              setOpen(false);
            }}
          >
            {theme === "dark" ? (
              <Sun className="mr-2 h-4 w-4 text-muted-foreground" />
            ) : (
              <Moon className="mr-2 h-4 w-4 text-muted-foreground" />
            )}
            Toggle {theme === "dark" ? "Light" : "Dark"} Mode
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
