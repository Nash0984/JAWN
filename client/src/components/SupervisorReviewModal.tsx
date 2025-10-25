import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import type { BenefitsAccessReview } from "@shared/schema";

// Form validation schema
const reviewFeedbackSchema = z.object({
  overallQualityRating: z.string().min(1, "Overall quality rating is required"),
  documentationCompleteness: z.string().min(1, "Documentation completeness rating is required"),
  timelinessRating: z.string().min(1, "Timeliness rating is required"),
  complianceRating: z.string().min(1, "Compliance rating is required"),
  strengths: z.string().min(50, "Strengths must be at least 50 characters"),
  areasForImprovement: z.string().min(50, "Areas for improvement must be at least 50 characters"),
  coachingNotes: z.string().min(100, "Coaching notes must be at least 100 characters - provide detailed guidance for the caseworker"),
  recommendedActions: z.array(z.string()).min(1, "Select at least one recommended action"),
});

type ReviewFeedbackForm = z.infer<typeof reviewFeedbackSchema>;

interface SupervisorReviewModalProps {
  review: BenefitsAccessReview;
  isOpen: boolean;
  onClose: () => void;
}

const RATING_OPTIONS = [
  { value: "1", label: "1 - Needs Significant Improvement" },
  { value: "2", label: "2 - Below Expectations" },
  { value: "3", label: "3 - Meets Expectations" },
  { value: "4", label: "4 - Above Expectations" },
  { value: "5", label: "5 - Excellent" },
];

const RECOMMENDED_ACTIONS = [
  { id: "no_action", label: "No Action Required" },
  { id: "additional_training", label: "Additional Training" },
  { id: "policy_review", label: "Policy Review" },
  { id: "escalate_qa", label: "Escalate to QA" },
];

export default function SupervisorReviewModal({ review, isOpen, onClose }: SupervisorReviewModalProps) {
  const { toast } = useToast();

  const form = useForm<ReviewFeedbackForm>({
    resolver: zodResolver(reviewFeedbackSchema),
    defaultValues: {
      overallQualityRating: "3",
      documentationCompleteness: "3",
      timelinessRating: "3",
      complianceRating: "3",
      strengths: "",
      areasForImprovement: "",
      coachingNotes: "",
      recommendedActions: ["no_action"],
    },
  });

  const submitReviewMutation = useMutation({
    mutationFn: async (data: ReviewFeedbackForm) => {
      return await apiRequest("POST", `/api/bar/reviews/${review.id}/feedback`, {
        overallQualityRating: parseInt(data.overallQualityRating),
        documentationCompleteness: parseInt(data.documentationCompleteness),
        timelinessRating: parseInt(data.timelinessRating),
        complianceRating: parseInt(data.complianceRating),
        strengths: data.strengths,
        areasForImprovement: data.areasForImprovement,
        coachingNotes: data.coachingNotes,
        recommendedActions: data.recommendedActions,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/bar/reviews"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bar/stats"] });
      toast({
        title: "Review submitted successfully",
        description: "Your feedback has been recorded and the caseworker will be notified.",
      });
      form.reset();
      onClose();
    },
    onError: (error: any) => {
      toast({
        title: "Error submitting review",
        description: error.message || "Failed to submit review. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ReviewFeedbackForm) => {
    submitReviewMutation.mutate(data);
  };

  // Prevent modal from closing
  const handleInteractOutside = (e: Event) => {
    e.preventDefault();
  };

  const handleEscapeKeyDown = (e: KeyboardEvent) => {
    e.preventDefault();
  };

  return (
    <Dialog 
      open={isOpen} 
      onOpenChange={() => {}}
    >
      <DialogContent 
        className="max-w-3xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={handleInteractOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
        data-testid="modal-supervisor-review"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl" data-testid="text-modal-title">
            Mandatory Case Review Required
          </DialogTitle>
          <DialogDescription data-testid="text-modal-description">
            Complete all fields below to submit your review feedback. This modal cannot be dismissed until the review is submitted.
          </DialogDescription>
        </DialogHeader>

        {/* Case Information Display */}
        <div className="bg-muted p-4 rounded-lg space-y-2" data-testid="section-case-info">
          <h3 className="font-semibold mb-3">Case Information</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Anonymized Case ID:</span>
              <p className="font-mono font-medium">{review.id.substring(0, 12)}...</p>
            </div>
            <div>
              <span className="text-muted-foreground">Program Type:</span>
              <p className="font-medium">SNAP Benefits</p>
            </div>
            <div>
              <span className="text-muted-foreground">County:</span>
              <p className="font-medium">{review.caseId?.substring(0, 10) || 'N/A'}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Case Worker:</span>
              <p className="font-mono font-medium">CW-{review.caseworkerId.substring(0, 8)}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Sample Date:</span>
              <p className="font-medium">
                {format(parseISO(review.reviewPeriodStart), 'MMM d, yyyy')}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Review Period:</span>
              <p className="font-medium">{review.reviewDuration} days</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Review Form */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" data-testid="form-review-feedback">
            {/* Rating Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="overallQualityRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Overall Quality Rating *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-overall-quality">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RATING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="documentationCompleteness"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Documentation Completeness *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-documentation">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RATING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timelinessRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Timeliness Rating *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-timeliness">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RATING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="complianceRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Compliance Rating *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-compliance">
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {RATING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <Separator />

            {/* Text Fields */}
            <FormField
              control={form.control}
              name="strengths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Strengths *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what the caseworker did well (minimum 50 characters)..."
                      className="min-h-[100px]"
                      data-testid="input-strengths"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value.length}/50 characters minimum
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="areasForImprovement"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Areas for Improvement *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe areas where the caseworker can improve (minimum 50 characters)..."
                      className="min-h-[100px]"
                      data-testid="input-areas-improvement"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value.length}/50 characters minimum
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="coachingNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coaching Notes *</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed coaching guidance for the caseworker (minimum 100 characters)..."
                      className="min-h-[120px]"
                      data-testid="input-coaching-notes"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value.length}/100 characters minimum - These notes will be shared with the caseworker for coaching and development
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Recommended Actions */}
            <FormField
              control={form.control}
              name="recommendedActions"
              render={() => (
                <FormItem>
                  <div className="mb-4">
                    <FormLabel>Recommended Actions *</FormLabel>
                    <FormDescription>
                      Select all actions that should be taken
                    </FormDescription>
                  </div>
                  {RECOMMENDED_ACTIONS.map((action) => (
                    <FormField
                      key={action.id}
                      control={form.control}
                      name="recommendedActions"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={action.id}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(action.id)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...field.value, action.id])
                                    : field.onChange(
                                        field.value?.filter(
                                          (value) => value !== action.id
                                        )
                                      );
                                }}
                                data-testid={`checkbox-action-${action.id}`}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {action.label}
                            </FormLabel>
                          </FormItem>
                        );
                      }}
                    />
                  ))}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Alert about mandatory submission */}
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                This is a mandatory review. You must complete and submit this form before you can close this dialog.
              </AlertDescription>
            </Alert>

            {/* Submit Button */}
            <div className="flex justify-end gap-3">
              <Button
                type="submit"
                disabled={submitReviewMutation.isPending || !form.formState.isValid}
                data-testid="button-submit-review"
              >
                {submitReviewMutation.isPending ? (
                  <>Submitting...</>
                ) : (
                  <>
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                    Submit Review
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
