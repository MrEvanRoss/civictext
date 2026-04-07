"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Steps } from "@/components/ui/steps";
import { USE_CASE_TEMPLATES } from "@/lib/validators/twilio";
import {
  provisionSubaccountAction,
  createMessagingServiceAction,
  registerBrandAction,
  registerCampaignAction,
  provisionPhoneNumbersAction,
} from "@/server/actions/twilio";
import { getBillingOverviewAction } from "@/server/actions/billing";

const WIZARD_STEPS = [
  { title: "Brand Info", description: "Business details" },
  { title: "Campaign Use Case", description: "Message type" },
  { title: "Phone Number", description: "Get a number" },
  { title: "Review & Submit", description: "Confirm details" },
];

const BRAND_TYPES = [
  { value: "political", label: "Political Campaign" },
  { value: "government", label: "Government / Municipality" },
  { value: "nonprofit", label: "Nonprofit Organization" },
  { value: "advocacy", label: "Advocacy Group / PAC" },
];

const USE_CASES = [
  { value: "voter_outreach", label: "Voter Outreach" },
  { value: "event_notifications", label: "Event Notifications" },
  { value: "donation_solicitation", label: "Donation Solicitation" },
  { value: "government_alerts", label: "Government Alerts" },
  { value: "advocacy_action_alerts", label: "Advocacy Action Alerts" },
  { value: "general_political", label: "General Political" },
];

interface BrandForm {
  brandName: string;
  ein: string;
  brandType: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  website: string;
  contactEmail: string;
  contactPhone: string;
}

interface CampaignForm {
  useCase: string;
  description: string;
  sampleMessages: string[];
  messageFlow: string;
}

interface PhoneForm {
  areaCode: string;
  quantity: number;
}

export default function RegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [balanceCents, setBalanceCents] = useState(0);
  const [phoneFeeCents, setPhoneFeeCents] = useState(500);

  useEffect(() => {
    getBillingOverviewAction().then((data) => {
      setBalanceCents(data.plan?.balanceCents || 0);
      setPhoneFeeCents(data.plan?.phoneNumberFeeCents || 500);
    }).catch(() => {});
  }, []);

  const [brandForm, setBrandForm] = useState<BrandForm>({
    brandName: "",
    ein: "",
    brandType: "",
    street: "",
    city: "",
    state: "",
    postalCode: "",
    website: "",
    contactEmail: "",
    contactPhone: "",
  });

  const [campaignForm, setCampaignForm] = useState<CampaignForm>({
    useCase: "",
    description: "",
    sampleMessages: ["", ""],
    messageFlow: "",
  });

  const [phoneForm, setPhoneForm] = useState<PhoneForm>({
    areaCode: "",
    quantity: 1,
  });

  function applyTemplate(useCase: string) {
    const template = USE_CASE_TEMPLATES[useCase];
    if (template) {
      setCampaignForm({
        useCase,
        description: template.description,
        sampleMessages: [...template.sampleMessages],
        messageFlow: template.messageFlow,
      });
    } else {
      setCampaignForm((prev) => ({ ...prev, useCase }));
    }
  }

  function updateSampleMessage(index: number, value: string) {
    setCampaignForm((prev) => {
      const msgs = [...prev.sampleMessages];
      msgs[index] = value;
      return { ...prev, sampleMessages: msgs };
    });
  }

  function addSampleMessage() {
    if (campaignForm.sampleMessages.length < 5) {
      setCampaignForm((prev) => ({
        ...prev,
        sampleMessages: [...prev.sampleMessages, ""],
      }));
    }
  }

  function removeSampleMessage(index: number) {
    if (campaignForm.sampleMessages.length > 2) {
      setCampaignForm((prev) => ({
        ...prev,
        sampleMessages: prev.sampleMessages.filter((_, i) => i !== index),
      }));
    }
  }

  async function handleSubmit() {
    setLoading(true);
    setError("");

    try {
      // Step 1: Provision messaging account
      await provisionSubaccountAction();
      await createMessagingServiceAction();

      // Step 2: Register brand
      await registerBrandAction({
        brandName: brandForm.brandName,
        ein: brandForm.ein || undefined,
        brandType: brandForm.brandType as any,
        address: {
          street: brandForm.street,
          city: brandForm.city,
          state: brandForm.state,
          postalCode: brandForm.postalCode,
        },
        website: brandForm.website || undefined,
        contactEmail: brandForm.contactEmail,
        contactPhone: brandForm.contactPhone,
      });

      // Step 3: Provision phone numbers
      await provisionPhoneNumbersAction({
        areaCode: phoneForm.areaCode || undefined,
        quantity: phoneForm.quantity,
      });

      // Note: Campaign registration requires brand approval first,
      // so we save the intent and register once brand is approved
      router.push("/phone-numbers?registered=true");
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function canProceed(): boolean {
    switch (step) {
      case 0:
        return !!(
          brandForm.brandName &&
          brandForm.brandType &&
          brandForm.street &&
          brandForm.city &&
          brandForm.state &&
          brandForm.postalCode &&
          brandForm.contactEmail &&
          brandForm.contactPhone
        );
      case 1:
        return !!(
          campaignForm.useCase &&
          campaignForm.description.length >= 40 &&
          campaignForm.sampleMessages.filter((m) => m.length >= 20).length >= 2 &&
          campaignForm.messageFlow.length >= 20
        );
      case 2:
        return phoneForm.quantity >= 1 && phoneForm.quantity <= 20;
      default:
        return true;
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Brand Registration</h1>
        <p className="text-muted-foreground">
          Register your brand and campaign to send text messages at scale.
        </p>
      </div>

      <Steps steps={WIZARD_STEPS} currentStep={step} />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Step 0: Brand Information */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Brand Information</CardTitle>
            <CardDescription>
              Your business details for carrier registration. This information is
              submitted for carrier verification.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brandName">Organization Name *</Label>
                <Input
                  id="brandName"
                  value={brandForm.brandName}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, brandName: e.target.value }))
                  }
                  placeholder="e.g., Citizens for Progress"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="brandType">Organization Type *</Label>
                <Select
                  id="brandType"
                  value={brandForm.brandType}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, brandType: e.target.value }))
                  }
                >
                  <option value="">Select type...</option>
                  {BRAND_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ein">EIN (optional)</Label>
                <Input
                  id="ein"
                  value={brandForm.ein}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, ein: e.target.value }))
                  }
                  placeholder="XX-XXXXXXX"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="website">Website (optional)</Label>
                <Input
                  id="website"
                  value={brandForm.website}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, website: e.target.value }))
                  }
                  placeholder="https://example.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Address *</Label>
              <Input
                value={brandForm.street}
                onChange={(e) =>
                  setBrandForm((p) => ({ ...p, street: e.target.value }))
                }
                placeholder="Street address"
              />
              <div className="grid grid-cols-3 gap-4">
                <Input
                  value={brandForm.city}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, city: e.target.value }))
                  }
                  placeholder="City"
                />
                <Input
                  value={brandForm.state}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, state: e.target.value.toUpperCase().slice(0, 2) }))
                  }
                  placeholder="State (e.g., CA)"
                  maxLength={2}
                />
                <Input
                  value={brandForm.postalCode}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, postalCode: e.target.value }))
                  }
                  placeholder="ZIP Code"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email *</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={brandForm.contactEmail}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, contactEmail: e.target.value }))
                  }
                  placeholder="admin@example.com"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone *</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={brandForm.contactPhone}
                  onChange={(e) =>
                    setBrandForm((p) => ({ ...p, contactPhone: e.target.value }))
                  }
                  placeholder="+15551234567"
                />
              </div>
            </div>
          </CardContent>
          <CardFooter className="justify-end">
            <Button onClick={() => setStep(1)} disabled={!canProceed()}>
              Next: Campaign Use Case
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 1: Campaign Use Case */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Campaign Use Case</CardTitle>
            <CardDescription>
              Describe how you will use text messaging. Select a template to
              auto-fill with pre-approved content.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="useCase">Use Case *</Label>
              <Select
                id="useCase"
                value={campaignForm.useCase}
                onChange={(e) => applyTemplate(e.target.value)}
              >
                <option value="">Select use case...</option>
                {USE_CASES.map((uc) => (
                  <option key={uc.value} value={uc.value}>
                    {uc.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description * (min 40 characters)
              </Label>
              <Textarea
                id="description"
                value={campaignForm.description}
                onChange={(e) =>
                  setCampaignForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder="Describe your messaging use case in detail..."
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                {campaignForm.description.length}/40 characters minimum
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Sample Messages * (min 2, each min 20 characters)</Label>
                {campaignForm.sampleMessages.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addSampleMessage}
                  >
                    Add Sample
                  </Button>
                )}
              </div>
              {campaignForm.sampleMessages.map((msg, i) => (
                <div key={i} className="flex gap-2">
                  <Textarea
                    value={msg}
                    onChange={(e) => updateSampleMessage(i, e.target.value)}
                    placeholder={`Sample message ${i + 1}...`}
                    rows={2}
                  />
                  {campaignForm.sampleMessages.length > 2 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeSampleMessage(i)}
                      className="shrink-0 text-destructive"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="messageFlow">
                Message Flow * (min 20 characters)
              </Label>
              <Textarea
                id="messageFlow"
                value={campaignForm.messageFlow}
                onChange={(e) =>
                  setCampaignForm((p) => ({ ...p, messageFlow: e.target.value }))
                }
                placeholder="How do contacts opt in? How often will they receive messages?"
                rows={3}
              />
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button onClick={() => setStep(2)} disabled={!canProceed()}>
              Next: Phone Number
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Phone Number */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Phone Number</CardTitle>
            <CardDescription>
              Choose an area code and number of phone numbers to provision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="areaCode">
                  Preferred Area Code (optional)
                </Label>
                <Input
                  id="areaCode"
                  value={phoneForm.areaCode}
                  onChange={(e) =>
                    setPhoneForm((p) => ({
                      ...p,
                      areaCode: e.target.value.replace(/\D/g, "").slice(0, 3),
                    }))
                  }
                  placeholder="e.g., 202"
                  maxLength={3}
                />
                <p className="text-xs text-muted-foreground">
                  Leave blank for any available number.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quantity">Number of Phone Numbers *</Label>
                <Input
                  id="quantity"
                  type="number"
                  min={1}
                  max={20}
                  value={phoneForm.quantity}
                  onChange={(e) =>
                    setPhoneForm((p) => ({
                      ...p,
                      quantity: Math.min(20, Math.max(1, parseInt(e.target.value) || 1)),
                    }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  More numbers help with throughput. 1 number = ~1 message/second.
                </p>
              </div>
            </div>

            <div className="rounded-md bg-blue-50 border border-blue-200 p-4 text-sm text-blue-800">
              <p className="font-medium">Pricing</p>
              <p className="mt-1">
                Each phone number costs <span className="font-bold">${(phoneFeeCents / 100).toFixed(2)}/month</span>.
                The first month is charged immediately from your balance.
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span>
                  {phoneForm.quantity} number{phoneForm.quantity !== 1 ? "s" : ""} &times; ${(phoneFeeCents / 100).toFixed(2)} = <span className="font-bold">${((phoneForm.quantity * phoneFeeCents) / 100).toFixed(2)}</span>
                </span>
                <span className={balanceCents >= phoneForm.quantity * phoneFeeCents ? "text-green-700" : "text-red-700 font-medium"}>
                  Balance: ${(balanceCents / 100).toFixed(2)}
                </span>
              </div>
              {balanceCents < phoneForm.quantity * phoneFeeCents && (
                <p className="mt-2 text-red-700 font-medium">
                  Insufficient balance. Add at least ${(((phoneForm.quantity * phoneFeeCents) - balanceCents) / 100).toFixed(2)} to proceed.
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button onClick={() => setStep(3)} disabled={!canProceed()}>
              Next: Review
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Review & Submit */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
            <CardDescription>
              Review your registration details. Brand approval typically takes
              5-15 business days.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">Brand Information</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Organization</dt>
                <dd>{brandForm.brandName}</dd>
                <dt className="text-muted-foreground">Type</dt>
                <dd>
                  {BRAND_TYPES.find((t) => t.value === brandForm.brandType)?.label}
                </dd>
                <dt className="text-muted-foreground">Address</dt>
                <dd>
                  {brandForm.street}, {brandForm.city}, {brandForm.state}{" "}
                  {brandForm.postalCode}
                </dd>
                <dt className="text-muted-foreground">Contact</dt>
                <dd>
                  {brandForm.contactEmail} / {brandForm.contactPhone}
                </dd>
                {brandForm.ein && (
                  <>
                    <dt className="text-muted-foreground">EIN</dt>
                    <dd>{brandForm.ein}</dd>
                  </>
                )}
              </dl>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Campaign Use Case</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Use Case</dt>
                <dd>
                  {USE_CASES.find((uc) => uc.value === campaignForm.useCase)?.label}
                </dd>
                <dt className="text-muted-foreground">Description</dt>
                <dd className="col-span-2 mt-1">{campaignForm.description}</dd>
              </dl>
              <div className="mt-2">
                <p className="text-sm text-muted-foreground mb-1">
                  Sample Messages:
                </p>
                <ul className="text-sm space-y-1">
                  {campaignForm.sampleMessages.map((msg, i) => (
                    <li key={i} className="bg-muted rounded p-2">
                      {msg}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Phone Numbers</h3>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">Quantity</dt>
                <dd>{phoneForm.quantity}</dd>
                <dt className="text-muted-foreground">Area Code</dt>
                <dd>{phoneForm.areaCode || "Any available"}</dd>
                <dt className="text-muted-foreground">Monthly Cost</dt>
                <dd className="font-medium">${((phoneForm.quantity * phoneFeeCents) / 100).toFixed(2)}/month</dd>
                <dt className="text-muted-foreground">Charged Today</dt>
                <dd className="font-medium">${((phoneForm.quantity * phoneFeeCents) / 100).toFixed(2)}</dd>
              </dl>
            </div>

            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <p className="font-medium">Important:</p>
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Brand review takes 5-15 business days</li>
                <li>Campaign registration requires brand approval first</li>
                <li>
                  You can send test messages while waiting for approval
                </li>
                <li>
                  Phone numbers cost ${(phoneFeeCents / 100).toFixed(2)}/month each, charged from your prepaid balance
                </li>
                <li>
                  Your current balance: <span className="font-medium">${(balanceCents / 100).toFixed(2)}</span>
                </li>
              </ul>
            </div>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              Back
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? "Submitting..." : "Submit Registration"}
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
