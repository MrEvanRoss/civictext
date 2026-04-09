"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  listSurveysAction,
  createSurveyAction,
  deleteSurveyAction,
  closeSurveyAction,
  listCampaignsForSurveyAction,
} from "@/server/actions/surveys";
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
  Plus,
  ClipboardList,
  Trash2,
  BarChart3,
  X,
  Lock,
  Eye,
} from "lucide-react";

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

export default function SurveysPage() {
  const router = useRouter();
  const [surveys, setSurveys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [showCloseDialog, setShowCloseDialog] = useState(false);
  const [pendingCloseId, setPendingCloseId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  // Create form state
  const [name, setName] = useState("");
  const [question, setQuestion] = useState("");
  const [type, setType] = useState("MULTIPLE_CHOICE");
  const [options, setOptions] = useState(["", "", "", ""]);
  const [ratingMin] = useState(1);
  const [ratingMax, setRatingMax] = useState(5);
  const [allowOther, setAllowOther] = useState(false);
  const [campaignId, setCampaignId] = useState("");
  const [creating, setCreating] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadSurveys = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listSurveysAction();
      setSurveys(data.surveys);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSurveys();
  }, [loadSurveys]);

  // Load campaigns when create form opens
  useEffect(() => {
    if (showCreate) {
      listCampaignsForSurveyAction()
        .then(setCampaigns)
        .catch(() => {});
    }
  }, [showCreate]);

  function resetForm() {
    setName("");
    setQuestion("");
    setType("MULTIPLE_CHOICE");
    setOptions(["", "", "", ""]);
    setRatingMax(5);
    setAllowOther(false);
    setCampaignId("");
    setError("");
  }

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
      return Array.from({ length: ratingMax - ratingMin + 1 }, (_, i) =>
        String(ratingMin + i)
      );
    }
    if (type === "NPS") {
      return Array.from({ length: 11 }, (_, i) => String(i));
    }
    if (type === "MULTIPLE_CHOICE") {
      return options.map((o) => o.trim()).filter(Boolean);
    }
    return [];
  }

  async function handleCreate() {
    const finalOptions = buildOptions();
    if (type === "MULTIPLE_CHOICE" && finalOptions.length < 2) {
      toast.error("Multiple choice surveys require at least 2 options");
      return;
    }
    setCreating(true);
    setError("");
    try {
      await createSurveyAction({
        name: name.trim(),
        question: question.trim(),
        type,
        options: finalOptions,
        allowOther,
        campaignId: campaignId || undefined,
      });
      resetForm();
      setShowCreate(false);
      toast.success("Survey created successfully");
      await loadSurveys();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to create survey");
    } finally {
      setCreating(false);
    }
  }

  function handleClose(surveyId: string) {
    setPendingCloseId(surveyId);
    setShowCloseDialog(true);
  }

  async function confirmClose() {
    if (!pendingCloseId) return;
    setShowCloseDialog(false);
    try {
      await closeSurveyAction(pendingCloseId);
      toast.success("Survey closed");
      await loadSurveys();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to close survey");
    } finally {
      setPendingCloseId(null);
    }
  }

  function handleDelete(surveyId: string) {
    setPendingDeleteId(surveyId);
    setShowDeleteDialog(true);
  }

  async function confirmDelete() {
    if (!pendingDeleteId) return;
    setShowDeleteDialog(false);
    try {
      await deleteSurveyAction(pendingDeleteId);
      toast.success("Survey deleted");
      await loadSurveys();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to delete survey");
    } finally {
      setPendingDeleteId(null);
    }
  }

  const optionLabels = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Surveys</h1>
          <p className="text-muted-foreground">
            Collect feedback and measure sentiment from your contacts.
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Create Survey
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Create Form */}
      {showCreate && (
        <Card>
          <CardHeader>
            <CardTitle>Create Survey</CardTitle>
            <CardDescription>
              Set up a new survey to send to your contacts.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name + Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="surveyName">Survey Name *</Label>
                <Input
                  id="surveyName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Voter Issue Priority"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surveyType">Type</Label>
                <NativeSelect
                  id="surveyType"
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
              <Label htmlFor="surveyQuestion">Question *</Label>
              <Textarea
                id="surveyQuestion"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What is the most important issue to you this election?"
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
                <p className="text-xs text-muted-foreground">
                  Respondents will pick a number from {ratingMin} to {ratingMax}.
                </p>
              </div>
            )}

            {/* NPS Info */}
            {type === "NPS" && (
              <div className="bg-info/10 border border-info/30 rounded-lg p-3 text-sm text-info">
                Net Promoter Score asks respondents to rate from 0-10. Responses are
                grouped as Detractors (0-6), Passives (7-8), and Promoters (9-10).
              </div>
            )}

            {/* Yes/No Info */}
            {type === "YES_NO" && (
              <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                Respondents will answer with Yes or No.
              </div>
            )}

            {/* Open Ended Info */}
            {type === "OPEN_ENDED" && (
              <div className="bg-muted rounded-lg p-3 text-sm text-muted-foreground">
                Respondents can reply with any free-text answer.
              </div>
            )}

            {/* Allow Other + Campaign Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="allowOther"
                  checked={allowOther}
                  onCheckedChange={(checked) => setAllowOther(checked === true)}
                />
                <Label htmlFor="allowOther" className="text-sm font-normal cursor-pointer">
                  Allow &quot;Other&quot; responses
                </Label>
              </div>
              <div className="space-y-2">
                <Label htmlFor="campaignLink">Link to Campaign (optional)</Label>
                <NativeSelect
                  id="campaignLink"
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
          </CardContent>
          <CardFooter className="justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowCreate(false);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name.trim() || !question.trim() || creating}
            >
              {creating ? "Creating..." : "Create Survey"}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Survey List */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-48 mt-2" />
              </CardHeader>
              <CardContent className="pb-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : surveys.length === 0 && !showCreate ? (
        <Card>
          <CardContent className="flex flex-col items-center py-16">
            <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <ClipboardList className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <h3 className="text-lg font-medium mb-1">No Surveys Yet</h3>
            <p className="text-sm text-muted-foreground text-center max-w-sm mb-4">
              Create surveys to collect feedback, measure sentiment, and understand
              what matters most to your contacts.
            </p>
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Survey
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {surveys.map((survey) => (
            <Card
              key={survey.id}
              className="hover:-translate-y-0.5 hover:shadow-md transition-all duration-200"
            >
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base truncate pr-2">{survey.name}</CardTitle>
                  <Badge
                    variant={STATUS_BADGE_VARIANT[survey.status] || "secondary"}
                    className="text-xs shrink-0"
                  >
                    {survey.status}
                  </Badge>
                </div>
                <CardDescription className="text-xs line-clamp-2">
                  {survey.question}
                </CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center justify-between text-sm">
                  <Badge variant="outline" className="text-xs">
                    {SURVEY_TYPES.find((t) => t.value === survey.type)?.label || survey.type}
                  </Badge>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <BarChart3 className="h-3.5 w-3.5" />
                    <span>{survey._count?.responses || 0} responses</span>
                  </div>
                </div>
                {survey.campaign && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Campaign: {survey.campaign.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  Created {new Date(survey.createdAt).toLocaleDateString()}
                </p>
              </CardContent>
              <CardFooter className="justify-end gap-1 pt-0">
                <Button
                  variant="ghost"
                  size="sm"
                  title="View Results"
                  onClick={() => router.push(`/surveys/${survey.id}`)}
                >
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                {survey.status !== "CLOSED" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Close Survey"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClose(survey.id);
                    }}
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  title="Delete Survey"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(survey.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={showCloseDialog} onOpenChange={setShowCloseDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Close survey?</AlertDialogTitle>
            <AlertDialogDescription>
              Close this survey? No more responses will be accepted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmClose}>Close Survey</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete survey?</AlertDialogTitle>
            <AlertDialogDescription>
              Delete this survey and all its responses? This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
