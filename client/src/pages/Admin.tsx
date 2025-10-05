import AdminDashboard from "@/components/AdminDashboard";
import { DocumentIngestionPanel } from "@/components/DocumentIngestionPanel";
import { IncomeLimitsManager } from "@/components/IncomeLimitsManager";
import { DeductionsManager } from "@/components/DeductionsManager";
import { AllotmentsManager } from "@/components/AllotmentsManager";
import { CategoricalEligibilityManager } from "@/components/CategoricalEligibilityManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
        <TabsList className="grid grid-cols-3 md:grid-cols-6 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
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
