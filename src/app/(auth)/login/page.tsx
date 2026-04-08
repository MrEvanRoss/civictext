"use client";

import { useState, useRef, useEffect } from "react";
import { signIn, getSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { preAuthenticateAction } from "@/server/actions/two-factor";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"credentials" | "totp" | "setup-required">("credentials");
  const totpInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus TOTP input when switching to step 2
  useEffect(() => {
    if (step === "totp") {
      setTimeout(() => totpInputRef.current?.focus(), 100);
    }
  }, [step]);

  async function handleCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // Step 1: Pre-authenticate to check if 2FA is required
      const preAuth = await preAuthenticateAction(email, password);

      if (!preAuth.valid) {
        setError("Invalid email or password");
        setLoading(false);
        return;
      }

      if (preAuth.requiresTwoFactor) {
        // Switch to TOTP code entry
        setStep("totp");
        setLoading(false);
        return;
      }

      if (preAuth.mustSetup2FA) {
        // Platform requires 2FA for this role but user hasn't set it up yet
        // Sign them in, then redirect to 2FA setup
        await completeSignIn(undefined, "/settings/security?setup=required");
        return;
      }

      // No 2FA — sign in directly
      await completeSignIn();
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleTotpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!totpCode.trim()) {
      setError("Please enter your authentication code");
      return;
    }

    setLoading(true);
    await completeSignIn(totpCode.trim());
  }

  async function completeSignIn(code?: string, redirectTo?: string) {
    try {
      const result = await signIn("credentials", {
        email,
        password,
        totpCode: code || "",
        redirect: false,
      });

      if (result?.error) {
        if (step === "totp") {
          setError("Invalid authentication code. Try again or use a backup code.");
        } else {
          setError("Invalid email or password");
        }
      } else {
        if (redirectTo) {
          router.push(redirectTo);
        } else {
          const session = await getSession();
          const destination = session?.user?.isSuperAdmin ? "/admin/orgs" : "/dashboard";
          router.push(destination);
        }
        router.refresh();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function handleBackToCredentials() {
    setStep("credentials");
    setTotpCode("");
    setError("");
  }

  // Step 2: TOTP Code Entry
  if (step === "totp") {
    return (
      <Card>
        <CardHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold">Two-Factor Authentication</CardTitle>
          <CardDescription>
            Enter the 6-digit code from your authenticator app
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleTotpSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totpCode">Authentication Code</Label>
              <Input
                ref={totpInputRef}
                id="totpCode"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                value={totpCode}
                onChange={(e) => {
                  // Allow digits for 6-digit TOTP codes, plus letters/dashes for backup codes (max 10 chars)
                  const val = e.target.value.replace(/[^0-9A-Za-z-]/g, "").slice(0, 10);
                  setTotpCode(val);
                }}
                className="text-center text-2xl tracking-[0.5em] font-mono"
                required
              />
              <p className="text-xs text-muted-foreground text-center">
                You can also enter a backup code
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Verifying..." : "Verify"}
            </Button>
            <button
              type="button"
              onClick={handleBackToCredentials}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 justify-center"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to sign in
            </button>
          </CardFooter>
        </form>
      </Card>
    );
  }

  // Step 1: Email + Password
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">CivicText</CardTitle>
        <CardDescription>Sign in to your account</CardDescription>
      </CardHeader>
      <form onSubmit={handleCredentialsSubmit}>
        <CardContent className="space-y-4">
          {error && (
            <div role="alert" className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="you@organization.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
          <p className="text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-primary hover:underline">
              Register
            </Link>
          </p>
        </CardFooter>
      </form>
    </Card>
  );
}
