import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, CheckCircle2, XCircle, Edit, Eye, ThumbsUp, ThumbsDown } from "lucide-react";

interface FaqCandidate {
  id: string;
  question: string;
  answerDraft: string | null;
  sourceEntryIds: string[];
  occurrenceCount: number;
  confidenceScore: number | null;
  status: string;
  createdAt: string;
}

interface FaqArticle {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  viewCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  isPublished: boolean;
  publishedAt: string | null;
  createdAt: string;
}

export default function FAQDashboard() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingCandidate, setEditingCandidate] = useState<FaqCandidate | null>(null);
  const [editedQuestion, setEditedQuestion] = useState("");
  const [editedAnswer, setEditedAnswer] = useState("");
  const [editedCategory, setEditedCategory] = useState("general");

  const { data: candidates, isLoading: loadingCandidates } = useQuery<FaqCandidate[]>({
    queryKey: ["/api/faq/candidates"],
    queryFn: async () => {
      const response = await fetch("/api/faq/candidates?status=pending");
      if (!response.ok) throw new Error("Failed to fetch candidates");
      return response.json();
    },
  });

  const { data: articles, isLoading: loadingArticles } = useQuery<FaqArticle[]>({
    queryKey: ["/api/faq/articles", "admin"],
    queryFn: async () => {
      const response = await fetch("/api/faq/articles");
      if (!response.ok) throw new Error("Failed to fetch articles");
      return response.json();
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("/api/faq/generate", {
        method: "POST",
        body: JSON.stringify({}),
      });
    },
    onSuccess: () => {
      toast({
        title: "FAQ generation started",
        description: "This may take a few minutes. Check back soon!",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/faq/candidates"] });
    },
    onError: (error) => {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ id, question, answer, category }: { id: string; question: string; answer: string; category: string }) => {
      return await apiRequest(`/api/faq/candidates/${id}/approve`, {
        method: "PATCH",
        body: JSON.stringify({ question, answer, category }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Candidate approved",
        description: "FAQ article has been created.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/faq/candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/faq/articles"] });
      setEditingCandidate(null);
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      return await apiRequest(`/api/faq/candidates/${id}/reject`, {
        method: "PATCH",
        body: JSON.stringify({ reason }),
      });
    },
    onSuccess: () => {
      toast({
        title: "Candidate rejected",
        description: "This FAQ suggestion has been dismissed.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/faq/candidates"] });
    },
  });

  const openEditDialog = (candidate: FaqCandidate) => {
    setEditingCandidate(candidate);
    setEditedQuestion(candidate.question);
    setEditedAnswer(candidate.answerDraft || "");
    setEditedCategory("general");
  };

  if (!user || !["admin", "super_admin"].includes(user.role)) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>You don't have permission to view the FAQ dashboard.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-faq-dashboard">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">FAQ Management</h1>
          <p className="text-muted-foreground">Review AI-generated FAQ candidates and manage published articles</p>
        </div>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          data-testid="button-generate-faq"
        >
          <Sparkles className="mr-2 h-4 w-4" />
          {generateMutation.isPending ? "Generating..." : "Generate FAQs"}
        </Button>
      </div>

      <Tabs defaultValue="candidates" data-testid="tabs-faq">
        <TabsList>
          <TabsTrigger value="candidates" data-testid="tab-candidates">
            Pending Candidates {candidates && `(${candidates.length})`}
          </TabsTrigger>
          <TabsTrigger value="published" data-testid="tab-published">
            Published Articles {articles && `(${articles.filter(a => a.isPublished).length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="candidates" className="space-y-4">
          {loadingCandidates ? (
            <Card>
              <CardContent className="p-12 text-center">Loading candidates...</CardContent>
            </Card>
          ) : (!candidates || candidates.length === 0) ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No pending FAQ candidates. Click "Generate FAQs" to create new suggestions.
              </CardContent>
            </Card>
          ) : (
            candidates.map((candidate) => (
              <Card key={candidate.id} data-testid={`card-candidate-${candidate.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{candidate.question}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        <Badge variant="outline">
                          {candidate.occurrenceCount} occurrences
                        </Badge>
                        {candidate.confidenceScore && (
                          <Badge variant="secondary">
                            {(candidate.confidenceScore * 100).toFixed(0)}% confidence
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h4 className="font-semibold mb-2">Suggested Answer:</h4>
                    <p className="text-muted-foreground whitespace-pre-wrap">
                      {candidate.answerDraft || "No answer generated"}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button
                          variant="default"
                          onClick={() => openEditDialog(candidate)}
                          data-testid={`button-approve-${candidate.id}`}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Approve
                        </Button>
                      </DialogTrigger>
                      <DialogContent data-testid="dialog-edit-candidate">
                        <DialogHeader>
                          <DialogTitle>Review & Approve FAQ</DialogTitle>
                          <DialogDescription>
                            Edit the question and answer before publishing.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="question">Question</Label>
                            <Input
                              id="question"
                              value={editedQuestion}
                              onChange={(e) => setEditedQuestion(e.target.value)}
                              data-testid="input-edit-question"
                            />
                          </div>
                          <div>
                            <Label htmlFor="answer">Answer</Label>
                            <Textarea
                              id="answer"
                              value={editedAnswer}
                              onChange={(e) => setEditedAnswer(e.target.value)}
                              rows={6}
                              data-testid="textarea-edit-answer"
                            />
                          </div>
                          <div>
                            <Label htmlFor="category">Category</Label>
                            <Select value={editedCategory} onValueChange={setEditedCategory}>
                              <SelectTrigger data-testid="select-category">
                                <SelectValue placeholder="Select category" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="benefits">Benefits</SelectItem>
                                <SelectItem value="tax">Tax</SelectItem>
                                <SelectItem value="documents">Documents</SelectItem>
                                <SelectItem value="calendar">Calendar</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            onClick={() => {
                              if (editingCandidate) {
                                approveMutation.mutate({
                                  id: editingCandidate.id,
                                  question: editedQuestion,
                                  answer: editedAnswer,
                                  category: editedCategory,
                                });
                              }
                            }}
                            disabled={approveMutation.isPending}
                            data-testid="button-confirm-approve"
                          >
                            {approveMutation.isPending ? "Approving..." : "Approve & Publish"}
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="destructive"
                      onClick={() => rejectMutation.mutate({ id: candidate.id, reason: "Not relevant" })}
                      disabled={rejectMutation.isPending}
                      data-testid={`button-reject-${candidate.id}`}
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="published" className="space-y-4">
          {loadingArticles ? (
            <Card>
              <CardContent className="p-12 text-center">Loading articles...</CardContent>
            </Card>
          ) : (!articles || articles.length === 0) ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No published articles yet. Approve candidates to create articles.
              </CardContent>
            </Card>
          ) : (
            articles.map((article) => (
              <Card key={article.id} data-testid={`card-article-${article.id}`}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{article.question}</CardTitle>
                      <div className="flex gap-2 mt-2">
                        {article.isPublished ? (
                          <Badge variant="default">Published</Badge>
                        ) : (
                          <Badge variant="outline">Draft</Badge>
                        )}
                        {article.category && <Badge variant="secondary">{article.category}</Badge>}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="text-muted-foreground line-clamp-3">{article.answer}</p>

                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {article.viewCount} views
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsUp className="h-4 w-4" />
                      {article.helpfulCount} helpful
                    </span>
                    <span className="flex items-center gap-1">
                      <ThumbsDown className="h-4 w-4" />
                      {article.notHelpfulCount} not helpful
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
