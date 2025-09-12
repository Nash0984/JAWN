import AdminDashboard from "@/components/AdminDashboard";
import { DocumentIngestionPanel } from "@/components/DocumentIngestionPanel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Admin() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Administration Dashboard
        </h1>
        <p className="text-muted-foreground">
          Manage policy sources, monitor system health, and configure AI models
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="documents">Golden Source Documents</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-6">
          <AdminDashboard />
        </TabsContent>
        
        <TabsContent value="documents" className="space-y-6">
          <DocumentIngestionPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
