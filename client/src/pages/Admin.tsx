import AdminDashboard from "@/components/AdminDashboard";
import { DocumentIngestionPanel } from "@/components/DocumentIngestionPanel";
import { IncomeLimitsManager } from "@/components/IncomeLimitsManager";
import { DeductionsManager } from "@/components/DeductionsManager";
import { AllotmentsManager } from "@/components/AllotmentsManager";
import { CategoricalEligibilityManager } from "@/components/CategoricalEligibilityManager";
import { PolicyEngineVerificationPanel } from "@/components/PolicyEngineVerificationPanel";
import { VITAChatWidget } from "@/components/VITAChatWidget";
import { BenchmarkInsightsPanel } from "@/components/BenchmarkInsightsPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Admin() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Administration Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage SNAP rules, policy sources, and system configuration
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid grid-cols-4 md:grid-cols-8 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="vita">VITA</TabsTrigger>
          <TabsTrigger value="verification">Verification</TabsTrigger>
          <TabsTrigger value="income">Income Limits</TabsTrigger>
          <TabsTrigger value="deductions">Deductions</TabsTrigger>
          <TabsTrigger value="allotments">Allotments</TabsTrigger>
          <TabsTrigger value="categorical">Categorical</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="documents" className="space-y-6">
          <DocumentIngestionPanel />
        </TabsContent>

        <TabsContent value="vita" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>VITA Tax Knowledge Base</CardTitle>
              <CardDescription>
                Test the VITA (Volunteer Income Tax Assistance) knowledge base powered by IRS Publication 4012
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                This interface allows you to test semantic search over federal tax rules.
                The system uses Gemini embeddings to find relevant IRS Pub 4012 sections and extracted tax rules.
              </p>
              <VITAChatWidget compact={true} />
            </CardContent>
          </Card>

          <BenchmarkInsightsPanel />
        </TabsContent>

        <TabsContent value="verification" className="space-y-6">
          <PolicyEngineVerificationPanel />
        </TabsContent>

        <TabsContent value="income" className="space-y-6">
          <IncomeLimitsManager />
        </TabsContent>

        <TabsContent value="deductions" className="space-y-6">
          <DeductionsManager />
        </TabsContent>

        <TabsContent value="allotments" className="space-y-6">
          <AllotmentsManager />
        </TabsContent>

        <TabsContent value="categorical" className="space-y-6">
          <CategoricalEligibilityManager />
        </TabsContent>
      </Tabs>
    </div>
  );
}
