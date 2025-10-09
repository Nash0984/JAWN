import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, AlertCircle } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { pulseVariants } from "@/lib/animations";

interface FeedbackButtonProps {
  feedbackType: "ai_response" | "eligibility_result" | "policy_content" | "document_verification" | "system_issue";
  relatedEntityType?: string;
  relatedEntityId?: string;
  pageUrl?: string;
  variant?: "default" | "outline" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
}

export default function FeedbackButton({
  feedbackType,
  relatedEntityType,
  relatedEntityId,
  pageUrl,
  variant = "outline",
  size = "sm",
  className
}: FeedbackButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  
  // Form state
  const [category, setCategory] = useState("");
  const [severity, setSeverity] = useState("medium");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");

  const submitFeedbackMutation = useMutation({
    mutationFn: async (feedbackData: any) => {
      const response = await apiRequest('POST', '/api/feedback', feedbackData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Feedback submitted",
        description: "Thank you for your feedback! We'll review it shortly.",
      });
      setOpen(false);
      // Reset form
      setCategory("");
      setSeverity("medium");
      setTitle("");
      setDescription("");
      setExpectedBehavior("");
      setActualBehavior("");
    },
    onError: (error: any) => {
      toast({
        title: "Submission failed",
        description: error.message || "Failed to submit feedback. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!category || !title || !description) {
      toast({
        title: "Required fields missing",
        description: "Please fill in category, title, and description",
        variant: "destructive",
      });
      return;
    }

    const feedbackData = {
      feedbackType,
      category,
      severity,
      title,
      description,
      expectedBehavior: expectedBehavior || null,
      actualBehavior: actualBehavior || null,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId: relatedEntityId || null,
      pageUrl: pageUrl || (typeof window !== 'undefined' ? window.location.href : '/'),
      submitterName: null,
      submitterEmail: null,
    };

    submitFeedbackMutation.mutate(feedbackData);
  };

  const getFeedbackTypeLabel = () => {
    switch (feedbackType) {
      case "ai_response": return "AI Response";
      case "eligibility_result": return "Eligibility Result";
      case "policy_content": return "Policy Content";
      case "document_verification": return "Document Verification";
      case "system_issue": return "System Issue";
      default: return "Feedback";
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.div
          whileHover="hover"
          whileTap="tap"
          variants={pulseVariants}
        >
          <Button
            variant={variant}
            size={size}
            className={className}
            data-testid="button-report-issue"
          >
            <AlertCircle className="h-4 w-4 mr-2" />
            Report Issue
          </Button>
        </motion.div>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Report Issue - {getFeedbackTypeLabel()}
          </DialogTitle>
          <DialogDescription>
            Help us improve by reporting issues or providing feedback
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="feedback-category">
                Category <span className="text-red-500">*</span>
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="feedback-category" data-testid="select-feedback-category">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="incorrect_answer">Incorrect Answer</SelectItem>
                  <SelectItem value="missing_info">Missing Information</SelectItem>
                  <SelectItem value="confusing">Confusing</SelectItem>
                  <SelectItem value="technical_error">Technical Error</SelectItem>
                  <SelectItem value="bias_concern">Bias Concern</SelectItem>
                  <SelectItem value="accessibility_issue">Accessibility Issue</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="feedback-severity">Severity</Label>
              <Select value={severity} onValueChange={setSeverity}>
                <SelectTrigger id="feedback-severity" data-testid="select-feedback-severity">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="feedback-title">
              Issue Title <span className="text-red-500">*</span>
            </Label>
            <Input
              id="feedback-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Brief summary of the issue"
              maxLength={200}
              data-testid="input-feedback-title"
            />
          </div>

          <div>
            <Label htmlFor="feedback-description">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide detailed information about the issue"
              rows={4}
              data-testid="textarea-feedback-description"
            />
          </div>

          <div>
            <Label htmlFor="feedback-expected">What did you expect?</Label>
            <Textarea
              id="feedback-expected"
              value={expectedBehavior}
              onChange={(e) => setExpectedBehavior(e.target.value)}
              placeholder="What did you expect to happen?"
              rows={2}
              data-testid="textarea-feedback-expected"
            />
          </div>

          <div>
            <Label htmlFor="feedback-actual">What actually happened?</Label>
            <Textarea
              id="feedback-actual"
              value={actualBehavior}
              onChange={(e) => setActualBehavior(e.target.value)}
              placeholder="What actually happened instead?"
              rows={2}
              data-testid="textarea-feedback-actual"
            />
          </div>

          <div className="flex gap-2 justify-end border-t pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-cancel-feedback"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitFeedbackMutation.isPending || !category || !title || !description}
              data-testid="button-submit-feedback"
            >
              {submitFeedbackMutation.isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
