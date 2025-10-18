import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Save, Send, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useTranslationFilters } from "@/stores/translationFilters";

interface TranslatorWorkbenchProps {
  keyId: string;
}

export function TranslatorWorkbench({ keyId }: TranslatorWorkbenchProps) {
  const { filters, setLocale } = useTranslationFilters();
  const { toast } = useToast();
  const [translatedText, setTranslatedText] = useState("");
  const [currentVersionId, setCurrentVersionId] = useState<string | null>(null);

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

  // Fetch translation detail
  const { data: detail, isLoading } = useQuery({
    queryKey: [`/api/translations/${keyId}`, { targetLocaleId: filters.targetLocaleId }],
    enabled: !!keyId && !!filters.targetLocaleId,
  });

  // Create or update version mutation
  const saveVersionMutation = useMutation({
    mutationFn: async (data: { translatedText: string }) => {
      if (currentVersionId) {
        return apiRequest('PATCH', `/api/translations/versions/${currentVersionId}`, { body: data });
      } else {
        return apiRequest('POST', `/api/translations/${keyId}/versions`, {
          body: { ...data, targetLocaleId: filters.targetLocaleId },
        });
      }
    },
    onSuccess: (result) => {
      setCurrentVersionId(result.id);
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/translations/${keyId}`] });
      toast({ title: "Success", description: "Draft saved successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to save draft", variant: "destructive" });
    },
  });

  // Submit for review mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!currentVersionId) throw new Error("No draft to submit");
      return apiRequest('POST', `/api/translations/versions/${currentVersionId}/submit`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/translations'] });
      queryClient.invalidateQueries({ queryKey: [`/api/translations/${keyId}`] });
      toast({ title: "Success", description: "Submitted for review successfully" });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message || "Failed to submit", variant: "destructive" });
    },
  });

  const handleSaveDraft = () => {
    saveVersionMutation.mutate({ translatedText });
  };

  const handleSubmitForReview = () => {
    submitMutation.mutate();
  };

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
  const currentVersion = detail?.versions?.find((v: any) => v.isCurrentVersion);
  const characterLimit = key?.characterLimit;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Translation Editor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Source Text */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Source Text (English)</label>
              <Badge variant="outline">{key?.namespace}</Badge>
            </div>
            <div className="p-3 bg-muted rounded-md">
              <p className="text-sm">{key?.defaultText}</p>
            </div>
            {key?.context && (
              <p className="text-xs text-muted-foreground mt-2">
                Context: {key.context}
              </p>
            )}
          </div>

          <Separator />

          {/* Translation Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium">Your Translation</label>
              {characterLimit && (
                <span className="text-xs text-muted-foreground">
                  {translatedText.length} / {characterLimit} characters
                </span>
              )}
            </div>
            <Textarea
              value={translatedText}
              onChange={(e) => setTranslatedText(e.target.value)}
              placeholder="Enter translation..."
              rows={4}
              maxLength={characterLimit || undefined}
              data-testid="textarea-translation"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={handleSaveDraft}
              disabled={saveVersionMutation.isPending || !translatedText}
              data-testid="button-save-draft"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Draft
            </Button>
            <Button
              onClick={handleSubmitForReview}
              disabled={submitMutation.isPending || !currentVersionId}
              data-testid="button-submit-review"
            >
              <Send className="h-4 w-4 mr-2" />
              Submit for Review
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Version History */}
      <Card>
        <CardHeader>
          <CardTitle>Version History</CardTitle>
        </CardHeader>
        <CardContent>
          {detail?.versions?.length === 0 ? (
            <p className="text-sm text-muted-foreground">No versions yet</p>
          ) : (
            <div className="space-y-2">
              {detail?.versions?.map((version: any) => (
                <div key={version.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Version {version.versionNumber}</span>
                      <Badge variant={version.status === 'approved' ? 'default' : 'secondary'}>
                        {version.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{version.translatedText}</p>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(version.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
