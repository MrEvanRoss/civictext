"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import QRCode from "qrcode";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { ArrowLeft, Download, QrCode } from "lucide-react";
import { getGrowthInfoAction } from "@/server/actions/growth";

const COLOR_OPTIONS = [
  { value: "#000000", label: "Black" },
  { value: "#1d4ed8", label: "Blue" },
  { value: "#15803d", label: "Green" },
  { value: "#dc2626", label: "Red" },
  { value: "#7c3aed", label: "Purple" },
];

export default function QRCodePage() {
  const [loading, setLoading] = useState(true);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [keyword, setKeyword] = useState("JOIN");
  const [color, setColor] = useState("#000000");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [smsLink, setSmsLink] = useState("");

  // Load org phone number
  useEffect(() => {
    (async () => {
      try {
        const info = await getGrowthInfoAction();
        if (info.phoneNumber) {
          setPhoneNumber(info.phoneNumber);
        }
      } catch (err: unknown) {
        toast.error("Failed to load organization info");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Generate QR code whenever inputs change
  const generateQR = useCallback(async () => {
    if (!phoneNumber) return;

    const link = `sms:${phoneNumber}?body=${encodeURIComponent(keyword)}`;
    setSmsLink(link);

    try {
      const dataUrl = await QRCode.toDataURL(link, {
        width: 300,
        margin: 2,
        color: {
          dark: color,
          light: "#FFFFFF",
        },
      });
      setQrDataUrl(dataUrl);
    } catch {
      toast.error("Failed to generate QR code");
    }
  }, [phoneNumber, keyword, color]);

  useEffect(() => {
    generateQR();
  }, [generateQR]);

  // Download as PNG
  const downloadPNG = () => {
    if (!qrDataUrl) return;
    const link = document.createElement("a");
    link.download = `civictext-qr-${keyword.toLowerCase()}.png`;
    link.href = qrDataUrl;
    link.click();
    toast.success("QR code PNG downloaded");
  };

  // Download as SVG
  const downloadSVG = async () => {
    if (!phoneNumber) return;

    const link = `sms:${phoneNumber}?body=${encodeURIComponent(keyword)}`;

    try {
      const svgString = await QRCode.toString(link, {
        type: "svg",
        width: 300,
        margin: 2,
        color: {
          dark: color,
          light: "#FFFFFF",
        },
      });

      const blob = new Blob([svgString], { type: "image/svg+xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.download = `civictext-qr-${keyword.toLowerCase()}.svg`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("QR code SVG downloaded");
    } catch {
      toast.error("Failed to generate SVG");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
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
          <h1 className="text-2xl font-bold tracking-tight">QR Code Generator</h1>
          <p className="text-muted-foreground mt-1">
            Generate a QR code that lets people join your contact list by
            scanning with their phone.
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuration</CardTitle>
            <CardDescription>
              Customize the QR code that people will scan to text you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={phoneNumber}
                disabled
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                This is your organization&apos;s active phone number.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keyword">Keyword</Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value.toUpperCase())}
                placeholder="JOIN"
                maxLength={30}
              />
              <p className="text-xs text-muted-foreground">
                The pre-filled message when someone scans the QR code. Common
                keywords: JOIN, SUBSCRIBE, HELLO.
              </p>
            </div>

            <div className="space-y-2">
              <Label>QR Code Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COLOR_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="h-4 w-4 rounded-sm border"
                          style={{ backgroundColor: opt.value }}
                        />
                        {opt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-3 pt-2">
              <Button onClick={downloadPNG} className="flex-1" disabled={!qrDataUrl}>
                <Download className="h-4 w-4 mr-2" />
                Download PNG
              </Button>
              <Button
                onClick={downloadSVG}
                variant="outline"
                className="flex-1"
                disabled={!phoneNumber}
              >
                <Download className="h-4 w-4 mr-2" />
                Download SVG
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Preview</CardTitle>
            <CardDescription>
              This is what your QR code will look like.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {qrDataUrl ? (
              <>
                <div className="border rounded-lg p-4 bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrDataUrl}
                    alt="QR Code"
                    width={300}
                    height={300}
                  />
                </div>
                <div className="text-center space-y-1">
                  <p className="text-sm font-medium">Scan to join via text</p>
                  <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded break-all">
                    {smsLink}
                  </code>
                </div>
              </>
            ) : (
              <div className="h-[300px] w-[300px] border rounded-lg flex items-center justify-center bg-muted">
                <div className="text-center text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">
                    {phoneNumber
                      ? "Generating QR code..."
                      : "No phone number configured. Purchase a phone number first."}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
