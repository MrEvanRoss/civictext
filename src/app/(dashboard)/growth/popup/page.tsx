"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, Globe, Construction } from "lucide-react";

export default function WebsitePopupPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/growth">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website Signup</h1>
          <p className="text-muted-foreground mt-1">
            Add a signup popup or form to your website.
          </p>
        </div>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
              <Construction className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Website Signup — Coming Soon
              </CardTitle>
              <CardDescription>
                This feature is under development.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Soon you will be able to generate an embeddable popup widget for your
            website. When visitors enter their phone number, they will be
            automatically added to your CivicText contact list.
          </p>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Planned features:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>Customizable popup trigger (exit intent, timer, scroll)</li>
              <li>Embed code snippet for any website</li>
              <li>Brand color and text customization</li>
              <li>Mobile-responsive design</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            In the meantime, use your{" "}
            <Link href="/growth/custom-url" className="text-primary underline">
              Custom URL
            </Link>{" "}
            to collect signups by sharing a direct link.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
