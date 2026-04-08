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
import { ArrowLeft, FileInput, Construction } from "lucide-react";

export default function ExternalFormsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/growth">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            External Form Integrations
          </h1>
          <p className="text-muted-foreground mt-1">
            Connect external forms to automatically import contacts.
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
                <FileInput className="h-5 w-5" />
                External Form Integration — Coming Soon
              </CardTitle>
              <CardDescription>
                This feature is under development.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Soon you will be able to connect form builders like Typeform, Google
            Forms, and JotForm to automatically import submissions as contacts
            in CivicText.
          </p>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Planned features:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>Webhook endpoint for form submissions</li>
              <li>Zapier and Make.com integration</li>
              <li>Field mapping for custom form fields</li>
              <li>Automatic opt-in status assignment</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            In the meantime, you can{" "}
            <Link href="/contacts/import" className="text-primary underline">
              import contacts via CSV
            </Link>{" "}
            after collecting them through your forms.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
