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
import { ArrowLeft, Code, Construction } from "lucide-react";

export default function WebsiteEmbedPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/growth">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Website Embed</h1>
          <p className="text-muted-foreground mt-1">
            Embed a signup form directly into your website.
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
                <Code className="h-5 w-5" />
                Website Embed — Coming Soon
              </CardTitle>
              <CardDescription>
                This feature is under development.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Soon you will be able to generate an inline embed code that places a
            signup form directly within your website&apos;s content, such as in a
            sidebar, footer, or landing page section.
          </p>
          <div className="rounded-lg bg-muted p-4">
            <p className="text-sm font-medium mb-2">Planned features:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-4">
              <li>Copy-paste embed code (HTML/JavaScript)</li>
              <li>Customizable form fields and styling</li>
              <li>Inline and floating form options</li>
              <li>TCPA-compliant consent language</li>
            </ul>
          </div>
          <p className="text-sm text-muted-foreground">
            In the meantime, link to your{" "}
            <Link href="/growth/custom-url" className="text-primary underline">
              Custom Signup URL
            </Link>{" "}
            from your website.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
