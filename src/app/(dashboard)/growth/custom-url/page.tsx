"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Copy, ExternalLink, Link2, Smartphone } from "lucide-react";
import { getGrowthInfoAction } from "@/server/actions/growth";

export default function CustomURLPage() {
  const [loading, setLoading] = useState(true);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [signupUrl, setSignupUrl] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const info = await getGrowthInfoAction();
        setOrgName(info.orgName);
        setOrgSlug(info.orgSlug);
        setSignupUrl(`${window.location.origin}/join/${info.orgSlug}`);
      } catch {
        toast.error("Failed to load organization info");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(signupUrl);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Failed to copy link");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/growth">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Custom Signup URL</h1>
          <p className="text-muted-foreground mt-1">
            Share this link so people can sign up for your contact list.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Link Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              Your Signup Link
            </CardTitle>
            <CardDescription>
              Share this link on social media, email, flyers, or anywhere else to
              grow your contact list.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Shareable URL</Label>
              <div className="flex gap-2">
                <Input
                  value={signupUrl}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button onClick={copyLink} variant="outline" size="icon" className="shrink-0">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex gap-3">
              <Button onClick={copyLink} className="flex-1">
                <Copy className="h-4 w-4 mr-2" />
                Copy Link
              </Button>
              <Link href={`/join/${orgSlug}`} target="_blank" className="flex-1">
                <Button variant="outline" className="w-full">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Preview
                </Button>
              </Link>
            </div>

            <div className="rounded-lg bg-muted p-4 space-y-2">
              <p className="text-sm font-medium">How it works</p>
              <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-4">
                <li>Share this link with your audience</li>
                <li>Visitors enter their phone number on the signup page</li>
                <li>They are added as a contact with pending consent status</li>
                <li>Your activation text message is sent to welcome them</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* Landing Page Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Landing Page Preview
            </CardTitle>
            <CardDescription>
              This is what visitors will see when they open your signup link.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex justify-center">
              {/* Phone frame mockup */}
              <div
                className="relative border-[3px] border-gray-700 dark:border-gray-500 bg-white dark:bg-gray-950"
                style={{
                  width: 260,
                  minHeight: 480,
                  borderRadius: 36,
                }}
              >
                {/* Status bar */}
                <div className="flex items-center justify-between px-6 pt-3 pb-1">
                  <span className="text-[10px] text-gray-400 font-medium">
                    9:41
                  </span>
                  <div
                    className="bg-gray-700 dark:bg-gray-500 rounded-full"
                    style={{ width: 70, height: 20 }}
                  />
                  <div className="flex items-center gap-1">
                    <svg
                      className="text-gray-400"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <rect x="1" y="14" width="4" height="8" rx="1" />
                      <rect x="7" y="10" width="4" height="12" rx="1" />
                      <rect x="13" y="6" width="4" height="16" rx="1" />
                      <rect x="19" y="2" width="4" height="20" rx="1" />
                    </svg>
                  </div>
                </div>

                {/* URL bar */}
                <div className="mx-4 mt-1 mb-3 bg-gray-100 dark:bg-gray-800 rounded-full px-3 py-1.5">
                  <p className="text-[9px] text-gray-500 text-center truncate">
                    {signupUrl.replace(/^https?:\/\//, "")}
                  </p>
                </div>

                {/* Page content preview */}
                <div className="px-5 py-4 space-y-3">
                  <div className="text-center">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                      <span className="text-sm font-bold text-primary">
                        {orgName.charAt(0)}
                      </span>
                    </div>
                    <p className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                      {orgName}
                    </p>
                    <p className="text-[9px] text-gray-500 mt-0.5">
                      Join our contact list
                    </p>
                  </div>

                  {/* Form mockup */}
                  <div className="space-y-2">
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-1.5">
                      <p className="text-[9px] text-gray-400">Phone number</p>
                    </div>
                    <div className="bg-gray-100 dark:bg-gray-800 rounded-md px-2 py-1.5">
                      <p className="text-[9px] text-gray-400">
                        First name (optional)
                      </p>
                    </div>
                    <div className="flex items-start gap-1">
                      <div className="h-2.5 w-2.5 rounded-sm border border-gray-300 mt-0.5 shrink-0" />
                      <p className="text-[7px] text-gray-400 leading-tight">
                        I consent to receive text messages...
                      </p>
                    </div>
                    <div className="bg-primary text-primary-foreground rounded-md py-1.5 text-center">
                      <p className="text-[10px] font-medium">Join</p>
                    </div>
                  </div>
                </div>

                {/* Home indicator */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2">
                  <div
                    className="bg-gray-400 rounded-full"
                    style={{ width: 80, height: 3 }}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
