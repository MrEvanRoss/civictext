"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Steps } from "@/components/ui/steps";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Upload, FileText, CheckCircle2, AlertCircle } from "lucide-react";

const WIZARD_STEPS = [
  { title: "Upload", description: "Select file" },
  { title: "Map Columns", description: "Match fields" },
  { title: "Consent", description: "Confirm consent" },
  { title: "Processing", description: "Import contacts" },
  { title: "Results", description: "Review" },
];

export default function ImportPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState(0);

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<string[][]>([]);

  // Column mapping
  const [mapping, setMapping] = useState<Record<string, string>>({
    phone: "",
    firstName: "",
    lastName: "",
    email: "",
    tags: "",
  });

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{
    total: number;
    success: number;
    duplicates: number;
    errors: number;
  } | null>(null);

  // Consent declaration
  const [consentConfirmed, setConsentConfirmed] = useState(false);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (!selected.name.endsWith(".csv")) {
      alert("Please select a CSV file");
      return;
    }

    setFile(selected);
    parsePreview(selected);
  }

  function parsePreview(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length === 0) return;

      // Parse headers
      const hdrs = parseCSVLine(lines[0]);
      setHeaders(hdrs);

      // Parse first 5 rows for preview
      const rows = lines.slice(1, 6).map(parseCSVLine);
      setPreview(rows);

      // Auto-map common column names
      const autoMap: Record<string, string> = {
        phone: "",
        firstName: "",
        lastName: "",
        email: "",
        tags: "",
      };

      for (const h of hdrs) {
        const lower = h.toLowerCase().replace(/[_\s-]/g, "");
        if (lower.includes("phone") || lower === "mobile" || lower === "cell") {
          autoMap.phone = h;
        } else if (lower.includes("firstname") || lower === "first") {
          autoMap.firstName = h;
        } else if (lower.includes("lastname") || lower === "last") {
          autoMap.lastName = h;
        } else if (lower.includes("email")) {
          autoMap.email = h;
        } else if (lower.includes("tag")) {
          autoMap.tags = h;
        }
      }

      setMapping(autoMap);
      setStep(1);
    };
    reader.readAsText(file.slice(0, 50000)); // Read first 50KB for preview
  }

  function parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  async function handleImport() {
    if (!file || !mapping.phone) return;
    setStep(3);
    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("mapping", JSON.stringify(mapping));

      const res = await fetch("/api/contacts/import", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error("Import failed");

      const data = await res.json();
      setResults(data);
      setStep(4);
    } catch (err: any) {
      setResults({
        total: 0,
        success: 0,
        duplicates: 0,
        errors: 1,
      });
      setStep(4);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Contacts</h1>
        <p className="text-muted-foreground">
          Upload a CSV file to bulk import contacts.
        </p>
      </div>

      <Steps steps={WIZARD_STEPS} currentStep={step} />

      {/* Step 0: Upload */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Upload CSV File</CardTitle>
            <CardDescription>
              Upload a CSV file with contact information. Files up to 500MB are supported.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-sm font-medium">
                Click to upload or drag and drop
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                CSV files only (.csv)
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Column Mapping */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Map Columns</CardTitle>
            <CardDescription>
              Match your CSV columns to contact fields. Phone is required.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {Object.entries({
                phone: "Phone Number *",
                firstName: "First Name",
                lastName: "Last Name",
                email: "Email",
                tags: "Tags",
              }).map(([field, label]) => (
                <div key={field} className="space-y-2">
                  <Label>{label}</Label>
                  <Select
                    value={(mapping as any)[field]}
                    onChange={(e) =>
                      setMapping((p) => ({ ...p, [field]: e.target.value }))
                    }
                  >
                    <option value="">-- Skip --</option>
                    {headers.map((h) => (
                      <option key={h} value={h}>
                        {h}
                      </option>
                    ))}
                  </Select>
                </div>
              ))}
            </div>

            {/* Preview */}
            {preview.length > 0 && (
              <div className="mt-6">
                <h3 className="text-sm font-medium mb-2">
                  Preview (first {preview.length} rows)
                </h3>
                <div className="overflow-x-auto border rounded">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        {headers.map((h) => (
                          <th key={h} className="text-left py-2 px-3 font-medium">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.map((row, i) => (
                        <tr key={i} className="border-b last:border-0">
                          {row.map((cell, j) => (
                            <td key={j} className="py-2 px-3 truncate max-w-[150px]">
                              {cell}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              Back
            </Button>
            <Button
              onClick={() => setStep(2)}
              disabled={!mapping.phone}
            >
              Next: Confirm Consent
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 2: Consent Declaration */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Consent Declaration</CardTitle>
            <CardDescription>
              TCPA requires that you have prior express consent before texting contacts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-md bg-yellow-50 border border-yellow-200 p-4 text-sm text-yellow-800">
              <p className="font-medium mb-2">Legal Requirement</p>
              <p>
                The Telephone Consumer Protection Act (TCPA) requires prior
                express written consent before sending text messages. You must have
                documentation showing each contact opted in to receive messages from
                your organization.
              </p>
            </div>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={consentConfirmed}
                onChange={(e) => setConsentConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span className="text-sm">
                I confirm that all contacts in this file have provided prior
                express written consent to receive text messages from my
                organization. I understand that sending messages without consent
                violates the TCPA and may result in legal penalties.
              </span>
            </label>
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              Back
            </Button>
            <Button
              onClick={handleImport}
              disabled={!consentConfirmed}
            >
              Start Import
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Step 3: Processing */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Processing Import</CardTitle>
            <CardDescription>
              Your file is being processed. This may take a few minutes for large files.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center py-12">
            <div className="h-12 w-12 rounded-full border-4 border-primary border-t-transparent animate-spin mb-4" />
            <p className="text-sm text-muted-foreground">
              Importing {file?.name}...
            </p>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Results */}
      {step === 4 && results && (
        <Card>
          <CardHeader>
            <CardTitle>Import Complete</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-4 rounded-lg bg-muted">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-muted-foreground">Total Rows</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-green-50">
                <p className="text-2xl font-bold text-green-600">
                  {results.success}
                </p>
                <p className="text-xs text-muted-foreground">Imported</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-yellow-50">
                <p className="text-2xl font-bold text-yellow-600">
                  {results.duplicates}
                </p>
                <p className="text-xs text-muted-foreground">Duplicates</p>
              </div>
              <div className="text-center p-4 rounded-lg bg-red-50">
                <p className="text-2xl font-bold text-red-600">
                  {results.errors}
                </p>
                <p className="text-xs text-muted-foreground">Errors</p>
              </div>
            </div>

            {results.success > 0 && (
              <div className="flex items-center gap-2 text-green-600">
                <CheckCircle2 className="h-5 w-5" />
                <p className="text-sm font-medium">
                  Successfully imported {results.success} contacts.
                </p>
              </div>
            )}

            {results.errors > 0 && (
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <p className="text-sm">
                  {results.errors} rows had errors (invalid phone numbers, etc).
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button variant="outline" onClick={() => router.push("/contacts")}>
              View Contacts
            </Button>
            <Button
              onClick={() => {
                setStep(0);
                setFile(null);
                setHeaders([]);
                setPreview([]);
                setResults(null);
                setConsentConfirmed(false);
              }}
            >
              Import Another File
            </Button>
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
