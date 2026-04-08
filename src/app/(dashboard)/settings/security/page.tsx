"use client";

import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShieldCheck,
  ShieldOff,
  Copy,
  Check,
  Download,
  ArrowLeft,
  RefreshCw,
  KeyRound,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import {
  getTwoFactorStatusAction,
  beginTwoFactorSetupAction,
  confirmTwoFactorSetupAction,
  disableTwoFactorAction,
  regenerateBackupCodesAction,
} from "@/server/actions/two-factor";

type SetupStep = "idle" | "scanning" | "verifying" | "backup-codes";

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [backupCodesRemaining, setBackupCodesRemaining] = useState(0);

  // Setup flow state
  const [setupStep, setSetupStep] = useState<SetupStep>("idle");
  const [setupSecret, setSetupSecret] = useState("");
  const [qrCodeUrl, setQrCodeUrl] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [copiedCodes, setCopiedCodes] = useState(false);

  // Disable flow state
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const copiedCodesTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (copiedCodesTimeoutRef.current) {
        clearTimeout(copiedCodesTimeoutRef.current);
      }
    };
  }, []);

  // Regenerate backup codes state
  const [showRegenDialog, setShowRegenDialog] = useState(false);
  const [regenPassword, setRegenPassword] = useState("");
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    setLoading(true);
    try {
      const status = await getTwoFactorStatusAction();
      setTwoFactorEnabled(status.enabled);
      setBackupCodesRemaining(status.backupCodesRemaining);
    } catch (err: any) {
      toast.error(err.message || "Failed to load security settings");
    } finally {
      setLoading(false);
    }
  }

  // ---- Setup Flow ----
  async function handleBeginSetup() {
    try {
      const result = await beginTwoFactorSetupAction();
      setSetupSecret(result.secret);
      setQrCodeUrl(result.qrCodeDataUrl);
      setSetupStep("scanning");
    } catch (err: any) {
      toast.error(err.message || "Failed to start 2FA setup");
    }
  }

  async function handleVerifySetup(e: React.FormEvent) {
    e.preventDefault();
    if (!verifyCode.trim()) return;
    setVerifyLoading(true);
    try {
      const result = await confirmTwoFactorSetupAction(setupSecret, verifyCode.trim());
      setBackupCodes(result.backupCodes);
      setTwoFactorEnabled(true);
      setBackupCodesRemaining(result.backupCodes.length);
      setSetupStep("backup-codes");
      toast.success("Two-factor authentication enabled!");
    } catch (err: any) {
      toast.error(err.message || "Invalid code");
    } finally {
      setVerifyLoading(false);
    }
  }

  function handleCancelSetup() {
    setSetupStep("idle");
    setSetupSecret("");
    setQrCodeUrl("");
    setVerifyCode("");
  }

  // ---- Disable Flow ----
  async function handleDisable() {
    if (!disablePassword) {
      toast.error("Password is required");
      return;
    }
    setDisableLoading(true);
    try {
      await disableTwoFactorAction(disablePassword);
      setTwoFactorEnabled(false);
      setBackupCodesRemaining(0);
      setShowDisableDialog(false);
      setDisablePassword("");
      toast.success("Two-factor authentication disabled");
    } catch (err: any) {
      toast.error(err.message || "Failed to disable 2FA");
    } finally {
      setDisableLoading(false);
    }
  }

  // ---- Regenerate Backup Codes ----
  async function handleRegenerate() {
    if (!regenPassword) {
      toast.error("Password is required");
      return;
    }
    setRegenLoading(true);
    try {
      const result = await regenerateBackupCodesAction(regenPassword);
      setBackupCodes(result.backupCodes);
      setBackupCodesRemaining(result.backupCodes.length);
      setShowRegenDialog(false);
      setRegenPassword("");
      setSetupStep("backup-codes");
      toast.success("New backup codes generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to regenerate backup codes");
    } finally {
      setRegenLoading(false);
    }
  }

  // ---- Helpers ----
  function copyBackupCodes() {
    const text = backupCodes.join("\n");
    navigator.clipboard.writeText(text);
    setCopiedCodes(true);
    toast.success("Backup codes copied to clipboard");
    if (copiedCodesTimeoutRef.current) {
      clearTimeout(copiedCodesTimeoutRef.current);
    }
    copiedCodesTimeoutRef.current = setTimeout(() => setCopiedCodes(false), 2000);
  }

  function downloadBackupCodes() {
    const text = `CivicText Backup Codes\n${"=".repeat(30)}\n\nKeep these codes in a safe place. Each code can only be used once.\n\n${backupCodes.join("\n")}\n\nGenerated: ${new Date().toISOString()}\n`;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "civictext-backup-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-9 w-48 mb-2" />
          <Skeleton className="h-5 w-72" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48 mb-1" />
            <Skeleton className="h-4 w-72" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-24 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Security</h1>
        <p className="text-muted-foreground">
          Manage your account security and two-factor authentication.
        </p>
      </div>

      {/* 2FA Status Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {twoFactorEnabled ? (
                <div className="h-10 w-10 rounded-full bg-success/10 flex items-center justify-center">
                  <ShieldCheck className="h-5 w-5 text-success" />
                </div>
              ) : (
                <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              <div>
                <CardTitle>Two-Factor Authentication</CardTitle>
                <CardDescription>
                  Add an extra layer of security with an authenticator app
                </CardDescription>
              </div>
            </div>
            <Badge variant={twoFactorEnabled ? "success" : "secondary"}>
              {twoFactorEnabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {twoFactorEnabled ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Your account is protected with TOTP-based two-factor authentication.
                You&apos;ll be asked for a code from your authenticator app each time you sign in.
              </p>

              {/* Backup Codes Status */}
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <KeyRound className="h-5 w-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Backup Codes</p>
                  <p className="text-xs text-muted-foreground">
                    {backupCodesRemaining} of 10 codes remaining
                  </p>
                </div>
                {backupCodesRemaining < 3 && (
                  <Badge variant="destructive" className="text-[10px]">Low</Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRegenDialog(true)}
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Regenerate
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Two-factor authentication adds an extra layer of security to your account.
                When enabled, you&apos;ll need both your password and a code from an authenticator
                app (like Google Authenticator, Authy, or 1Password) to sign in.
              </p>
              <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                <Smartphone className="h-5 w-5 text-primary" />
                <p className="text-sm text-primary/80">
                  You&apos;ll need an authenticator app on your phone to set up 2FA.
                </p>
              </div>
            </div>
          )}
        </CardContent>
        <CardFooter className="justify-end gap-2">
          {twoFactorEnabled ? (
            <Button variant="destructive" onClick={() => setShowDisableDialog(true)}>
              <ShieldOff className="h-4 w-4 mr-2" />
              Disable 2FA
            </Button>
          ) : (
            <Button onClick={handleBeginSetup}>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Enable 2FA
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Setup Flow: Scanning QR Code */}
      {setupStep === "scanning" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Step 1: Scan QR Code</CardTitle>
            <CardDescription>
              Open your authenticator app and scan this QR code
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrCodeUrl}
                alt="TOTP QR Code"
                className="w-64 h-64 rounded-lg border p-2 bg-white"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">
                Can&apos;t scan? Enter this code manually:
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 rounded bg-muted text-xs font-mono break-all select-all">
                  {setupSecret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(setupSecret);
                    toast.success("Secret copied");
                  }}
                  className="shrink-0"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="ghost" onClick={handleCancelSetup}>
              Cancel
            </Button>
            <Button onClick={() => setSetupStep("verifying")}>
              I&apos;ve scanned the code
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Setup Flow: Verify Code */}
      {setupStep === "verifying" && (
        <Card className="border-primary/30">
          <CardHeader>
            <CardTitle>Step 2: Verify Code</CardTitle>
            <CardDescription>
              Enter the 6-digit code from your authenticator app to confirm setup
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleVerifySetup}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="verifyCode">Verification Code</Label>
                <Input
                  id="verifyCode"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="000000"
                  value={verifyCode}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setVerifyCode(val);
                  }}
                  className="text-center text-2xl tracking-[0.5em] font-mono max-w-xs mx-auto"
                  autoFocus
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="justify-between">
              <Button variant="ghost" type="button" onClick={() => setSetupStep("scanning")}>
                Back
              </Button>
              <Button type="submit" disabled={verifyCode.length !== 6 || verifyLoading}>
                {verifyLoading ? "Verifying..." : "Verify & Enable"}
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}

      {/* Setup Flow / Regenerate: Backup Codes */}
      {setupStep === "backup-codes" && backupCodes.length > 0 && (
        <Card className="border-success/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Backup Codes
            </CardTitle>
            <CardDescription>
              Save these codes in a safe place. Each code can only be used once if you
              lose access to your authenticator app.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg border">
              {backupCodes.map((code, i) => (
                <div
                  key={i}
                  className="font-mono text-sm text-center py-1.5 bg-card rounded border"
                >
                  {code}
                </div>
              ))}
            </div>

            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={copyBackupCodes}>
                {copiedCodes ? (
                  <Check className="h-3 w-3 mr-1" />
                ) : (
                  <Copy className="h-3 w-3 mr-1" />
                )}
                {copiedCodes ? "Copied" : "Copy"}
              </Button>
              <Button variant="outline" size="sm" onClick={downloadBackupCodes}>
                <Download className="h-3 w-3 mr-1" />
                Download
              </Button>
            </div>

            <div className="rounded-md bg-warning/10 border border-warning/20 p-3 text-sm text-warning">
              <strong>Important:</strong> These codes will not be shown again.
              Store them securely before closing this dialog.
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button
              onClick={() => {
                setSetupStep("idle");
                setBackupCodes([]);
                setVerifyCode("");
                setSetupSecret("");
                setQrCodeUrl("");
              }}
            >
              I&apos;ve saved my codes
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Disable 2FA Dialog */}
      <AlertDialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable Two-Factor Authentication?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove the extra security from your account. You&apos;ll only need
              your password to sign in. Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label htmlFor="disablePassword">Password</Label>
            <Input
              id="disablePassword"
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleDisable();
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDisablePassword("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisable}
              disabled={!disablePassword || disableLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disableLoading ? "Disabling..." : "Disable 2FA"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Regenerate Backup Codes Dialog */}
      <AlertDialog open={showRegenDialog} onOpenChange={setShowRegenDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Regenerate Backup Codes?</AlertDialogTitle>
            <AlertDialogDescription>
              This will invalidate all existing backup codes and generate 10 new ones.
              Enter your password to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-6 pb-2">
            <Label htmlFor="regenPassword">Password</Label>
            <Input
              id="regenPassword"
              type="password"
              value={regenPassword}
              onChange={(e) => setRegenPassword(e.target.value)}
              placeholder="Enter your password"
              className="mt-1.5"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleRegenerate();
              }}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setRegenPassword("")}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRegenerate}
              disabled={!regenPassword || regenLoading}
            >
              {regenLoading ? "Generating..." : "Generate New Codes"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
