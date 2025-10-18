import { useState } from "react";
import { useParams, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ThumbsUp, ThumbsDown, MessageSquare, Clock, User } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface FeedbackEntryDetail {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string;
  status: string;
  sentiment: string | null;
  upvotes: number;
  downvotes: number;
  viewCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  feature: {
    id: string;
    name: string;
  } | null;
  submitter: {
    id: string;
    fullName: string;
    role: string;
  } | null;
  comments: Array<{
    id: string;
    commentText: string;
    isStaffResponse: boolean;
    upvotes: number;
    createdAt: string;
    userName: string | null;
    userRole: string | null;
  }>;
  votes: Array<{
    id: string;
    voterId: string | null;
    voteValue: number;
  }>;
  assignments: Array<{
    id: string;
    assignedTo: string;
    assignedToName: string | null;
    status: string;
    createdAt: string;
  }>;
  history: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    notes: string | null;
    createdAt: string;
  }>;
}

export default function FeedbackDetailView() {
  const { id } = useParams<{ id: string }>();
  const { user } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [commentText, setCommentText] = useState("");

  const { data: entry, isLoading } = useQuery<FeedbackEntryDetail>({
    queryKey: ["/api/feedback/entries", id],
  });

  const voteMutation = useMutation({
    mutationFn: async (voteValue: number) => {
      return await apiRequest(`/api/feedback/entries/${id}/vote`, {
        method: "POST",
        body: JSON.stringify({ voteValue }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/entries", id] });
      toast({ title: "Vote recorded", description: "Thank you for your feedback!" });
    },
  });

  const commentMutation = useMutation({
    mutationFn: async (text: string) => {
      return await apiRequest(`/api/feedback/entries/${id}/comments`, {
        method: "POST",
        body: JSON.stringify({ commentText: text }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/entries", id] });
      setCommentText("");
      toast({ title: "Comment added", description: "Your comment has been posted." });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-12 text-center">Loading feedback details...</CardContent>
        </Card>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>Feedback Not Found</CardTitle>
            <CardDescription>The feedback entry you're looking for doesn't exist.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const userVote = entry.votes.find((v) => v.voterId === user?.id);
  const hasVoted = !!userVote;

  return (
    <div className="container mx-auto p-6 space-y-6" data-testid="page-feedback-detail">
      <div className="flex items-center gap-4">
        <Link href="/suggestions">
          <Button variant="ghost" size="sm" data-testid="button-back">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
      </div>

      <Card data-testid="card-feedback-header">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h1 className="text-3xl font-bold mb-4" data-testid="text-feedback-title">{entry.title}</h1>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" data-testid="badge-type">{entry.type}</Badge>
                <Badge variant="outline" data-testid="badge-priority">{entry.priority}</Badge>
                <Badge variant="default" data-testid="badge-status">{entry.status}</Badge>
                {entry.feature && <Badge variant="secondary">{entry.feature.name}</Badge>}
                {entry.sentiment && <Badge variant="outline">{entry.sentiment}</Badge>}
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={userVote?.voteValue === 1 ? "default" : "outline"}
                size="sm"
                onClick={() => voteMutation.mutate(1)}
                disabled={hasVoted || voteMutation.isPending}
                data-testid="button-upvote"
              >
                <ThumbsUp className="mr-2 h-4 w-4" />
                {entry.upvotes}
              </Button>
              <Button
                variant={userVote?.voteValue === -1 ? "default" : "outline"}
                size="sm"
                onClick={() => voteMutation.mutate(-1)}
                disabled={hasVoted || voteMutation.isPending}
                data-testid="button-downvote"
              >
                <ThumbsDown className="mr-2 h-4 w-4" />
                {entry.downvotes}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground whitespace-pre-wrap" data-testid="text-description">{entry.description}</p>
          </div>
          
          <Separator />
          
          <div className="flex gap-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-4 w-4" />
              {entry.submitter ? entry.submitter.fullName : "Anonymous"}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              {entry.commentCount} comments
            </span>
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-comments">
        <CardHeader>
          <CardTitle>Comments ({entry.comments.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {entry.comments.map((comment) => (
            <div
              key={comment.id}
              className={`border rounded-lg p-4 ${comment.isStaffResponse ? "bg-blue-50 dark:bg-blue-950" : ""}`}
              data-testid={`comment-${comment.id}`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{comment.userName || "Anonymous"}</span>
                  {comment.isStaffResponse && (
                    <Badge variant="secondary" data-testid="badge-staff">Staff Response</Badge>
                  )}
                </div>
                <span className="text-sm text-muted-foreground">
                  {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                </span>
              </div>
              <p className="whitespace-pre-wrap">{comment.commentText}</p>
            </div>
          ))}

          {entry.comments.length === 0 && (
            <p className="text-center text-muted-foreground py-4">No comments yet. Be the first to comment!</p>
          )}

          <Separator className="my-4" />

          <div className="space-y-2">
            <h4 className="font-semibold">Add a Comment</h4>
            <Textarea
              placeholder="Share your thoughts..."
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              rows={3}
              data-testid="textarea-comment"
            />
            <Button
              onClick={() => commentMutation.mutate(commentText)}
              disabled={!commentText.trim() || commentMutation.isPending}
              data-testid="button-submit-comment"
            >
              {commentMutation.isPending ? "Posting..." : "Post Comment"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {entry.history.length > 0 && (
        <Card data-testid="card-history">
          <CardHeader>
            <CardTitle>Status History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {entry.history.map((item) => (
                <div key={item.id} className="flex gap-4 text-sm">
                  <span className="text-muted-foreground min-w-[120px]">
                    {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                  </span>
                  <span>
                    {item.fromStatus ? `${item.fromStatus} → ` : ""}
                    <strong>{item.toStatus}</strong>
                  </span>
                  {item.notes && <span className="text-muted-foreground">({item.notes})</span>}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
