import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FileText, Upload, AlertCircle, CheckCircle2, Sparkles, List, Calendar, Scale } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface NoticeTemplate {
  id: string;
  noticeType: string;
  noticeCode: string;
  plainLanguageTitle: string;
  whatItMeans: string;
  whatToDoNext: string;
  importantDeadlines: { deadlines: Array<{ description: string; daysFrom: number }> };
  appealRights: string;
  sortOrder: number;
}

interface ExplainedNotice {
  noticeType: string;
  keyInformation: {
    approved?: boolean;
    benefitAmount?: number;
    reason?: string;
    deadlines?: Array<{ action: string; date: string }>;
  };
  plainLanguageExplanation: string;
  actionItems: string[];
  appealInformation?: string;
}

export default function NoticeExplainer() {
  const { toast } = useToast();
  const [mode, setMode] = useState<"simple" | "smart">("simple");
  const [selectedNoticeType, setSelectedNoticeType] = useState<string>("");
  const [noticeText, setNoticeText] = useState<string>("");
  const [explainedNotice, setExplainedNotice] = useState<ExplainedNotice | null>(null);

  const { data: templates = [] } = useQuery<NoticeTemplate[]>({
    queryKey: ["/api/public/notice-templates"],
  });

  const explainNoticeMutation = useMutation({
    mutationFn: async (text: string) => {
      const response = await fetch("/api/public/explain-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeText: text }),
      });
      if (!response.ok) throw new Error("Failed to explain notice");
      return response.json();
    },
    onSuccess: (data) => {
      setExplainedNotice(data);
      toast({
        title: "Notice explained",
        description: "We've translated your notice into plain language",
      });
    },
    onError: () => {
      toast({
        title: "Analysis failed",
        description: "Could not analyze the notice. Try the simple mode instead.",
        variant: "destructive",
      });
    },
  });

  const handleExplainNotice = () => {
    if (!noticeText.trim()) {
      toast({
        title: "No text provided",
        description: "Please paste or type your notice text",
        variant: "destructive",
      });
      return;
    }
    explainNoticeMutation.mutate(noticeText);
  };

  const selectedTemplate = templates.find((t) => t.id === selectedNoticeType);

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <a href="#explanation-content" className="skip-link">
        Skip to explanation
      </a>

      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Notice Letter Explainer</h1>
        <p className="text-muted-foreground">
          Understand what your DHS notice means in plain language
        </p>
      </div>

      <Tabs value={mode} onValueChange={(v) => setMode(v as "simple" | "smart")} className="mb-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="simple" data-testid="tab-simple-mode">
            <List className="h-4 w-4 mr-2" />
            Simple Mode
          </TabsTrigger>
          <TabsTrigger value="smart" data-testid="tab-smart-mode">
            <Sparkles className="h-4 w-4 mr-2" />
            Smart Mode
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simple" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Select Your Notice Type</CardTitle>
              <CardDescription>
                Choose the type of notice you received from DHS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Select value={selectedNoticeType} onValueChange={setSelectedNoticeType}>
                <SelectTrigger data-testid="select-notice-type">
                  <SelectValue placeholder="Select notice type..." />
                </SelectTrigger>
                <SelectContent>
                  {templates
                    .sort((a, b) => a.sortOrder - b.sortOrder)
                    .map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.plainLanguageTitle}
                        {template.noticeCode && ` (${template.noticeCode})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="smart" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Paste Your Notice Text
              </CardTitle>
              <CardDescription>
                Copy and paste the text from your DHS notice for AI-powered explanation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={noticeText}
                onChange={(e) => setNoticeText(e.target.value)}
                placeholder="Paste your notice text here..."
                rows={10}
                className="font-mono text-sm"
                data-testid="textarea-notice-text"
              />
              <Button
                onClick={handleExplainNotice}
                disabled={!noticeText.trim() || explainNoticeMutation.isPending}
                className="w-full"
                data-testid="button-explain-notice"
              >
                {explainNoticeMutation.isPending ? "Analyzing..." : "Explain My Notice"}
              </Button>

              {explainNoticeMutation.isPending && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Analyzing your notice with AI... This may take a moment.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Explanation Display */}
      <div id="explanation-content">
        {mode === "simple" && selectedTemplate && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  {selectedTemplate.plainLanguageTitle}
                </CardTitle>
                {selectedTemplate.noticeCode && (
                  <Badge variant="outline">{selectedTemplate.noticeCode}</Badge>
                )}
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">What This Means:</h3>
                  <p className="text-muted-foreground">{selectedTemplate.whatItMeans}</p>
                </div>

                {selectedTemplate.whatToDoNext && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      What To Do Next:
                    </h3>
                    <p className="text-muted-foreground">{selectedTemplate.whatToDoNext}</p>
                  </div>
                )}

                {selectedTemplate.importantDeadlines?.deadlines && selectedTemplate.importantDeadlines.deadlines.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Important Deadlines:
                    </h3>
                    <div className="space-y-2">
                      {selectedTemplate.importantDeadlines.deadlines.map((deadline, idx) => (
                        <Alert key={idx} className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                          <AlertDescription className="text-amber-900 dark:text-amber-100">
                            <strong>{deadline.description}</strong>
                            {deadline.daysFrom > 0 && (
                              <span className="block text-sm mt-1">
                                Within {deadline.daysFrom} days of notice date
                              </span>
                            )}
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTemplate.appealRights && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      Your Right to Appeal:
                    </h3>
                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <AlertDescription className="text-blue-900 dark:text-blue-100">
                        {selectedTemplate.appealRights}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {mode === "smart" && explainedNotice && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Plain Language Explanation
                </CardTitle>
                <Badge variant="secondary">{explainedNotice.noticeType}</Badge>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-2">What This Means:</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {explainedNotice.plainLanguageExplanation}
                  </p>
                </div>

                {explainedNotice.keyInformation && Object.keys(explainedNotice.keyInformation).length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3">Key Information:</h3>
                    <div className="grid gap-3">
                      {explainedNotice.keyInformation.approved !== undefined && (
                        <Alert className={explainedNotice.keyInformation.approved ? "bg-green-50 dark:bg-green-950 border-green-200" : "bg-yellow-50 dark:bg-yellow-950 border-yellow-200"}>
                          <AlertDescription>
                            <strong>Status:</strong> {explainedNotice.keyInformation.approved ? "Approved" : "Denied"}
                          </AlertDescription>
                        </Alert>
                      )}
                      {explainedNotice.keyInformation.benefitAmount !== undefined && (
                        <Alert>
                          <AlertDescription>
                            <strong>Benefit Amount:</strong> ${explainedNotice.keyInformation.benefitAmount}/month
                          </AlertDescription>
                        </Alert>
                      )}
                      {explainedNotice.keyInformation.reason && (
                        <Alert>
                          <AlertDescription>
                            <strong>Reason:</strong> {explainedNotice.keyInformation.reason}
                          </AlertDescription>
                        </Alert>
                      )}
                    </div>
                  </div>
                )}

                {explainedNotice.actionItems && explainedNotice.actionItems.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5" />
                      Action Items:
                    </h3>
                    <ul className="list-disc list-inside space-y-1">
                      {explainedNotice.actionItems.map((item, idx) => (
                        <li key={idx} className="text-muted-foreground">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {explainedNotice.keyInformation?.deadlines && explainedNotice.keyInformation.deadlines.length > 0 && (
                  <div>
                    <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      Important Deadlines:
                    </h3>
                    <div className="space-y-2">
                      {explainedNotice.keyInformation.deadlines.map((deadline, idx) => (
                        <Alert key={idx} className="bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800">
                          <AlertDescription className="text-amber-900 dark:text-amber-100">
                            <strong>{deadline.action}</strong>
                            <span className="block text-sm mt-1">By: {deadline.date}</span>
                          </AlertDescription>
                        </Alert>
                      ))}
                    </div>
                  </div>
                )}

                {explainedNotice.appealInformation && (
                  <div>
                    <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                      <Scale className="h-5 w-5" />
                      Your Right to Appeal:
                    </h3>
                    <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
                      <AlertDescription className="text-blue-900 dark:text-blue-100">
                        {explainedNotice.appealInformation}
                      </AlertDescription>
                    </Alert>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {mode === "simple" && !selectedNoticeType && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Select a notice type above to see what it means
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
