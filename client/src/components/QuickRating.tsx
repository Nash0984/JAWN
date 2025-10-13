import { useState } from "react";
import { ThumbsUp, ThumbsDown, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { motion } from "framer-motion";

interface QuickRatingProps {
  ratingType: "policy_search" | "document_verification" | "intake_copilot" | "ai_response";
  relatedEntityType?: string;
  relatedEntityId?: string;
  onRatingSubmitted?: () => void;
  className?: string;
  containerClassName?: string;
}

export default function QuickRating({
  ratingType,
  relatedEntityType,
  relatedEntityId,
  onRatingSubmitted,
  className = "",
  containerClassName = ""
}: QuickRatingProps) {
  const { toast } = useToast();
  const [selectedRating, setSelectedRating] = useState<"thumbs_up" | "thumbs_down" | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitRatingMutation = useMutation({
    mutationFn: async (ratingData: any) => {
      const response = await apiRequest('POST', '/api/quick-ratings', ratingData);
      return response.json();
    },
    onSuccess: () => {
      setSubmitted(true);
      toast({
        title: "Thanks for your feedback!",
        description: "Your rating helps us improve.",
      });
      if (onRatingSubmitted) {
        onRatingSubmitted();
      }
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit rating. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleRating = (rating: "thumbs_up" | "thumbs_down") => {
    setSelectedRating(rating);
    setShowCommentBox(true);
  };

  const handleSubmit = () => {
    if (!selectedRating) return;

    const ratingData = {
      ratingType,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      rating: selectedRating,
      followUpComment: comment || null,
      metadata: {
        timestamp: new Date().toISOString()
      }
    };

    submitRatingMutation.mutate(ratingData);
  };

  if (submitted) {
    return (
      <div className={containerClassName}>
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`flex items-center gap-2 text-sm text-green-600 dark:text-green-400 ${className}`}
        >
          <ThumbsUp className="h-4 w-4" />
          <span>Thank you for your feedback!</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <div className={`space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Was this helpful?</span>
        <div className="flex gap-1">
          <Button
            variant={selectedRating === "thumbs_up" ? "default" : "outline"}
            size="sm"
            onClick={() => handleRating("thumbs_up")}
            disabled={submitRatingMutation.isPending}
            data-testid="button-thumbs-up"
          >
            <ThumbsUp className="h-4 w-4" />
          </Button>
          <Button
            variant={selectedRating === "thumbs_down" ? "default" : "outline"}
            size="sm"
            onClick={() => handleRating("thumbs_down")}
            disabled={submitRatingMutation.isPending}
            data-testid="button-thumbs-down"
          >
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {showCommentBox && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 mt-2 text-muted-foreground" />
            <Textarea
              placeholder="Any additional feedback? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[60px]"
              data-testid="textarea-quick-rating-comment"
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="sm"
              onClick={handleSubmit}
              disabled={submitRatingMutation.isPending}
              data-testid="button-submit-rating"
            >
              {submitRatingMutation.isPending ? "Submitting..." : "Submit"}
            </Button>
          </div>
        </motion.div>
      )}
      </div>
    </div>
  );
}
