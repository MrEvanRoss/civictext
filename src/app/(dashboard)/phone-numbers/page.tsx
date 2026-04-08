"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  getRegistrationStatusAction,
  releasePhoneNumberAction,
} from "@/server/actions/twilio";
import {
  Phone,
  Plus,
  Shield,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface RegistrationStatus {
  hasSubaccount: boolean;
  hasMessagingService: boolean;
  brandRegistrations: any[];
  campaignRegistrations: any[];
  phoneNumbers: any[];
  isFullyRegistered: boolean;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "APPROVED":
      return <Badge variant="success">Approved</Badge>;
    case "PENDING":
      return <Badge variant="warning">Pending</Badge>;
    case "REJECTED":
    case "FAILED":
      return <Badge variant="destructive">Rejected</Badge>;
    case "ACTIVE":
      return <Badge variant="success">Active</Badge>;
    case "RELEASED":
      return <Badge variant="secondary">Released</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function PhoneNumbersPage() {
  const [status, setStatus] = useState<RegistrationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadStatus();
  }, []);

  async function loadStatus() {
    try {
      const data = await getRegistrationStatusAction();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || "Failed to load registration status");
    } finally {
      setLoading(false);
    }
  }

  async function handleRelease(phoneNumberId: string) {
    if (!confirm("Are you sure you want to release this phone number? This cannot be undone.")) {
      return;
    }

    try {
      await releasePhoneNumberAction(phoneNumberId);
      toast.success("Phone number released successfully");
      await loadStatus();
    } catch (err: any) {
      toast.error(err.message || "Failed to release phone number");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-9 w-48" />
            <Skeleton className="h-4 w-72 mt-2" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-4 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-28 mt-1" />
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasNoSetup = !status?.hasSubaccount;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Phone Numbers</h1>
          <p className="text-muted-foreground">
            Manage your phone numbers and carrier registration.
          </p>
        </div>
        <Link href="/phone-numbers/register">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            {hasNoSetup ? "Start Registration" : "Add Numbers"}
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Empty state */}
      {hasNoSetup && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Phone className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h2 className="text-xl font-semibold mb-2">
              No Phone Numbers Yet
            </h2>
            <p className="text-muted-foreground text-center max-w-md mb-2">
              To send text messages, you need to register your brand with carriers
              and provision phone numbers. This process takes 5-15 business days.
            </p>
            <p className="text-sm text-muted-foreground mb-6">
              Phone numbers cost <span className="font-medium">$5.00/month</span> each, charged from your prepaid balance.
            </p>
            <Link href="/phone-numbers/register">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Start Registration
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Registration Status Overview */}
      {!hasNoSetup && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Messaging Account
                </CardTitle>
                {status?.hasSubaccount ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {status?.hasSubaccount
                    ? "Account provisioned"
                    : "Not provisioned"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Brand Registration
                </CardTitle>
                {status?.brandRegistrations.some(
                  (b) => b.status === "APPROVED"
                ) ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : status?.brandRegistrations.some(
                    (b) => b.status === "PENDING"
                  ) ? (
                  <Clock className="h-4 w-4 text-warning" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {status?.brandRegistrations.length
                    ? `${status.brandRegistrations[0].status} - ${status.brandRegistrations[0].brandName}`
                    : "No brand registered"}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Campaign Registration
                </CardTitle>
                {status?.campaignRegistrations.some(
                  (c) => c.status === "APPROVED"
                ) ? (
                  <CheckCircle2 className="h-4 w-4 text-success" />
                ) : status?.campaignRegistrations.some(
                    (c) => c.status === "PENDING"
                  ) ? (
                  <Clock className="h-4 w-4 text-warning" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-muted-foreground" />
                )}
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  {status?.campaignRegistrations.length
                    ? `${status.campaignRegistrations[0].status} - ${status.campaignRegistrations[0].useCase}`
                    : "No campaign registered"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Fully registered banner */}
          {status?.isFullyRegistered && (
            <div className="rounded-md bg-success/10 border border-success/30 p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-success" />
              <div>
                <p className="text-sm font-medium text-success">
                  Fully Registered
                </p>
                <p className="text-xs text-success">
                  Your brand and campaign are approved. You can send messages at
                  full throughput.
                </p>
              </div>
            </div>
          )}

          {/* Phone Numbers Table */}
          <Card>
            <CardHeader>
              <CardTitle>Phone Numbers</CardTitle>
              <CardDescription>
                {status?.phoneNumbers.length || 0} active number
                {status?.phoneNumbers.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {status?.phoneNumbers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <Phone className="h-8 w-8 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No phone numbers provisioned yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-2 font-medium">
                          Phone Number
                        </th>
                        <th className="text-left py-3 px-2 font-medium">
                          Capabilities
                        </th>
                        <th className="text-left py-3 px-2 font-medium">
                          Status
                        </th>
                        <th className="text-right py-3 px-2 font-medium">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {status?.phoneNumbers.map((num: any) => (
                        <tr key={num.id} className="border-b last:border-0">
                          <td className="py-3 px-2 font-mono">
                            {num.phoneNumber}
                          </td>
                          <td className="py-3 px-2">
                            <div className="flex gap-1">
                              {num.capabilities?.sms && (
                                <Badge variant="outline">SMS</Badge>
                              )}
                              {num.capabilities?.mms && (
                                <Badge variant="outline">MMS</Badge>
                              )}
                              {num.capabilities?.voice && (
                                <Badge variant="outline">Voice</Badge>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-2">
                            <StatusBadge status={num.status} />
                          </td>
                          <td className="py-3 px-2 text-right">
                            {num.status === "ACTIVE" && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleRelease(num.id)}
                              >
                                Release
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Brand Registrations */}
          {status && status.brandRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Brand Registrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.brandRegistrations.map((brand: any) => (
                    <div
                      key={brand.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {brand.brandName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {brand.brandType} &middot; Submitted{" "}
                          {new Date(brand.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <StatusBadge status={brand.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Campaign Registrations */}
          {status && status.campaignRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Campaign Registrations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {status.campaignRegistrations.map((campaign: any) => (
                    <div
                      key={campaign.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div>
                        <p className="font-medium text-sm">
                          {campaign.useCase}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {campaign.description?.slice(0, 80)}...
                        </p>
                      </div>
                      <StatusBadge status={campaign.status} />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
