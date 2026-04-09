"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
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
import {
  MapPin,
  Plus,
  Upload,
  Download,
  Search,
  ChevronLeft,
  ChevronRight,
  X,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  listPollingLocationsAction,
  createPollingLocationAction,
  updatePollingLocationAction,
  deletePollingLocationAction,
  bulkImportPollingLocationsAction,
  exportPollingLocationsAction,
  isPollingLocationsEnabledAction,
} from "@/server/actions/polling-locations";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY","DC","PR","VI","GU","AS","MP",
];

interface PollingLocation {
  id: string;
  precinct: string;
  locationName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  pollOpenTime: string | null;
  pollCloseTime: string | null;
  notes: string | null;
  isActive: boolean;
}

const emptyForm = {
  precinct: "",
  locationName: "",
  street: "",
  city: "",
  state: "",
  zip: "",
  pollOpenTime: "",
  pollCloseTime: "",
  notes: "",
};

export default function PollingLocationsPage() {
  const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
  const [locations, setLocations] = useState<PollingLocation[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  // Check if feature is enabled for this org
  useEffect(() => {
    isPollingLocationsEnabledAction()
      .then(setFeatureEnabled)
      .catch(() => setFeatureEnabled(false));
  }, []);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingPrecinct, setDeletingPrecinct] = useState("");

  // Import modal
  const [showImport, setShowImport] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    created: number;
    updated: number;
    errors: Array<{ row: number; message: string }>;
  } | null>(null);

  const loadLocations = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listPollingLocationsAction(page, pageSize, search || undefined);
      setLocations(result.locations as PollingLocation[]);
      setTotal(result.total);
    } catch {
      toast.error("Failed to load polling locations");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  // Debounced search
  useEffect(() => {
    setPage(1);
  }, [search]);

  function openAdd() {
    setEditingId(null);
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(loc: PollingLocation) {
    setEditingId(loc.id);
    setForm({
      precinct: loc.precinct,
      locationName: loc.locationName,
      street: loc.street,
      city: loc.city,
      state: loc.state,
      zip: loc.zip,
      pollOpenTime: loc.pollOpenTime || "",
      pollCloseTime: loc.pollCloseTime || "",
      notes: loc.notes || "",
    });
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave() {
    setSaving(true);
    try {
      const data = {
        ...form,
        pollOpenTime: form.pollOpenTime || undefined,
        pollCloseTime: form.pollCloseTime || undefined,
        notes: form.notes || undefined,
      };
      if (editingId) {
        await updatePollingLocationAction(editingId, data);
        toast.success("Polling location updated");
      } else {
        await createPollingLocationAction(data);
        toast.success("Polling location created");
      }
      closeForm();
      loadLocations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deletingId) return;
    setShowDeleteDialog(false);
    try {
      await deletePollingLocationAction(deletingId);
      toast.success(`Polling location for Precinct ${deletingPrecinct} deleted`);
      loadLocations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setDeletingId(null);
      setDeletingPrecinct("");
    }
  }

  async function handleExport() {
    try {
      const csv = await exportPollingLocationsAction();
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "polling-locations.csv";
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch {
      toast.error("Failed to export");
    }
  }

  function downloadTemplate() {
    const template =
      "Precinct,Location Name,Street,City,State,ZIP,Poll Open,Poll Close,Notes\n" +
      '001,Lincoln Elementary,123 Main St,Springfield,IL,62701,6:00 AM,7:00 PM,"Accessible entrance on south side"';
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "polling-locations-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport() {
    if (!importFile) return;
    setImporting(true);
    setImportResult(null);
    try {
      const text = await importFile.text();
      const lines = text.split("\n").filter((l) => l.trim());

      // Skip header row if it starts with "Precinct"
      const startIndex = lines[0]?.toLowerCase().startsWith("precinct") ? 1 : 0;
      const rows = [];
      for (let i = startIndex; i < lines.length; i++) {
        const cols = parseCSVLine(lines[i]);
        if (cols.length < 6) continue;
        rows.push({
          precinct: cols[0]?.trim() || "",
          locationName: cols[1]?.trim() || "",
          street: cols[2]?.trim() || "",
          city: cols[3]?.trim() || "",
          state: cols[4]?.trim() || "",
          zip: cols[5]?.trim() || "",
          pollOpenTime: cols[6]?.trim() || undefined,
          pollCloseTime: cols[7]?.trim() || undefined,
          notes: cols[8]?.trim() || undefined,
        });
      }

      if (rows.length === 0) {
        toast.error("No valid rows found in CSV");
        setImporting(false);
        return;
      }

      const result = await bulkImportPollingLocationsAction(rows);
      setImportResult(result);
      if (result.errors.length === 0) {
        toast.success(
          `Import complete: ${result.created} created, ${result.updated} updated`
        );
      } else {
        toast.warning(
          `Import done with ${result.errors.length} error(s): ${result.created} created, ${result.updated} updated`
        );
      }
      loadLocations();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  const totalPages = Math.ceil(total / pageSize);

  if (featureEnabled === null) {
    return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  }

  if (!featureEnabled) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <MapPin className="h-12 w-12 text-muted-foreground/50 mb-4" />
        <h2 className="text-xl font-semibold">Polling Locations Not Enabled</h2>
        <p className="text-muted-foreground mt-2 max-w-md">
          The Polling Locations feature is not enabled for your organization. Contact your administrator to enable it.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MapPin className="h-6 w-6" />
            Polling Locations
          </h1>
          <p className="text-muted-foreground mt-1">
            Map precincts to polling places for GOTV campaigns
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleExport} disabled={total === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setShowImport(true); setImportFile(null); setImportResult(null); }}>
            <Upload className="h-4 w-4 mr-1" />
            Import CSV
          </Button>
          <Button size="sm" onClick={openAdd}>
            <Plus className="h-4 w-4 mr-1" />
            Add Location
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search precinct, location, city..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <span className="text-sm text-muted-foreground">
          {total} polling location{total !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">
              {editingId ? "Edit Polling Location" : "Add Polling Location"}
            </h3>
            <Button variant="ghost" size="sm" onClick={closeForm}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Precinct *</Label>
              <Input
                value={form.precinct}
                onChange={(e) => setForm({ ...form, precinct: e.target.value })}
                placeholder="e.g. 001"
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Location Name *</Label>
              <Input
                value={form.locationName}
                onChange={(e) => setForm({ ...form, locationName: e.target.value })}
                placeholder="e.g. Lincoln Elementary School"
              />
            </div>
            <div className="space-y-1 sm:col-span-2 lg:col-span-1">
              <Label className="text-xs">Street *</Label>
              <Input
                value={form.street}
                onChange={(e) => setForm({ ...form, street: e.target.value })}
                placeholder="123 Main St"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">City *</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="Springfield"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">State *</Label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">ZIP *</Label>
              <Input
                value={form.zip}
                onChange={(e) => setForm({ ...form, zip: e.target.value })}
                placeholder="62701"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Poll Open Time</Label>
              <Input
                type="time"
                value={form.pollOpenTime}
                onChange={(e) => setForm({ ...form, pollOpenTime: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to use campaign default
              </p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Poll Close Time</Label>
              <Input
                type="time"
                value={form.pollCloseTime}
                onChange={(e) => setForm({ ...form, pollCloseTime: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">
                Leave blank to use campaign default
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="e.g. Accessible entrance on south side"
              rows={2}
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editingId ? "Update" : "Save"}
            </Button>
            <Button variant="outline" size="sm" onClick={closeForm}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-medium">Precinct</th>
                <th className="text-left p-3 font-medium">Location Name</th>
                <th className="text-left p-3 font-medium">Address</th>
                <th className="text-left p-3 font-medium">Hours</th>
                <th className="text-right p-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    Loading...
                  </td>
                </tr>
              ) : locations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-muted-foreground">
                    {search
                      ? "No polling locations match your search"
                      : "No polling locations yet. Add one or import a CSV to get started."}
                  </td>
                </tr>
              ) : (
                locations.map((loc) => (
                  <tr key={loc.id} className="border-t hover:bg-muted/30">
                    <td className="p-3">
                      <Badge variant="outline" className="font-mono">
                        {loc.precinct}
                      </Badge>
                    </td>
                    <td className="p-3 font-medium">{loc.locationName}</td>
                    <td className="p-3 text-muted-foreground">
                      {[loc.street, `${loc.city}, ${loc.state} ${loc.zip}`]
                        .filter(Boolean)
                        .join(", ")}
                    </td>
                    <td className="p-3">
                      {loc.pollOpenTime && loc.pollCloseTime ? (
                        <span className="text-sm">
                          {loc.pollOpenTime} - {loc.pollCloseTime}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Uses campaign default
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs"
                        onClick={() => openEdit(loc)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-xs text-destructive hover:text-destructive"
                        onClick={() => {
                          setDeletingId(loc.id);
                          setDeletingPrecinct(loc.precinct);
                          setShowDeleteDialog(true);
                        }}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Polling Location</AlertDialogTitle>
            <AlertDialogDescription>
              Delete the polling location for Precinct {deletingPrecinct}? This cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Import Modal */}
      <AlertDialog open={showImport} onOpenChange={setShowImport}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Import Polling Locations from CSV</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  Upload a CSV file with polling location data. Existing precincts
                  will be updated; new precincts will be created.
                </p>
                <div className="bg-muted rounded p-3 text-xs font-mono">
                  <p className="font-semibold mb-1">Expected columns:</p>
                  <p>
                    Precinct, Location Name, Street, City, State, ZIP, Poll Open,
                    Poll Close, Notes
                  </p>
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="px-0 text-xs"
                  onClick={downloadTemplate}
                >
                  <Download className="h-3 w-3 mr-1" />
                  Download Template CSV
                </Button>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              type="file"
              accept=".csv"
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
          </div>
          {importResult && (
            <div className="border rounded p-3 text-sm space-y-1">
              <p>
                <strong>Created:</strong> {importResult.created} &middot;{" "}
                <strong>Updated:</strong> {importResult.updated}
              </p>
              {importResult.errors.length > 0 && (
                <div>
                  <p className="text-destructive font-medium">
                    {importResult.errors.length} error(s):
                  </p>
                  <ul className="list-disc list-inside text-xs text-destructive mt-1 max-h-32 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <li key={i}>
                        Row {e.row}: {e.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>
              {importResult ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {!importResult && (
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleImport();
                }}
                disabled={!importFile || importing}
              >
                {importing ? "Importing..." : "Upload & Import"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ============================================================
// CSV Parser — handles quoted fields with commas
// ============================================================

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ",") {
        result.push(current);
        current = "";
      } else {
        current += char;
      }
    }
  }
  result.push(current);
  return result;
}
