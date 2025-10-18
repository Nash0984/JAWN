import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThumbsUp, ThumbsDown, MessageSquare, TrendingUp, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { FeedbackSubmitDialog } from "@/components/feedback/FeedbackSubmitDialog";

interface FeedbackEntry {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  upvotes: number;
  downvotes: number;
  commentCount: number;
  viewCount: number;
  createdAt: string;
  featureName: string | null;
}

export default function SuggestionVotingList() {
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("popular");

  const { data: entries, isLoading } = useQuery<FeedbackEntry[]>({
    queryKey: ["/api/feedback/entries", statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.append("status", statusFilter);
      params.append("limit", "50");
      const response = await fetch(`/api/feedback/entries?${params}`);
      if (!response.ok) throw new Error("Failed to fetch feedback");
      return response.json();
    },
  });

  const voteMutation = useMutation({
    mutationFn: async ({ entryId, voteValue }: { entryId: string; voteValue: number }) => {
      return await apiRequest(`/api/feedback/entries/${entryId}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteValue }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/entries"] });
      toast({ title: "Vote recorded", description: "Thank you for your feedback!" });
    },
  });

  const sortedEntries = entries ? [...entries].sort((a, b) => {
    switch (sortBy) {
      case "popular":
        return (b.upvotes - b.downvotes) - (a.upvotes - a.downvotes);
      case "recent":
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "discussed":
        return b.commentCount - a.commentCount;
      default:
        return 0;
    }
  }) : [];

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "resolved":
      case "implemented":
        return "default";
      case "accepted":
        return "secondary";
      case "in_progress":
        return "outline";
      case "declined":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-suggestions">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Community Suggestions</h1>
          <p className="text-muted-foreground">Vote on feature requests and share your ideas</p>
        </div>
        <FeedbackSubmitDialog />
      </div>

      <div className="flex gap-4 items-center">
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="w-[180px]" data-testid="select-sort">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="popular">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Popular
              </div>
            </SelectItem>
            <SelectItem value="recent">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Recent
              </div>
            </SelectItem>
            <SelectItem value="discussed">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Most Discussed
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Tabs value={statusFilter} onValueChange={setStatusFilter} data-testid="tabs-status">
        <TabsList>
          <TabsTrigger value="all" data-testid="tab-all">All</TabsTrigger>
          <TabsTrigger value="submitted" data-testid="tab-submitted">Submitted</TabsTrigger>
          <TabsTrigger value="under_review" data-testid="tab-review">Under Review</TabsTrigger>
          <TabsTrigger value="accepted" data-testid="tab-accepted">Accepted</TabsTrigger>
          <TabsTrigger value="implemented" data-testid="tab-implemented">Implemented</TabsTrigger>
          <TabsTrigger value="declined" data-testid="tab-declined">Declined</TabsTrigger>
        </TabsList>

        <TabsContent value={statusFilter} className="space-y-4 mt-6">
          {isLoading ? (
            <Card>
              <CardContent className="p-12 text-center">Loading suggestions...</CardContent>
            </Card>
          ) : sortedEntries.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center text-muted-foreground">
                No suggestions found. Be the first to share your idea!
              </CardContent>
            </Card>
          ) : (
            sortedEntries.map((entry, index) => (
              <Card key={entry.id} className="hover:shadow-md transition" data-testid={`card-suggestion-${entry.id}`}>
                <CardContent className="p-6">
                  <div className="flex gap-4">
                    <div className="flex flex-col items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => voteMutation.mutate({ entryId: entry.id, voteValue: 1 })}
                        disabled={voteMutation.isPending}
                        data-testid={`button-upvote-${entry.id}`}
                      >
                        <ThumbsUp className="h-4 w-4" />
                      </Button>
                      <span className="font-bold text-lg" data-testid={`text-vote-score-${entry.id}`}>
                        {entry.upvotes - entry.downvotes}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => voteMutation.mutate({ entryId: entry.id, voteValue: -1 })}
                        disabled={voteMutation.isPending}
                        data-testid={`button-downvote-${entry.id}`}
                      >
                        <ThumbsDown className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="flex-1">
                      <Link href={`/feedback/${entry.id}`}>
                        <div className="cursor-pointer">
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex-1">
                              <h3 className="font-semibold text-lg hover:underline mb-2">{entry.title}</h3>
                              <div className="flex gap-2 mb-2">
                                <Badge variant={getStatusBadgeVariant(entry.status)}>{entry.status}</Badge>
                                <Badge variant="outline">{entry.type}</Badge>
                                {entry.featureName && <Badge variant="secondary">{entry.featureName}</Badge>}
                                {index < 3 && sortBy === "popular" && (
                                  <Badge variant="default" className="bg-yellow-500">🔥 Popular</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <p className="text-muted-foreground line-clamp-2 mb-3">{entry.description}</p>
                          <div className="flex gap-4 text-sm text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <MessageSquare className="h-4 w-4" />
                              {entry.commentCount} comments
                            </span>
                            <span>{formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}</span>
                          </div>
                        </div>
                      </Link>
                    </div>
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
