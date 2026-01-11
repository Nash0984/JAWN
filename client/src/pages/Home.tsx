import SearchInterface from "@/components/SearchInterface";
import DocumentUploadToggle from "@/components/DocumentUploadToggle";
import { useLanguage } from "@/hooks/useLanguage";
import { Shield, Sparkles, Clock, FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Helmet } from "react-helmet-async";
import { useTenant } from "@/contexts/TenantContext";

export default function Home() {
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const { t } = useLanguage();
  
  return (
    <>
      <Helmet>
        <title>Home - {stateName} Benefits Navigator</title>
      </Helmet>
      
      <div className="min-h-screen">
        {/* Hero Section with Gradient Background */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 pb-12 pt-8 sm:pt-12" aria-labelledby="main-heading">
          {/* Decorative Background Elements */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-secondary/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          </div>
          
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8 sm:mb-10 animate-fade-in">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6 animate-slide-down">
                <Sparkles className="w-4 h-4" />
                <span>AI-Powered Benefits Assistant</span>
              </div>
              
              <h1 id="main-heading" className="text-4xl sm:text-5xl lg:text-6xl font-bold text-foreground mb-4 sm:mb-6 tracking-tight animate-slide-up">
                {t("home.title")}
              </h1>
              
              <p className="text-lg sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed animate-slide-up" style={{ animationDelay: '0.1s' }}>
                {t("home.subtitle")}
              </p>
            </div>
            
            <div className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
              <SearchInterface />
            </div>
          </div>
        </section>

        {/* Feature Cards */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-10 mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="group bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-300">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Secure & Private</h3>
                  <p className="text-sm text-muted-foreground">Your data is protected with enterprise-grade encryption</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-success/10 text-success group-hover:bg-success group-hover:text-white transition-colors duration-300">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">Instant Answers</h3>
                  <p className="text-sm text-muted-foreground">Get real-time eligibility information in seconds</p>
                </div>
              </CardContent>
            </Card>
            
            <Card className="group bg-card/80 backdrop-blur-sm border-border/50 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="p-3 rounded-xl bg-secondary/20 text-secondary-foreground group-hover:bg-secondary group-hover:text-secondary-foreground transition-colors duration-300">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-1">6 Programs</h3>
                  <p className="text-sm text-muted-foreground">SNAP, Medicaid, TANF, OHEP, Tax Credits & SSI</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Document Verification Section */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mb-12" aria-labelledby="document-heading">
          <Card className="overflow-hidden border-border/50 shadow-lg">
            <div className="bg-gradient-to-r from-muted/50 to-muted/30 p-6 sm:p-8">
              <div className="text-center mb-6">
                <h2 id="document-heading" className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
                  {t("home.documents.title")}
                </h2>
                <p className="text-sm sm:text-base text-muted-foreground">
                  {t("home.documents.subtitle")}
                </p>
              </div>
              <DocumentUploadToggle />
            </div>
          </Card>
        </section>

        {/* System Status Footer */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12" aria-labelledby="status-heading">
          <div className="flex items-center justify-center gap-6 py-6 border-t border-border/50">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
              <span id="status-heading" className="text-sm text-muted-foreground">
                System <span className="text-green-600 font-medium">Active</span>
              </span>
            </div>
            <span className="text-border">|</span>
            <span className="text-xs text-muted-foreground">
              Policy manual updated: January 2026
            </span>
          </div>
        </section>
      </div>
    </>
  );
}
