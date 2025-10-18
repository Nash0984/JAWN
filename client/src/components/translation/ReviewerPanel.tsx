import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Check, X, ThumbsUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslationFilters } from "@/stores/translationFilters";

interface ReviewerPanelProps {
  keyId: string;
}

export function ReviewerPanel({ keyId }: ReviewerPanelProps) {
  const { filters, setLocale } = useTranslationFilters();
  const { toast } = useToast();
  const [reviewerNotes, setReviewerNotes] = useState("");

  // Fetch locales
  const { data: locales } = useQuery({
    queryKey: ['/api/locales'],
  });

  // Auto-select first available locale if none selected
  useEffect(() => {
    if (!filters.targetLocaleId && locales && locales.length > 0) {
      const spanishLocale = locales.find((l: any) => l.code === 'es');
      setLocale(spanishLocale?.id || locales[0].id);
    }
  }, [locales, filters.targetLocaleId, setLocale]);

  // Fetch translation detail with versions and suggestions
  const { data: detail, isLoading } = useQuery({
    queryKey: [`/api/translations/${keyId}`, { targetLocaleId: filters.targetLocaleId }],
    enabled: !!keyId && !!filters.targetLocaleId,
  });

  const { data: suggestions } = useQuery({
    queryKey: [`/api/translations/${keyId}/suggestions`, { targetLocaleId: filters.targetLocaleId }],
    enabled: !!keyId && !!filters.targetLocaleId,
  });

  // Approve version mutation
  const approveMutation = useMutation({
    mutationFn: async (versionId: string) => {
      return apiRequest('POST', `/api/translations/versions/${versionId}/approve`, {
        body: { reviewerNotes },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/translations/${keyId}`] });
      toast({ title: "Success", description: "Version approved successfully" });
      setReviewerNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to approve", variant: "destructive" });
    },
  });

  // Reject version mutation
  const rejectMutation = useMutation({
    mutationFn: async (versionId: string) => {
      if (!reviewerNotes) throw new Error("Reviewer notes required for rejection");
      return apiRequest('POST', `/api/translations/versions/${versionId}/reject`, {
        body: { reviewerNotes },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/translations/${keyId}`] });
      toast({ title: "Success", description: "Version rejected with feedback" });
      setReviewerNotes("");
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to reject", variant: "destructive" });
    },
  });

  // Promote suggestion mutation
  const promoteMutation = useMutation({
    mutationFn: async (suggestionId: string) => {
      return apiRequest('POST', `/api/translations/suggestions/${suggestionId}/promote`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/translations/${keyId}`] });
      toast({ title: "Success", description: "Suggestion promoted to official version" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to promote", variant: "destructive" });
    },
  });

  if (isLoading) {
    return <Card><CardContent className="p-6">Loading...</CardContent></Card>;
  }

  if (!filters.targetLocaleId) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Please select a target locale from the filters above.</p>
        </CardContent>
      </Card>
    );
  }

  const key = detail?.key;
  const pendingVersion = detail?.versions?.find((v: any) => v.status === 'pending_review');
  const currentVersion = detail?.versions?.find((v: any) => v.isCurrentVersion);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review Translation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source vs Translation */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Source Text</label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">{key?.defaultText}</p>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Translated Text</label>
              <div className="p-3 bg-muted rounded-md">
                <p className="text-sm">{pendingVersion?.translatedText || currentVersion?.translatedText || 'No translation'}</p>
              </div>
            </div>
          </div>

          {pendingVersion && (
            <>
              <Separator />

              {/* Quality Score */}
              {pendingVersion.qualityScore !== null && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Quality Score</label>
                  <div className="flex items-center gap-2">
                    <Progress value={pendingVersion.qualityScore * 100} className="flex-1" />
                    <span className="text-sm font-medium">{Math.round(pendingVersion.qualityScore * 100)}%</span>
                  </div>
                </div>
              )}

              {/* Reviewer Notes */}
              <div>
                <label className="text-sm font-medium mb-2 block">Reviewer Notes</label>
                <Textarea
                  value={reviewerNotes}
                  onChange={(e) => setReviewerNotes(e.target.value)}
                  placeholder="Add notes about this translation..."
                  rows={3}
                  data-testid="textarea-reviewer-notes"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-2 justify-end">
                <Button
                  variant="destructive"
                  onClick={() => rejectMutation.mutate(pendingVersion.id)}
                  disabled={rejectMutation.isPending || !reviewerNotes}
                  data-testid="button-reject"
                >
                  <X className="h-4 w-4 mr-2" />
                  Reject
                </Button>
                <Button
                  onClick={() => approveMutation.mutate(pendingVersion.id)}
                  disabled={approveMutation.isPending}
                  data-testid="button-approve"
                >
                  <Check className="h-4 w-4 mr-2" />
                  Approve
                </Button>
              </div>
            </>
          )}

          {!pendingVersion && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">No pending reviews for this translation</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Community Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Community Suggestions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {suggestions.map((suggestion: any) => (
                <div key={suggestion.id} className="p-3 border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm">{suggestion.suggestedText}</p>
                      {suggestion.rationale && (
                        <p className="text-xs text-muted-foreground mt-1">{suggestion.rationale}</p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline">
                          {suggestion.upvotes} <ThumbsUp className="h-3 w-3 ml-1" />
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          by {suggestion.suggestedBy?.fullName || 'Anonymous'}
                        </span>
                      </div>
                    </div>
                    {suggestion.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => promoteMutation.mutate(suggestion.id)}
                        disabled={promoteMutation.isPending}
                        data-testid={`button-promote-${suggestion.id}`}
                      >
                        Promote
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
