"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/select";
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
  listSegmentsAction,
  createSegmentAction,
  evaluateSegmentCountAction,
} from "@/server/actions/contacts";
import { Filter, Plus, Trash2, Users } from "lucide-react";

interface Condition {
  field: string;
  operator: string;
  value: string;
}

const FIELD_OPTIONS = [
  { value: "optInStatus", label: "Consent Status" },
  { value: "tags", label: "Tags" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "createdAt", label: "Created Date" },
  { value: "lastMessageAt", label: "Last Message Date" },
];

const OPERATOR_OPTIONS: Record<string, { value: string; label: string }[]> = {
  string: [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Does not equal" },
    { value: "contains", label: "Contains" },
    { value: "not_contains", label: "Does not contain" },
    { value: "is_set", label: "Is set" },
    { value: "is_not_set", label: "Is not set" },
  ],
  select: [
    { value: "equals", label: "Equals" },
    { value: "not_equals", label: "Does not equal" },
  ],
  tags: [
    { value: "contains", label: "Has tag" },
    { value: "not_contains", label: "Does not have tag" },
  ],
  date: [
    { value: "gt", label: "After" },
    { value: "lt", label: "Before" },
    { value: "gte", label: "On or after" },
    { value: "lte", label: "On or before" },
  ],
};

function getOperatorsForField(field: string) {
  if (field === "optInStatus") return OPERATOR_OPTIONS.select;
  if (field === "tags") return OPERATOR_OPTIONS.tags;
  if (field === "createdAt" || field === "lastMessageAt") return OPERATOR_OPTIONS.date;
  return OPERATOR_OPTIONS.string;
}

export default function SegmentsPage() {
  const [segments, setSegments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);

  // Builder state
  const [segmentName, setSegmentName] = useState("");
  const [logicOperator, setLogicOperator] = useState<"AND" | "OR">("AND");
  const [conditions, setConditions] = useState<Condition[]>([
    { field: "optInStatus", operator: "equals", value: "OPTED_IN" },
  ]);
  const [previewCount, setPreviewCount] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSegments();
  }, []);

  async function loadSegments() {
    try {
      const data = await listSegmentsAction();
      setSegments(data);
    } catch (err) {
      console.error("Failed to load segments:", err);
    } finally {
      setLoading(false);
    }
  }

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { field: "optInStatus", operator: "equals", value: "" },
    ]);
  }

  function removeCondition(index: number) {
    if (conditions.length <= 1) return;
    setConditions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateCondition(index: number, updates: Partial<Condition>) {
    setConditions((prev) =>
      prev.map((c, i) => (i === index ? { ...c, ...updates } : c))
    );
  }

  async function handlePreview() {
    try {
      const rules = {
        operator: logicOperator,
        conditions: conditions.map((c) => ({
          field: c.field,
          operator: c.operator,
          value: c.value,
        })),
      };
      const count = await evaluateSegmentCountAction(rules as any);
      setPreviewCount(count);
    } catch (err) {
      console.error("Preview failed:", err);
    }
  }

  async function handleSave() {
    if (!segmentName) return;
    setSaving(true);

    try {
      await createSegmentAction({
        name: segmentName,
        rules: {
          operator: logicOperator,
          conditions: conditions.map((c) => ({
            field: c.field,
            operator: c.operator,
            value: c.value,
          })),
        },
      } as any);
      setShowBuilder(false);
      setSegmentName("");
      setConditions([{ field: "optInStatus", operator: "equals", value: "OPTED_IN" }]);
      setPreviewCount(null);
      loadSegments();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Failed to create segment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Segments</h1>
          <p className="text-muted-foreground">
            Create dynamic contact groups for targeted campaigns.
          </p>
        </div>
        <Button onClick={() => setShowBuilder(!showBuilder)}>
          <Plus className="mr-2 h-4 w-4" />
          New Segment
        </Button>
      </div>

      {/* Segment Builder */}
      {showBuilder && (
        <Card>
          <CardHeader>
            <CardTitle>Create Segment</CardTitle>
            <CardDescription>
              Define rules to group contacts. Segments update dynamically as contacts change.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Segment Name</Label>
              <Input
                value={segmentName}
                onChange={(e) => setSegmentName(e.target.value)}
                placeholder="e.g., Active Donors in District 5"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Match</span>
              <NativeSelect
                value={logicOperator}
                onChange={(e) => setLogicOperator(e.target.value as "AND" | "OR")}
                className="w-20"
              >
                <option value="AND">ALL</option>
                <option value="OR">ANY</option>
              </NativeSelect>
              <span className="text-sm text-muted-foreground">of the following conditions:</span>
            </div>

            <div className="space-y-3">
              {conditions.map((cond, index) => (
                <div key={index} className="flex items-center gap-2">
                  <NativeSelect
                    value={cond.field}
                    onChange={(e) => {
                      updateCondition(index, {
                        field: e.target.value,
                        operator: getOperatorsForField(e.target.value)[0].value,
                        value: "",
                      });
                    }}
                    className="w-40"
                  >
                    {FIELD_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </NativeSelect>

                  <NativeSelect
                    value={cond.operator}
                    onChange={(e) =>
                      updateCondition(index, { operator: e.target.value })
                    }
                    className="w-40"
                  >
                    {getOperatorsForField(cond.field).map((op) => (
                      <option key={op.value} value={op.value}>
                        {op.label}
                      </option>
                    ))}
                  </NativeSelect>

                  {!["is_set", "is_not_set"].includes(cond.operator) && (
                    <>
                      {cond.field === "optInStatus" ? (
                        <NativeSelect
                          value={cond.value}
                          onChange={(e) =>
                            updateCondition(index, { value: e.target.value })
                          }
                          className="flex-1"
                        >
                          <option value="">Select...</option>
                          <option value="OPTED_IN">Opted In</option>
                          <option value="OPTED_OUT">Opted Out</option>
                          <option value="PENDING">Pending</option>
                        </NativeSelect>
                      ) : cond.field === "createdAt" || cond.field === "lastMessageAt" ? (
                        <Input
                          type="date"
                          value={cond.value}
                          onChange={(e) =>
                            updateCondition(index, { value: e.target.value })
                          }
                          className="flex-1"
                        />
                      ) : (
                        <Input
                          value={cond.value}
                          onChange={(e) =>
                            updateCondition(index, { value: e.target.value })
                          }
                          placeholder="Value..."
                          className="flex-1"
                        />
                      )}
                    </>
                  )}

                  {conditions.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeCondition(index)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>

            <Button variant="outline" size="sm" onClick={addCondition}>
              <Plus className="h-3 w-3 mr-1" />
              Add Condition
            </Button>

            {previewCount !== null && (
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {previewCount} contacts match this segment
                </span>
              </div>
            )}
          </CardContent>
          <CardFooter className="justify-between">
            <Button variant="outline" onClick={handlePreview}>
              Preview Count
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setShowBuilder(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={!segmentName || saving}
              >
                {saving ? "Saving..." : "Save Segment"}
              </Button>
            </div>
          </CardFooter>
        </Card>
      )}

      {/* Existing Segments */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      ) : segments.length === 0 && !showBuilder ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Filter className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Segments</h2>
            <p className="text-muted-foreground text-center max-w-md mb-6">
              Segments let you group contacts by tags, consent status, or
              other criteria for targeted campaigns.
            </p>
            <Button onClick={() => setShowBuilder(true)}>
              Create Your First Segment
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {segments.map((seg) => (
            <Card key={seg.id}>
              <CardHeader>
                <CardTitle className="text-base">{seg.name}</CardTitle>
                <CardDescription>
                  {seg.contactCount} contacts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {(seg.rules as any)?.conditions?.slice(0, 3).map((c: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      {c.field} {c.operator} {c.value}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
