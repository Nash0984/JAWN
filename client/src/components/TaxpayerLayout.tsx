import { useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { FileText, MessageSquare, PenTool, LayoutDashboard } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import NotificationBell from "@/components/NotificationBell";

interface TaxpayerLayoutProps {
  children: React.ReactNode;
}

export function TaxpayerLayout({ children }: TaxpayerLayoutProps) {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();

  const tabs = [
    {
      value: "/taxpayer",
      label: "Dashboard",
      icon: LayoutDashboard,
      testId: "tab-dashboard",
    },
    {
      value: "/taxpayer/documents",
      label: "Documents",
      icon: FileText,
      testId: "tab-documents",
    },
    {
      value: "/taxpayer/messages",
      label: "Messages",
      icon: MessageSquare,
      testId: "tab-messages",
    },
    {
      value: "/taxpayer/signature",
      label: "E-Signature",
      icon: PenTool,
      testId: "tab-signature",
    },
  ];

  const activeTab = tabs.find(tab => location === tab.value)?.value || "/taxpayer";

  return (
    <div className="min-h-screen bg-background dark:bg-background">
      {/* Header */}
      <div className="border-b border-border dark:border-border bg-card dark:bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground dark:text-foreground">
                Taxpayer Portal
              </h1>
              {user?.fullName && (
                <p className="text-sm text-muted-foreground dark:text-muted-foreground">
                  {user.fullName}
                </p>
              )}
            </div>
            <NotificationBell />
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-border dark:border-border bg-card dark:bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <Tabs value={activeTab} onValueChange={(value) => setLocation(value)} className="w-full">
            <TabsList className="w-full justify-start h-auto p-0 bg-transparent border-0 rounded-none">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                
                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    aria-label={tab.label}
                    className={cn(
                      "flex items-center gap-2 px-6 py-3 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent",
                      "text-muted-foreground dark:text-muted-foreground data-[state=active]:text-foreground dark:data-[state=active]:text-foreground",
                      "hover:text-foreground dark:hover:text-foreground hover:bg-muted/50 dark:hover:bg-muted/20 transition-colors"
                    )}
                    data-testid={tab.testId}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Main Content */}
      <main role="main">
        {children}
      </main>
    </div>
  );
}
