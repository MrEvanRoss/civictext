"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageCircle, CheckCircle2, AlertCircle } from "lucide-react";

export default function PublicJoinPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [consented, setConsented] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // Format phone number as user types
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, "").slice(0, 10);
    setPhone(formatPhone(raw));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) {
      setError("Please enter a valid 10-digit phone number.");
      return;
    }

    if (!consented) {
      setError("You must agree to receive text messages to continue.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/public/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: `+1${digits}`,
          orgSlug: slug,
          firstName: firstName.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Derive a display name from the slug for fallback
  const displayName = slug
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");

  if (success) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">
              You&apos;re signed up!
            </h1>
            <p className="text-gray-600">
              You&apos;ll receive a welcome text message shortly. You can reply
              STOP at any time to opt out.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-lg p-8 space-y-6">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="h-14 w-14 rounded-full bg-blue-100 flex items-center justify-center mx-auto">
              <MessageCircle className="h-7 w-7 text-blue-600" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{displayName}</h1>
            <p className="text-gray-600">
              Join our contact list to receive updates via text message.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-gray-700">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                type="tel"
                value={phone}
                onChange={handlePhoneChange}
                placeholder="(555) 123-4567"
                required
                className="text-lg h-12"
                autoComplete="tel"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="firstName" className="text-gray-700">
                First Name{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Input
                id="firstName"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Jane"
                maxLength={100}
                className="h-12"
                autoComplete="given-name"
              />
            </div>

            {/* Consent */}
            <div className="flex items-start gap-3 pt-1">
              <Checkbox
                id="consent"
                checked={consented}
                onCheckedChange={(checked) => setConsented(checked === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="consent"
                className="text-xs text-gray-500 leading-relaxed cursor-pointer"
              >
                By providing your phone number, you consent to receive text
                messages from {displayName}. Message and data rates may apply.
                Reply STOP to opt out at any time. Reply HELP for help.
              </label>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg p-3">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-sm">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              disabled={submitting || !phone || !consented}
              className="w-full h-12 text-base"
            >
              {submitting ? "Joining..." : "Join"}
            </Button>
          </form>

          {/* Footer */}
          <p className="text-center text-[10px] text-gray-400 pt-2">
            Powered by CivicText
          </p>
        </div>
      </div>
    </div>
  );
}
