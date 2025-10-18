import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Layers, Database, Cloud, Sparkles, ExternalLink } from "lucide-react";

export function ArchitectureDiagram() {
  const techStack = {
    frontend: [
      { name: 'React 18', description: 'UI Framework' },
      { name: 'shadcn/ui', description: 'Component Library' },
      { name: 'Tailwind CSS', description: 'Styling' },
      { name: 'TanStack Query', description: 'Data Fetching' },
      { name: 'Wouter', description: 'Routing' },
      { name: 'Framer Motion', description: 'Animations' },
    ],
    backend: [
      { name: 'Express.js', description: 'Node.js Framework' },
      { name: 'PostgreSQL', description: 'Primary Database' },
      { name: 'Drizzle ORM', description: 'Type-safe ORM' },
      { name: 'Node-Cache', description: 'In-Memory Cache' },
      { name: 'Helmet & CORS', description: 'Security' },
      { name: 'Passport.js', description: 'Authentication' },
    ],
    ai: [
      { name: 'Google Gemini 2.0 Flash', description: 'LLM & Vision' },
      { name: 'RAG Service', description: 'Policy Q&A' },
      { name: 'Document Analysis', description: 'Vision AI' },
      { name: 'Embeddings', description: 'Semantic Search' },
    ],
    external: [
      { name: 'PolicyEngine', description: 'Benefit Calculations' },
      { name: 'Google Calendar', description: 'Appointments' },
      { name: 'TaxSlayer Pro', description: 'E-Filing' },
      { name: 'Twilio', description: 'SMS Communications' },
      { name: 'Google Cloud Storage', description: 'Document Storage' },
    ],
  };

  return (
    <Card data-testid="architecture-diagram">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          System Architecture
        </CardTitle>
        <CardDescription>
          Full-stack platform with AI, external integrations, and multi-tenant support
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Frontend Layer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <Layers className="h-5 w-5 text-blue-600 dark:text-blue-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Frontend</h3>
                <p className="text-xs text-muted-foreground">React + TypeScript</p>
              </div>
            </div>
            <div className="space-y-2">
              {techStack.frontend.map((tech) => (
                <div key={tech.name} className="p-2 rounded-md bg-muted/50">
                  <p className="text-sm font-medium">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">{tech.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Backend Layer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <Database className="h-5 w-5 text-green-600 dark:text-green-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Backend</h3>
                <p className="text-xs text-muted-foreground">Node.js + PostgreSQL</p>
              </div>
            </div>
            <div className="space-y-2">
              {techStack.backend.map((tech) => (
                <div key={tech.name} className="p-2 rounded-md bg-muted/50">
                  <p className="text-sm font-medium">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">{tech.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* AI Layer */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">AI Services</h3>
                <p className="text-xs text-muted-foreground">Gemini 2.0 Flash</p>
              </div>
            </div>
            <div className="space-y-2">
              {techStack.ai.map((tech) => (
                <div key={tech.name} className="p-2 rounded-md bg-muted/50">
                  <p className="text-sm font-medium">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">{tech.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* External Integrations */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <ExternalLink className="h-5 w-5 text-orange-600 dark:text-orange-300" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Integrations</h3>
                <p className="text-xs text-muted-foreground">External Services</p>
              </div>
            </div>
            <div className="space-y-2">
              {techStack.external.map((tech) => (
                <div key={tech.name} className="p-2 rounded-md bg-muted/50">
                  <p className="text-sm font-medium">{tech.name}</p>
                  <p className="text-xs text-muted-foreground">{tech.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Key Features */}
        <div className="mt-6 pt-6 border-t">
          <h4 className="text-sm font-semibold mb-3">Platform Capabilities</h4>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">131 Database Tables</Badge>
            <Badge variant="secondary">367 API Endpoints</Badge>
            <Badge variant="secondary">94 Services</Badge>
            <Badge variant="secondary">Multi-Tenant</Badge>
            <Badge variant="secondary">Real-time WebSocket</Badge>
            <Badge variant="secondary">PWA Support</Badge>
            <Badge variant="secondary">WCAG 2.1 Level A</Badge>
            <Badge variant="secondary">10 Languages</Badge>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
