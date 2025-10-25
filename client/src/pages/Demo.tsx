import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "wouter";
import {
  Sparkles,
  Rocket,
  Users,
  DollarSign,
  Code2,
  Accessibility,
  Bot,
  TrendingUp,
  CheckCircle2,
  FileText,
  ArrowRight,
  MessageSquare,
  Database,
  ExternalLink,
} from "lucide-react";
import { FEATURE_CATALOG, FEATURE_CATEGORIES, AI_POWERED_FEATURES, getFeaturesByCategory } from "@shared/featureMetadata";
import { API_ENDPOINTS } from "@shared/apiEndpoints";
import { FeatureCard } from "@/components/demo/FeatureCard";
import { CategoryGrid } from "@/components/demo/CategoryGrid";
import { AIConversationViewer } from "@/components/demo/AIConversationViewer";
import { MetricsDisplay } from "@/components/demo/MetricsDisplay";
import { ArchitectureDiagram } from "@/components/demo/ArchitectureDiagram";
import type {
  DemoHousehold,
  DemoMetrics,
  DemoAIConversation,
} from "@server/services/demoDataService";

export default function Demo() {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("overview");

  const { data: metrics, isLoading: metricsLoading } = useQuery<DemoMetrics>({
    queryKey: ['/api/demo/metrics'],
  });

  const { data: households, isLoading: householdsLoading } = useQuery<DemoHousehold[]>({
    queryKey: ['/api/demo/households'],
  });

  const { data: aiConversations, isLoading: conversationsLoading } = useQuery<DemoAIConversation[]>({
    queryKey: ['/api/demo/ai-conversations'],
  });

  const filteredFeatures = selectedCategory
    ? getFeaturesByCategory(selectedCategory)
    : FEATURE_CATALOG;

  const handleCategoryClick = (category: string) => {
    setSelectedCategory(selectedCategory === category ? null : category);
    const element = document.getElementById('features-section');
    element?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <>

      <div className="container mx-auto px-4 py-8 space-y-12">
        {/* Hero Section */}
        <section className="text-center space-y-6" data-testid="hero-section">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight" data-testid="hero-title">
              Universal Benefits-Tax Navigator
            </h1>
            <p className="text-xl text-muted-foreground" data-testid="hero-subtitle">
              Interactive Platform Showcase
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <Card data-testid="stat-features">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-primary">{FEATURE_CATALOG.length}</CardTitle>
                <CardDescription>Features</CardDescription>
              </CardHeader>
            </Card>
            <Card data-testid="stat-tables">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-primary">136</CardTitle>
                <CardDescription>Database Tables</CardDescription>
              </CardHeader>
            </Card>
            <Card data-testid="stat-endpoints">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-primary">{API_ENDPOINTS.length}</CardTitle>
                <CardDescription>API Endpoints</CardDescription>
              </CardHeader>
            </Card>
            <Card data-testid="stat-services">
              <CardHeader className="pb-3">
                <CardTitle className="text-3xl font-bold text-primary">140+</CardTitle>
                <CardDescription>Services</CardDescription>
              </CardHeader>
            </Card>
          </div>

          <div className="flex flex-wrap gap-4 justify-center">
            <Button size="lg" className="gap-2" onClick={() => setActiveTab('features')} data-testid="button-explore-demo">
              <Rocket className="h-5 w-5" />
              Explore Demo
            </Button>
            <Link href="/admin/api-docs">
              <Button size="lg" variant="outline" className="gap-2" data-testid="button-api-docs">
                <Code2 className="h-5 w-5" />
                API Documentation
              </Button>
            </Link>
          </div>
        </section>

        {/* Quick Stats Grid */}
        <section className="space-y-6" data-testid="quick-stats-section">
          <h2 className="text-2xl font-bold" data-testid="section-title-quick-stats">Platform Highlights</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card data-testid="stat-production-ready">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Production Readiness</CardTitle>
                <CheckCircle2 className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">92/100</div>
                <p className="text-xs text-muted-foreground">All core features operational</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-wcag-compliance">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">WCAG Compliance</CardTitle>
                <Accessibility className="h-4 w-4 text-blue-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">91.7%</div>
                <p className="text-xs text-muted-foreground">Level A pass rate</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-test-coverage">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Test Coverage</CardTitle>
                <FileText className="h-4 w-4 text-purple-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">199</div>
                <p className="text-xs text-muted-foreground">Automated tests</p>
              </CardContent>
            </Card>

            <Card data-testid="stat-programs">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Supported Programs</CardTitle>
                <Users className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">6</div>
                <p className="text-xs text-muted-foreground">SNAP, Medicaid, TANF, OHEP, Tax Credits, SSI</p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Gen AI Capabilities Showcase */}
        <section className="space-y-6" data-testid="ai-capabilities-section">
          <div className="flex items-center gap-3">
            <Sparkles className="h-6 w-6 text-purple-600" />
            <h2 className="text-2xl font-bold" data-testid="section-title-ai-capabilities">
              Gen AI Capabilities
            </h2>
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300">
              Powered by Gemini 2.0 Flash
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {AI_POWERED_FEATURES.slice(0, 5).map((feature) => (
              <FeatureCard key={feature.id} feature={feature} />
            ))}
          </div>

          <div className="text-center">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setSelectedCategory(null);
                setActiveTab('features');
              }}
              data-testid="button-view-all-ai"
            >
              View All {AI_POWERED_FEATURES.length} AI-Powered Features
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </section>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 lg:grid-cols-6" data-testid="tabs-list">
            <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
            <TabsTrigger value="features" data-testid="tab-features">Features</TabsTrigger>
            <TabsTrigger value="ai-conversations" data-testid="tab-ai-conversations">AI Conversations</TabsTrigger>
            <TabsTrigger value="performance" data-testid="tab-performance">Performance</TabsTrigger>
            <TabsTrigger value="households" data-testid="tab-households">Sample Data</TabsTrigger>
            <TabsTrigger value="architecture" data-testid="tab-architecture">Architecture</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-8">
            <section>
              <h2 className="text-2xl font-bold mb-4" data-testid="section-title-categories">
                Feature Categories
              </h2>
              <CategoryGrid
                categories={FEATURE_CATEGORIES}
                onCategoryClick={handleCategoryClick}
                selectedCategory={selectedCategory}
              />
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">Platform Resources</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Link href="/admin/api-docs">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="link-api-explorer">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Code2 className="h-5 w-5" />
                        API Explorer
                      </CardTitle>
                      <CardDescription>
                        Interactive documentation for all {API_ENDPOINTS.length} API endpoints
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>

                <Link href="/legal/accessibility">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="link-accessibility-report">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Accessibility className="h-5 w-5" />
                        Accessibility Reports
                      </CardTitle>
                      <CardDescription>
                        WCAG 2.1 Level A compliance testing results
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>

                <Link href="/developer">
                  <Card className="cursor-pointer hover:shadow-lg transition-shadow" data-testid="link-developer-portal">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ExternalLink className="h-5 w-5" />
                        Developer Portal
                      </CardTitle>
                      <CardDescription>
                        Integration guides and API keys management
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </Link>
              </div>
            </section>
          </TabsContent>

          {/* Features Tab */}
          <TabsContent value="features" className="space-y-6" id="features-section">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold" data-testid="section-title-all-features">
                  All Features
                  {selectedCategory && `: ${selectedCategory}`}
                </h2>
                <p className="text-muted-foreground">
                  {filteredFeatures.length} of {FEATURE_CATALOG.length} features
                </p>
              </div>
              {selectedCategory && (
                <Button
                  variant="outline"
                  onClick={() => setSelectedCategory(null)}
                  data-testid="button-clear-filter"
                >
                  Clear Filter
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredFeatures.map((feature) => (
                <FeatureCard key={feature.id} feature={feature} />
              ))}
            </div>
          </TabsContent>

          {/* AI Conversations Tab */}
          <TabsContent value="ai-conversations" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="section-title-ai-conversations">
                AI Conversation Examples
              </h2>
              <p className="text-muted-foreground">
                Sample conversations showcasing AI-powered features
              </p>
            </div>

            {conversationsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : aiConversations && aiConversations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {aiConversations.slice(0, 4).map((conversation) => (
                  <AIConversationViewer key={conversation.id} conversation={conversation} />
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center space-y-2">
                    <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">No AI conversations available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="section-title-performance">
                Platform Performance Metrics
              </h2>
              <p className="text-muted-foreground">
                Real-time monitoring data from the last 30 days
              </p>
            </div>

            {metricsLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-48 w-full" />
              </div>
            ) : metrics ? (
              <MetricsDisplay metrics={metrics} />
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center space-y-2">
                    <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">No metrics data available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Households Tab */}
          <TabsContent value="households" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="section-title-households">
                Sample Household Data
              </h2>
              <p className="text-muted-foreground">
                Representative test cases for diverse households
              </p>
            </div>

            {householdsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-32 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : households && households.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {households.slice(0, 3).map((household) => (
                  <Card key={household.id} data-testid={`household-card-${household.id}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        {household.name}
                      </CardTitle>
                      <CardDescription>{household.type}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Household Size</p>
                          <p className="font-medium">{household.members.length} members</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">County</p>
                          <p className="font-medium">{household.county}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Income</p>
                          <p className="font-medium">${household.income.totalMonthly.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Monthly Expenses</p>
                          <p className="font-medium">${household.expenses.totalMonthly.toLocaleString()}</p>
                        </div>
                      </div>
                      <div className="pt-2">
                        <Link href={`/household-profiler?household=${household.id}`}>
                          <Button variant="outline" size="sm" className="w-full" data-testid={`button-view-household-${household.id}`}>
                            View Full Profile
                          </Button>
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <div className="text-center space-y-2">
                    <Database className="h-12 w-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">No household data available</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Architecture Tab */}
          <TabsContent value="architecture" className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2" data-testid="section-title-architecture">
                System Architecture
              </h2>
              <p className="text-muted-foreground">
                Complete technology stack and platform infrastructure
              </p>
            </div>

            <ArchitectureDiagram />

            <Card>
              <CardHeader>
                <CardTitle>Infrastructure Highlights</CardTitle>
                <CardDescription>Key platform capabilities and design decisions</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Performance & Scalability
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Multi-layer caching (94% hit rate on Rules Engine)</li>
                      <li>Real-time WebSocket notifications</li>
                      <li>Progressive Web App (PWA) with offline support</li>
                      <li>Hierarchical cache architecture with auto-invalidation</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Security & Compliance
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>WCAG 2.1 Level A compliance (91.7%)</li>
                      <li>Role-based access control (RBAC)</li>
                      <li>Encrypted PII storage with field-level encryption</li>
                      <li>Comprehensive audit logging</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      AI & Automation
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Google Gemini 2.0 Flash for LLM & Vision</li>
                      <li>RAG-powered policy Q&A with citation tracking</li>
                      <li>Automated legislative bill tracking</li>
                      <li>Smart scheduler for policy scraping (70-80% reduction)</li>
                    </ul>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      Multi-Tenant & Mobile
                    </h4>
                    <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                      <li>Multi-county and multi-state deployment support</li>
                      <li>County-specific branding and configuration</li>
                      <li>Mobile-first responsive design</li>
                      <li>10 language support with plain language validation</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
