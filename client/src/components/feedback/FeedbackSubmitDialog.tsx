import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { insertFeedbackEntrySchema, type InsertFeedbackEntry, type FeedbackFeature } from "@shared/schema";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquarePlus } from "lucide-react";

const feedbackFormSchema = insertFeedbackEntrySchema.extend({
  title: z.string().min(5, "Title must be at least 5 characters").max(200, "Title must not exceed 200 characters"),
  description: z.string().min(10, "Description must be at least 10 characters").max(5000, "Description must not exceed 5000 characters"),
}).omit({ userId: true, tenantId: true, anonymousContactHash: true });

type FeedbackFormData = z.infer<typeof feedbackFormSchema>;

interface FeedbackSubmitDialogProps {
  trigger?: React.ReactNode;
  defaultFeature?: string;
  onSuccess?: () => void;
}

export function FeedbackSubmitDialog({ trigger, defaultFeature, onSuccess }: FeedbackSubmitDialogProps) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: features } = useQuery<FeedbackFeature[]>({
    queryKey: ["/api/feedback/features"],
  });

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackFormSchema),
    defaultValues: {
      featureId: defaultFeature || "",
      type: "bug_report",
      priority: "medium",
      title: "",
      description: "",
      status: "submitted",
      upvotes: 0,
      downvotes: 0,
      viewCount: 0,
      commentCount: 0,
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      return await apiRequest<InsertFeedbackEntry>("/api/feedback/entries", {
        method: "POST",
        body: JSON.stringify(data),
      });
    },
    onSuccess: () => {
      toast({
        title: "Thank you for your feedback!",
        description: "We'll review it soon and get back to you.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/feedback/entries"] });
      form.reset();
      setOpen(false);
      onSuccess?.();
    },
    onError: (error) => {
      toast({
        title: "Failed to submit feedback",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: FeedbackFormData) => {
    submitMutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild data-testid="button-open-feedback-dialog">
        {trigger || (
          <Button variant="outline">
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Submit Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-feedback-submit">
        <DialogHeader>
          <DialogTitle>Submit Feedback</DialogTitle>
          <DialogDescription>
            Help us improve by sharing your feedback, reporting bugs, or suggesting new features.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="featureId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feature/Area</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-feature">
                        <SelectValue placeholder="Select the feature this relates to" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {features?.map((feature) => (
                        <SelectItem key={feature.id} value={feature.id}>
                          {feature.name}
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Feedback Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      value={field.value || ""}
                      className="grid grid-cols-2 gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="bug_report" id="bug_report" data-testid="radio-type-bug" />
                        <label htmlFor="bug_report" className="cursor-pointer">Bug Report</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="feature_request" id="feature_request" data-testid="radio-type-feature" />
                        <label htmlFor="feature_request" className="cursor-pointer">Feature Request</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="usability_issue" id="usability_issue" data-testid="radio-type-usability" />
                        <label htmlFor="usability_issue" className="cursor-pointer">Usability Issue</label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="content_error" id="content_error" data-testid="radio-type-content" />
                        <label htmlFor="content_error" className="cursor-pointer">Content Error</label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="priority"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Priority</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value || ""}>
                    <FormControl>
                      <SelectTrigger data-testid="select-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Brief summary of your feedback"
                      {...field}
                      value={field.value || ""}
                      data-testid="input-title"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Provide detailed information about your feedback..."
                      className="min-h-[120px]"
                      {...field}
                      value={field.value || ""}
                      data-testid="textarea-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={submitMutation.isPending}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitMutation.isPending}
                data-testid="button-submit-feedback"
              >
                {submitMutation.isPending ? "Submitting..." : "Submit Feedback"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
