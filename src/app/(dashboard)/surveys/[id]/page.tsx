"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  getSurveyAction,
  updateSurveyAction,
  getSurveyResultsAction,
  exportSurveyResultsAction,
  closeSurveyAction,
  listCampaignsForSurveyAction,
} from "@/server/actions/surveys";
import {
  ArrowLeft,
  Save,
  Download,
  Lock,
  BarChart3,
  Users,
  Percent,
  Plus,
  X,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const SURVEY_TYPES = [
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
  { value: "YES_NO", label: "Yes / No" },
  { value: "OPEN_ENDED", label: "Open Ended" },
  { value: "RATING", label: "Rating" },
  { value: "NPS", label: "NPS" },
];

const STATUS_BADGE_VARIANT: Record<string, "secondary" | "success" | "destructive"> = {
  DRAFT: "secondary",
  ACTIVE: "success",
  CLOSED: "destructive",
};

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--chart-2, 160 60% 45%))",
  "hsl(var(--chart-3, 30 80% 55%))",
  "hsl(var(--chart-4, 280 65% 60%))",
  "hsl(var(--chart-5, 340 75% 55%))",
  "hsl(200, 70%, 50%)",
  "hsl(120, 60%, 45%)",
  "hsl(45, 90%, 50%)",
  "hsl(0, 70%, 55%)",
  "hsl(260, 60%, 55%)",
  "hsl(180, 50%, 45%)",
];

export default function SurveyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const surveyId = params.id as string;

  const [survey, setSurvey] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [type, setType] = useState("MULTIPLE_CHOICE");
  const [options, setOptions] = useState<string[]>([]);
  const [ratingMax, setRatingMax] = useState(5);
  const [allowOther, setAllowOther] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [campaigns, setCampaigns] = useState<any[]>([]);

  // Results state
  const [results, setResults] = useState<any>(null);
  const [resultsLoading, setResultsLoading] = useState(false);

  const loadSurvey = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSurveyAction(surveyId);
      setSurvey(data);
      setName(data.name);
      setQuestion(data.question);
      setType(data.type);
      setAllowOther(data.allowOther);
      setCampaignId(data.campaignId || "");

      // Parse options based on type
      const opts = (data.options as string[]) || [];
      if (data.type === "MULTIPLE_CHOICE") {
        setOptions(opts.length > 0 ? opts : ["", ""]);
      } else if (data.type === "RATING") {
        // Infer max from options
        const max = opts.length > 0 ? Math.max(...opts.map(Number).filter(Boolean)) : 5;
        setRatingMax(max);
        setOptions(opts);
      } else {
        setOptions(opts);
      }
    } catch (err: any) {
      toast.error(err.message || "Survey not found");
      router.push("/surveys");
    } finally {
      setLoading(false);
    }
  }, [surveyId, router]);

  const loadResults = useCallback(async () => {
    setResultsLoading(true);
    try {
      const data = await getSurveyResultsAction(surveyId);
      setResults(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load results");
    } finally {
      setResultsLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    loadSurvey();
    loadResults();
  }, [loadSurvey, loadResults]);

  useEffect(() => {
    listCampaignsForSurveyAction()
      .then(setCampaigns)
      .catch(() => {});
  }, []);

  function addOption() {
    setOptions([...options, ""]);
  }

  function removeOption(index: number) {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  }

  function buildOptions(): string[] {
    if (type === "YES_NO") return ["Yes", "No"];
    if (type === "RATING") {
      return Array.from({ length: ratingMax }, (_, i) => String(i + 1));
    }
    if (type === "NPS") {
      return Array.from({ length: 11 }, (_, i) => String(i));
    }
    if (type === "MULTIPLE_CHOICE") {
      return options.map((o) => o.trim()).filter(Boolean);
    }
    return [];
  }

  async function handleSave() {
    const finalOptions = buildOptions();
    if (type === "MULTIPLE_CHOICE" && finalOptions.length < 2) {
      toast.error("Multiple choice surveys require at least 2 options");
      return;
    }
    setSaving(true);
    try {
      await updateSurveyAction(surveyId, {
        name: name.trim(),
        question: question.trim(),
        type,
        options: finalOptions,
        allowOther,
        campaignId: campaignId || null,
      });
      toast.success("Survey updated");
      await loadSurvey();
    } catch (err: any) {
      toast.error(err.message || "Failed to update survey");
    } finally {
      setSaving(false);
    }
  }

  async function handleClose() {
    if (!confirm("Close this survey? No more responses will be accepted.")) return;
    try {
      await closeSurveyAction(surveyId);
      toast.success("Survey closed");
      await loadSurvey();
    } catch (err: any) {
      toast.error(err.message || "Failed to close survey");
    }
  }

  async function handleExport() {
    try {
      const csv = await exportSurveyResultsAction(surveyId);
      const blob = new Blob([csv], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `survey-${survey?.name || surveyId}-responses.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exported");
    } catch (err: any) {
      toast.error(err.message || "Failed to export");
    }
  }

  async function handleActivate() {
    try {
      await updateSurveyAction(surveyId, { status: "ACTIVE" });
      toast.success("Survey activated");
      await loadSurvey();
    } catch (err: any) {
      toast.error(err.message || "Failed to activate survey");
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-[400px] w-full rounded-lg" />
      </div>
    );
  }

  if (!survey) return null;

  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.push("/surveys")}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight truncate">
              {survey.name}
            </h1>
            <Badge
              variant={STATUS_BADGE_VARIANT[survey.status] || "secondary"}
              className="shrink-0"
            >
              {survey.status}
            </Badge>
          </div>
        </div>
        <div className="flex gap-2">
          {survey.status === "DRAFT" && (
            <Button variant="outline" size="sm" onClick={handleActivate}>
              Activate
            </Button>
          )}
          {survey.status !== "CLOSED" && (
            <Button variant="outline" size="sm" onClick={handleClose}>
              <Lock className="h-4 w-4 mr-1" />
              Close
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="results">
        <TabsList>
          <TabsTrigger value="setup">Setup</TabsTrigger>
          <TabsTrigger value="results">Results</TabsTrigger>
        </TabsList>

        {/* Setup Tab */}
        <TabsContent value="setup" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Survey Configuration</CardTitle>
              <CardDescription>
                Edit the survey details and response options.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name + Type */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="editName">Survey Name *</Label>
                  <Input
                    id="editName"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Survey name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editType">Type</Label>
                  <NativeSelect
                    id="editType"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {SURVEY_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Question */}
              <div className="space-y-2">
                <Label htmlFor="editQuestion">Question *</Label>
                <Textarea
                  id="editQuestion"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Multiple Choice Options */}
              {type === "MULTIPLE_CHOICE" && (
                <div className="space-y-3">
                  <Label>Answer Options</Label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-sm font-mono text-muted-foreground w-6">
                        {optionLabels[i] || String(i + 1)}.
                      </span>
                      <Input
                        value={opt}
                        onChange={(e) => updateOption(i, e.target.value)}
                        placeholder={`Option ${optionLabels[i] || i + 1}`}
                        className="flex-1"
                      />
                      {options.length > 2 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(i)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {options.length < 10 && (
                    <Button variant="outline" size="sm" onClick={addOption}>
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Add Option
                    </Button>
                  )}
                </div>
              )}

              {/* Rating Scale */}
              {type === "RATING" && (
                <div className="space-y-2">
                  <Label>Scale</Label>
                  <NativeSelect
                    value={String(ratingMax)}
                    onChange={(e) => setRatingMax(Number(e.target.value))}
                  >
                    <option value="5">1 - 5</option>
                    <option value="10">1 - 10</option>
                  </NativeSelect>
                </div>
              )}

              {/* NPS Info */}
              {type === "NPS" && (
                <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-sm text-info">
                  Net Promoter Score: 0-10 scale. Detractors (0-6), Passives (7-8),
                  Promoters (9-10).
                </div>
              )}

              {/* Allow Other + Campaign Link */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 pt-2">
                  <Checkbox
                    id="editAllowOther"
                    checked={allowOther}
                    onCheckedChange={(checked) => setAllowOther(checked === true)}
                  />
                  <Label htmlFor="editAllowOther" className="text-sm font-normal cursor-pointer">
                    Allow &quot;Other&quot; responses
                  </Label>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="editCampaign">Linked Campaign</Label>
                  <NativeSelect
                    id="editCampaign"
                    value={campaignId}
                    onChange={(e) => setCampaignId(e.target.value)}
                  >
                    <option value="">No campaign</option>
                    {campaigns.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>
              </div>

              {/* Campaign Info */}
              {survey.campaign && (
                <div className="bg-muted rounded-lg p-3 text-sm">
                  Linked to campaign:{" "}
                  <span className="font-medium">{survey.campaign.name}</span>
                </div>
              )}
            </CardContent>
            <div className="px-6 pb-6 flex justify-end">
              <Button onClick={handleSave} disabled={!name.trim() || !question.trim() || saving}>
                <Save className="h-4 w-4 mr-1" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Results Tab */}
        <TabsContent value="results" className="space-y-6">
          {resultsLoading ? (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-lg" />
                ))}
              </div>
              <Skeleton className="h-[300px] rounded-lg" />
            </div>
          ) : results ? (
            <>
              {/* Summary Stats */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Total Responses</p>
                        <p className="font-bold text-2xl">{results.totalResponses}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {results.responseRate !== null && (
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                          <Percent className="h-5 w-5 text-success" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">Response Rate</p>
                          <p className="font-bold text-2xl">{results.responseRate}%</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-info/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-info" />
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Unique Respondents</p>
                        <p className="font-bold text-2xl">{results.totalResponses}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bar Chart */}
              {results.aggregated.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Response Distribution</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={results.aggregated}
                          margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                          <XAxis
                            dataKey="option"
                            tick={{ fontSize: 12 }}
                            interval={0}
                            angle={results.aggregated.length > 6 ? -45 : 0}
                            textAnchor={results.aggregated.length > 6 ? "end" : "middle"}
                            height={results.aggregated.length > 6 ? 80 : 30}
                          />
                          <YAxis tick={{ fontSize: 12 }} />
                          <Tooltip
                            formatter={(value, _name, props) => [
                              `${value} (${(props.payload as any)?.percentage ?? 0}%)`,
                              "Responses",
                            ]}
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              borderColor: "hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                            }}
                          />
                          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                            {results.aggregated.map((_: any, index: number) => (
                              <Cell
                                key={`cell-${index}`}
                                fill={CHART_COLORS[index % CHART_COLORS.length]}
                              />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Export Button */}
              {results.totalResponses > 0 && (
                <div className="flex justify-end">
                  <Button variant="outline" onClick={handleExport}>
                    <Download className="h-4 w-4 mr-2" />
                    Export to CSV
                  </Button>
                </div>
              )}

              {/* Individual Responses Table */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Recent Responses ({results.recentResponses.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {results.recentResponses.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8">
                      <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <BarChart3 className="h-8 w-8 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-base font-medium mb-1">No Responses Yet</h3>
                      <p className="text-sm text-muted-foreground text-center max-w-sm">
                        Responses will appear here as contacts reply to the survey.
                      </p>
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-3 font-medium">
                              Contact
                            </th>
                            <th className="text-left py-2 px-3 font-medium">
                              Answer
                            </th>
                            <th className="text-left py-2 px-3 font-medium">Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {results.recentResponses.map((r: any, i: number) => (
                            <tr key={i} className="border-b last:border-0">
                              <td className="py-2 px-3">{r.contactName}</td>
                              <td className="py-2 px-3">
                                <Badge variant="outline" className="text-xs">
                                  {r.answer}
                                </Badge>
                              </td>
                              <td className="py-2 px-3 text-muted-foreground">
                                {new Date(r.respondedAt).toLocaleString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Failed to load results. Try refreshing the page.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
