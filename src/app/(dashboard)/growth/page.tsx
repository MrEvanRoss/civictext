"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Link2,
  QrCode,
  MessageCircle,
  Globe,
  FileInput,
  Upload,
  ArrowRight,
} from "lucide-react";

const tools = [
  {
    title: "Custom URL",
    description: "Share a link that people can use to join your contact list",
    icon: Link2,
    href: "/growth/custom-url",
    actionLabel: "Configure",
  },
  {
    title: "QR Code",
    description: "Generate a QR code for contacts to scan and join via text",
    icon: QrCode,
    href: "/growth/qr-code",
    actionLabel: "Generate QR Code",
  },
  {
    title: "Activation Text",
    description: "Configure the welcome message sent to new members",
    icon: MessageCircle,
    href: "/growth/activation-text",
    actionLabel: "Edit Message",
  },
  {
    title: "Website Signup",
    description: "Add a signup form or popup to your website",
    icon: Globe,
    href: "/growth/popup",
    actionLabel: "Set Up",
  },
  {
    title: "External Forms",
    description: "Connect external forms to auto-import contacts",
    icon: FileInput,
    href: "/growth/integrations",
    actionLabel: "Configure",
  },
  {
    title: "CSV Import",
    description: "Import contacts from a spreadsheet file",
    icon: Upload,
    href: "/contacts/import",
    actionLabel: "Import",
  },
];

export default function GrowthToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Growth Tools</h1>
        <p className="text-muted-foreground mt-1">
          Grow your contact list with signup links, QR codes, website forms, and
          more.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tools.map((tool) => (
          <Card
            key={tool.title}
            className="group hover:shadow-md transition-shadow"
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <tool.icon className="h-5 w-5 text-primary" />
                </div>
              </div>
              <CardTitle className="text-lg mt-3">{tool.title}</CardTitle>
              <CardDescription>{tool.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={tool.href}>
                <Button variant="outline" className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {tool.actionLabel}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
