import { useState } from "react";
import { useTranslationPermissions } from "@/hooks/useTranslationPermissions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TranslationList } from "@/components/translation/TranslationList";
import { TranslatorWorkbench } from "@/components/translation/TranslatorWorkbench";
import { ReviewerPanel } from "@/components/translation/ReviewerPanel";
import { AdminConsole } from "@/components/translation/AdminConsole";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Languages } from "lucide-react";

export default function TranslationDashboard() {
  const permissions = useTranslationPermissions();
  const [selectedKeyId, setSelectedKeyId] = useState<string | null>(null);
  
  if (!permissions.canViewTranslations) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card>
          <CardHeader>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the translation dashboard.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center gap-3 mb-6">
        <Languages className="h-8 w-8" />
        <h1 className="text-3xl font-bold">Translation Management</h1>
      </div>
      
      <Tabs defaultValue="list" className="space-y-4">
        <TabsList>
          <TabsTrigger value="list" data-testid="tab-list">All Translations</TabsTrigger>
          {permissions.canEditTranslations && (
            <TabsTrigger value="workbench" data-testid="tab-workbench" disabled={!selectedKeyId}>
              Translator Workbench
            </TabsTrigger>
          )}
          {permissions.canReviewTranslations && (
            <TabsTrigger value="review" data-testid="tab-review" disabled={!selectedKeyId}>
              Reviewer Panel
            </TabsTrigger>
          )}
          {permissions.canManageAssignments && (
            <TabsTrigger value="admin" data-testid="tab-admin">Admin Console</TabsTrigger>
          )}
        </TabsList>
        
        <TabsContent value="list">
          <TranslationList onSelectKey={setSelectedKeyId} />
        </TabsContent>
        
        {permissions.canEditTranslations && (
          <TabsContent value="workbench">
            {selectedKeyId ? (
              <TranslatorWorkbench keyId={selectedKeyId} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Translation Selected</CardTitle>
                  <CardDescription>Select a translation from the list to start editing.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        )}
        
        {permissions.canReviewTranslations && (
          <TabsContent value="review">
            {selectedKeyId ? (
              <ReviewerPanel keyId={selectedKeyId} />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Translation Selected</CardTitle>
                  <CardDescription>Select a translation from the list to review.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </TabsContent>
        )}
        
        {permissions.canManageAssignments && (
          <TabsContent value="admin">
            <AdminConsole />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
