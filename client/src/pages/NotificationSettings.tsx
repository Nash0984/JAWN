import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Bell, Mail, CheckCircle, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

type NotificationPreferences = {
  emailEnabled: boolean;
  inAppEnabled: boolean;
  policyChanges: boolean;
  feedbackAlerts: boolean;
  navigatorAlerts: boolean;
  systemAlerts: boolean;
  ruleExtractionAlerts: boolean;
};

export default function NotificationSettings() {
  const { toast } = useToast();

  const { data: preferences, isLoading } = useQuery<NotificationPreferences>({
    queryKey: ["/api/notifications/preferences"],
  });

  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);

  // Initialize local state when preferences load
  const currentPrefs = localPrefs || preferences || {
    emailEnabled: true,
    inAppEnabled: true,
    policyChanges: true,
    feedbackAlerts: true,
    navigatorAlerts: true,
    systemAlerts: true,
    ruleExtractionAlerts: true,
  };

  // Check if there are actual changes from server state
  const actuallyHasChanges = localPrefs && preferences ? 
    JSON.stringify(localPrefs) !== JSON.stringify(preferences) : 
    false;

  const updateMutation = useMutation({
    mutationFn: (prefs: NotificationPreferences) =>
      apiRequest("POST", "/api/notifications/preferences", prefs),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/notifications/preferences"] });
      setLocalPrefs(null); // Reset local changes after save
      toast({
        title: "Settings saved",
        description: "Your notification preferences have been updated.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save notification preferences.",
        variant: "destructive",
      });
    },
  });

  const handleToggle = (key: keyof NotificationPreferences, value: boolean) => {
    const updated = { ...currentPrefs, [key]: value };
    setLocalPrefs(updated);
    // hasChanges will be calculated from actuallyHasChanges
  };

  const handleSave = () => {
    if (localPrefs) {
      updateMutation.mutate(localPrefs);
    }
  };

  const handleReset = () => {
    setLocalPrefs(null);
  };

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-settings">
          Notification Settings
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage how you receive notifications about policy updates, feedback, and system alerts
        </p>
      </div>

      {/* Unsaved changes alert */}
      {actuallyHasChanges && (
        <Alert data-testid="alert-unsaved">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            You have unsaved changes. Click "Save Changes" to apply them.
          </AlertDescription>
        </Alert>
      )}

      {/* Delivery Methods */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Delivery Methods
          </CardTitle>
          <CardDescription>
            Choose how you want to receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-enabled" className="text-base">
                Email Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications via email
              </p>
            </div>
            <Switch
              id="email-enabled"
              checked={currentPrefs.emailEnabled}
              onCheckedChange={(checked) => handleToggle("emailEnabled", checked)}
              data-testid="switch-email"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="inapp-enabled" className="text-base">
                In-App Notifications
              </Label>
              <p className="text-sm text-muted-foreground">
                Receive notifications in the application
              </p>
            </div>
            <Switch
              id="inapp-enabled"
              checked={currentPrefs.inAppEnabled}
              onCheckedChange={(checked) => handleToggle("inAppEnabled", checked)}
              data-testid="switch-inapp"
            />
          </div>
        </CardContent>
      </Card>

      {/* Notification Categories */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Notification Categories
          </CardTitle>
          <CardDescription>
            Select which types of notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="policy-changes" className="text-base">
                Policy Changes
              </Label>
              <p className="text-sm text-muted-foreground">
                Updates to SNAP policy rules and regulations
              </p>
            </div>
            <Switch
              id="policy-changes"
              checked={currentPrefs.policyChanges}
              onCheckedChange={(checked) => handleToggle("policyChanges", checked)}
              data-testid="switch-policy"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="feedback-alerts" className="text-base">
                Feedback Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                New feedback submissions and responses (admin only)
              </p>
            </div>
            <Switch
              id="feedback-alerts"
              checked={currentPrefs.feedbackAlerts}
              onCheckedChange={(checked) => handleToggle("feedbackAlerts", checked)}
              data-testid="switch-feedback"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="navigator-alerts" className="text-base">
                Navigator Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Case assignments and client updates (staff only)
              </p>
            </div>
            <Switch
              id="navigator-alerts"
              checked={currentPrefs.navigatorAlerts}
              onCheckedChange={(checked) => handleToggle("navigatorAlerts", checked)}
              data-testid="switch-navigator"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="rule-extraction" className="text-base">
                Rule Extraction Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Completion of automated policy rule extraction jobs
              </p>
            </div>
            <Switch
              id="rule-extraction"
              checked={currentPrefs.ruleExtractionAlerts}
              onCheckedChange={(checked) => handleToggle("ruleExtractionAlerts", checked)}
              data-testid="switch-rules"
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="system-alerts" className="text-base">
                System Alerts
              </Label>
              <p className="text-sm text-muted-foreground">
                Important system updates and maintenance notices
              </p>
            </div>
            <Switch
              id="system-alerts"
              checked={currentPrefs.systemAlerts}
              onCheckedChange={(checked) => handleToggle("systemAlerts", checked)}
              data-testid="switch-system"
            />
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4">
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={!actuallyHasChanges}
          data-testid="button-reset"
        >
          Reset
        </Button>
        <Button
          onClick={handleSave}
          disabled={!actuallyHasChanges || updateMutation.isPending}
          data-testid="button-save"
        >
          {updateMutation.isPending ? "Saving..." : "Save Changes"}
        </Button>
      </div>
    </div>
  );
}
