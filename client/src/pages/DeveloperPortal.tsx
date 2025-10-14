import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { 
  Code, 
  Key, 
  BookOpen, 
  Rocket, 
  Shield, 
  Activity, 
  Copy, 
  ExternalLink,
  CheckCircle,
  XCircle,
  Zap,
  Globe,
  FileJson
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export default function DeveloperPortal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [newKeyName, setNewKeyName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([]);
  const [selectedRateLimit, setSelectedRateLimit] = useState("1000");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

  // Fetch API keys (admin only)
  const { data: apiKeys, isLoading: keysLoading } = useQuery({
    queryKey: ['/api/admin/api-keys', selectedTenantId],
    enabled: isAdmin && !!selectedTenantId,
  });

  // Generate API key mutation
  const generateKeyMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest('/api/admin/api-keys', {
        method: 'POST',
        body: JSON.stringify(data),
      });
      return response;
    },
    onSuccess: (data) => {
      setGeneratedKey(data.key);
      toast({
        title: "API Key Generated",
        description: "Save this key now - it will not be shown again!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/api-keys'] });
      setNewKeyName("");
      setSelectedScopes([]);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to generate API key",
        variant: "destructive",
      });
    },
  });

  const handleGenerateKey = () => {
    if (!newKeyName || !selectedTenantId || selectedScopes.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    generateKeyMutation.mutate({
      name: newKeyName,
      tenantId: selectedTenantId,
      scopes: selectedScopes,
      rateLimit: parseInt(selectedRateLimit),
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Copied to clipboard",
    });
  };

  const availableScopes = [
    { value: 'eligibility:read', label: 'Check Eligibility', description: 'Check benefit eligibility' },
    { value: 'documents:write', label: 'Verify Documents', description: 'Upload and verify documents' },
    { value: 'screener:read', label: 'Run Screener', description: 'Quick benefit screening' },
    { value: 'programs:read', label: 'List Programs', description: 'Get benefit programs' },
    { value: 'webhooks:write', label: 'Manage Webhooks', description: 'Register webhooks' },
    { value: '*', label: 'Full Access', description: 'All API endpoints' },
  ];

  const codeExamples = {
    curl: `curl -X POST https://api.mdbenefits.gov/api/v1/eligibility/check \\
  -H "X-API-Key: your_api_key_here" \\
  -H "Content-Type: application/json" \\
  -d '{
    "householdSize": 3,
    "totalIncome": 35000,
    "state": "MD",
    "zipCode": "21201"
  }'`,
    javascript: `const response = await fetch('https://api.mdbenefits.gov/api/v1/eligibility/check', {
  method: 'POST',
  headers: {
    'X-API-Key': 'your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    householdSize: 3,
    totalIncome: 35000,
    state: 'MD',
    zipCode: '21201'
  })
});

const result = await response.json();
console.log(result);`,
    python: `import requests

response = requests.post(
    'https://api.mdbenefits.gov/api/v1/eligibility/check',
    headers={
        'X-API-Key': 'your_api_key_here',
        'Content-Type': 'application/json'
    },
    json={
        'householdSize': 3,
        'totalIncome': 35000,
        'state': 'MD',
        'zipCode': '21201'
    }
)

result = response.json()
print(result)`
  };

  return (
    <div className="container mx-auto py-8 px-4" data-testid="developer-portal">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2" data-testid="text-portal-title">
            Developer Portal
          </h1>
          <p className="text-muted-foreground" data-testid="text-portal-description">
            Integrate Maryland Benefits Platform into your applications
          </p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5" data-testid="tabs-developer-portal">
            <TabsTrigger value="overview" data-testid="tab-overview">
              <BookOpen className="w-4 h-4 mr-2" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="quickstart" data-testid="tab-quickstart">
              <Rocket className="w-4 h-4 mr-2" />
              Quick Start
            </TabsTrigger>
            <TabsTrigger value="docs" data-testid="tab-docs">
              <FileJson className="w-4 h-4 mr-2" />
              API Docs
            </TabsTrigger>
            <TabsTrigger value="examples" data-testid="tab-examples">
              <Code className="w-4 h-4 mr-2" />
              Examples
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="keys" data-testid="tab-keys">
                <Key className="w-4 h-4 mr-2" />
                API Keys
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <Card data-testid="card-api-overview">
              <CardHeader>
                <CardTitle>API Overview</CardTitle>
                <CardDescription>
                  The Maryland Benefits Platform API provides programmatic access to benefit eligibility checking,
                  document verification, and screening services.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Shield className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Secure Authentication</h3>
                      <p className="text-sm text-muted-foreground">
                        API key-based authentication with scope-based permissions
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Rate Limiting</h3>
                      <p className="text-sm text-muted-foreground">
                        1,000-10,000 requests/hour based on your tier
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Globe className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">RESTful API</h3>
                      <p className="text-sm text-muted-foreground">
                        Standard HTTP methods with JSON request/response
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="bg-primary/10 p-2 rounded-lg">
                      <Activity className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">Webhooks</h3>
                      <p className="text-sm text-muted-foreground">
                        Real-time event notifications to your endpoints
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid md:grid-cols-3 gap-4">
              <Card data-testid="card-endpoint-eligibility">
                <CardHeader>
                  <CardTitle className="text-lg">Eligibility API</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Check household eligibility for benefit programs
                  </p>
                  <Badge variant="outline">POST /api/v1/eligibility/check</Badge>
                </CardContent>
              </Card>

              <Card data-testid="card-endpoint-documents">
                <CardHeader>
                  <CardTitle className="text-lg">Documents API</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Verify documents using AI-powered analysis
                  </p>
                  <Badge variant="outline">POST /api/v1/documents/verify</Badge>
                </CardContent>
              </Card>

              <Card data-testid="card-endpoint-screener">
                <CardHeader>
                  <CardTitle className="text-lg">Screener API</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Quick 2-minute benefit screening
                  </p>
                  <Badge variant="outline">POST /api/v1/screener/quick</Badge>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Quick Start Tab */}
          <TabsContent value="quickstart" className="space-y-6">
            <Card data-testid="card-quickstart">
              <CardHeader>
                <CardTitle>Get Started in 3 Steps</CardTitle>
                <CardDescription>
                  Start integrating the Maryland Benefits Platform API in minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-start space-x-4">
                    <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Get an API Key</h3>
                      <p className="text-sm text-muted-foreground">
                        Contact your administrator to generate an API key with the required scopes for your use case.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Make Your First Request</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Include your API key in the X-API-Key header with every request:
                      </p>
                      <div className="bg-muted p-3 rounded-md text-sm font-mono">
                        X-API-Key: your_api_key_here
                      </div>
                    </div>
                  </div>

                  <div className="flex items-start space-x-4">
                    <div className="bg-primary text-primary-foreground rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Explore the API</h3>
                      <p className="text-sm text-muted-foreground mb-2">
                        Use our interactive API documentation to test endpoints:
                      </p>
                      <Button asChild variant="outline" size="sm" data-testid="button-open-swagger">
                        <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Open Swagger UI
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Docs Tab */}
          <TabsContent value="docs" className="space-y-6">
            <Card data-testid="card-api-documentation">
              <CardHeader>
                <CardTitle>Interactive API Documentation</CardTitle>
                <CardDescription>
                  Explore and test API endpoints using Swagger UI
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <h3 className="font-semibold">Swagger UI</h3>
                    <p className="text-sm text-muted-foreground">
                      Interactive API documentation with "Try it out" functionality
                    </p>
                  </div>
                  <Button asChild data-testid="button-view-swagger">
                    <a href="/api/docs" target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="w-4 h-4 mr-2" />
                      View Docs
                    </a>
                  </Button>
                </div>

                <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                  <div>
                    <h3 className="font-semibold">OpenAPI Specification</h3>
                    <p className="text-sm text-muted-foreground">
                      Download the raw OpenAPI 3.0 specification JSON
                    </p>
                  </div>
                  <Button asChild variant="outline" data-testid="button-download-spec">
                    <a href="/api/openapi.json" target="_blank" rel="noopener noreferrer">
                      <FileJson className="w-4 h-4 mr-2" />
                      Download Spec
                    </a>
                  </Button>
                </div>

                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    All API endpoints require authentication via the X-API-Key header. Rate limits apply based on your API key tier.
                  </AlertDescription>
                </Alert>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Examples Tab */}
          <TabsContent value="examples" className="space-y-6">
            <Card data-testid="card-code-examples">
              <CardHeader>
                <CardTitle>Code Examples</CardTitle>
                <CardDescription>
                  Sample code for making API requests in different languages
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="curl">
                  <TabsList className="grid w-full grid-cols-3" data-testid="tabs-code-examples">
                    <TabsTrigger value="curl">cURL</TabsTrigger>
                    <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                    <TabsTrigger value="python">Python</TabsTrigger>
                  </TabsList>

                  <TabsContent value="curl" className="mt-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{codeExamples.curl}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(codeExamples.curl)}
                        data-testid="button-copy-curl"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="javascript" className="mt-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{codeExamples.javascript}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(codeExamples.javascript)}
                        data-testid="button-copy-javascript"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="python" className="mt-4">
                    <div className="relative">
                      <pre className="bg-muted p-4 rounded-lg overflow-x-auto text-sm">
                        <code>{codeExamples.python}</code>
                      </pre>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute top-2 right-2"
                        onClick={() => copyToClipboard(codeExamples.python)}
                        data-testid="button-copy-python"
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Keys Tab (Admin Only) */}
          {isAdmin && (
            <TabsContent value="keys" className="space-y-6">
              <Card data-testid="card-generate-key">
                <CardHeader>
                  <CardTitle>Generate New API Key</CardTitle>
                  <CardDescription>
                    Create API keys for third-party integrations
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {generatedKey && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <Key className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="space-y-2">
                        <p className="font-semibold text-yellow-800">Save this API key now - it will not be shown again!</p>
                        <div className="flex items-center space-x-2">
                          <code className="bg-white px-3 py-1 rounded border flex-1 text-sm" data-testid="text-generated-key">
                            {generatedKey}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyToClipboard(generatedKey)}
                            data-testid="button-copy-key"
                          >
                            <Copy className="w-4 h-4" />
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  )}

                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="tenant-id">Tenant ID *</Label>
                      <Input
                        id="tenant-id"
                        value={selectedTenantId}
                        onChange={(e) => setSelectedTenantId(e.target.value)}
                        placeholder="Enter tenant ID"
                        data-testid="input-tenant-id"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="key-name">Organization Name *</Label>
                      <Input
                        id="key-name"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., Acme Community Services"
                        data-testid="input-key-name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Scopes *</Label>
                      <div className="grid md:grid-cols-2 gap-2">
                        {availableScopes.map((scope) => (
                          <div
                            key={scope.value}
                            className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                              selectedScopes.includes(scope.value)
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-primary/50'
                            }`}
                            onClick={() => {
                              if (selectedScopes.includes(scope.value)) {
                                setSelectedScopes(selectedScopes.filter(s => s !== scope.value));
                              } else {
                                setSelectedScopes([...selectedScopes, scope.value]);
                              }
                            }}
                            data-testid={`scope-${scope.value}`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{scope.label}</p>
                                <p className="text-xs text-muted-foreground">{scope.description}</p>
                              </div>
                              {selectedScopes.includes(scope.value) && (
                                <CheckCircle className="w-5 h-5 text-primary" />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rate-limit">Rate Limit (requests/hour)</Label>
                      <Select value={selectedRateLimit} onValueChange={setSelectedRateLimit}>
                        <SelectTrigger data-testid="select-rate-limit">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1000">1,000 (Standard)</SelectItem>
                          <SelectItem value="5000">5,000 (Premium)</SelectItem>
                          <SelectItem value="10000">10,000 (Enterprise)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      onClick={handleGenerateKey}
                      disabled={generateKeyMutation.isPending}
                      className="w-full"
                      data-testid="button-generate-key"
                    >
                      {generateKeyMutation.isPending ? 'Generating...' : 'Generate API Key'}
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {selectedTenantId && (
                <Card data-testid="card-existing-keys">
                  <CardHeader>
                    <CardTitle>Existing API Keys</CardTitle>
                    <CardDescription>
                      Manage API keys for tenant: {selectedTenantId}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {keysLoading ? (
                      <p className="text-center text-muted-foreground py-4">Loading...</p>
                    ) : apiKeys && apiKeys.length > 0 ? (
                      <div className="space-y-3">
                        {apiKeys.map((key: any) => (
                          <div key={key.id} className="p-4 border rounded-lg" data-testid={`api-key-${key.id}`}>
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className="font-semibold">{key.name}</p>
                                <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                                  <Badge variant={key.status === 'active' ? 'default' : 'secondary'}>
                                    {key.status}
                                  </Badge>
                                  <span>•</span>
                                  <span>{key.rateLimit} req/hr</span>
                                  <span>•</span>
                                  <span>{key.requestCount} total requests</span>
                                </div>
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {(key.scopes as string[]).map((scope: string) => (
                                    <Badge key={scope} variant="outline" className="text-xs">
                                      {scope}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-4">
                        No API keys found for this tenant
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}
