import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Code, 
  Book, 
  Key, 
  Zap, 
  Terminal, 
  CheckCircle2, 
  ArrowRight,
  ExternalLink,
  Copy,
  Check,
  AlertCircle,
  Shield
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'wouter';

const API_BASE_URL = import.meta.env.VITE_API_URL || window.location.origin;

export default function Developers() {
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const { toast } = useToast();

  const copyToClipboard = async (code: string, snippetId: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSnippet(snippetId);
      toast({
        title: "Copied!",
        description: "Code snippet copied to clipboard",
      });
      setTimeout(() => setCopiedSnippet(null), 2000);
    } catch (err) {
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive",
      });
    }
  };

  return (
    <>
      <Helmet>
        <title>Developer Guide - Universal Benefits-Tax Navigator</title>
        <meta name="description" content="Complete developer guide for integrating with the JAWN API platform" />
      </Helmet>

      <div className="container mx-auto p-6 space-y-8 max-w-7xl">
        {/* Hero Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Terminal className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold" data-testid="heading-developers">
                Developer Guide
              </h1>
              <p className="text-lg text-muted-foreground">
                Build powerful integrations with the Benefits-Tax Navigator API
              </p>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/api-explorer">
            <Card className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50" data-testid="card-api-explorer">
              <CardHeader>
                <Code className="h-8 w-8 text-primary mb-2" />
                <CardTitle>API Explorer</CardTitle>
                <CardDescription>
                  Browse all 218 API endpoints with interactive examples
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          
          <Card data-testid="card-authentication">
            <CardHeader>
              <Shield className="h-8 w-8 text-green-600 mb-2" />
              <CardTitle>Authentication</CardTitle>
              <CardDescription>
                Secure OAuth-based authentication flow
              </CardDescription>
            </CardHeader>
          </Card>
          
          <Card data-testid="card-sandbox">
            <CardHeader>
              <Zap className="h-8 w-8 text-yellow-600 mb-2" />
              <CardTitle>Sandbox</CardTitle>
              <CardDescription>
                Test your integration in a safe environment
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="quickstart" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="quickstart" data-testid="tab-quickstart">
              <Zap className="h-4 w-4 mr-2" />
              Quick Start
            </TabsTrigger>
            <TabsTrigger value="auth" data-testid="tab-auth">
              <Key className="h-4 w-4 mr-2" />
              Authentication
            </TabsTrigger>
            <TabsTrigger value="versioning" data-testid="tab-versioning">
              <Code className="h-4 w-4 mr-2" />
              API Versioning
            </TabsTrigger>
            <TabsTrigger value="best-practices" data-testid="tab-best-practices">
              <Book className="h-4 w-4 mr-2" />
              Best Practices
            </TabsTrigger>
          </TabsList>

          {/* Quick Start Tab */}
          <TabsContent value="quickstart" className="space-y-6">
            <Card data-testid="content-quickstart">
              <CardHeader>
                <CardTitle>Getting Started in 5 Minutes</CardTitle>
                <CardDescription>
                  Follow these steps to make your first API call
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Step 1 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      1
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-semibold">Create an Account</h3>
                    <p className="text-muted-foreground">
                      Sign up for a developer account to get API credentials. In development, use the demo account.
                    </p>
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Demo credentials: <code className="bg-muted px-2 py-1 rounded">demo.developer@example.com</code> / <code className="bg-muted px-2 py-1 rounded">password123</code>
                      </AlertDescription>
                    </Alert>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      2
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-semibold">Make Your First Request</h3>
                    <p className="text-muted-foreground">
                      Test the API with a simple health check endpoint
                    </p>
                    <div className="relative group">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(`curl ${API_BASE_URL}/api/health`, 'health-check')}
                        data-testid="btn-copy-health-check"
                      >
                        {copiedSnippet === 'health-check' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">
                        <code>{`curl ${API_BASE_URL}/api/health`}</code>
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      3
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-semibold">Explore the API</h3>
                    <p className="text-muted-foreground">
                      Browse all available endpoints in the API Explorer
                    </p>
                    <Link href="/api-explorer">
                      <Button className="gap-2" data-testid="btn-explore-api">
                        Open API Explorer
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center font-bold">
                      4
                    </div>
                  </div>
                  <div className="flex-1 space-y-2">
                    <h3 className="text-lg font-semibold">Start Building</h3>
                    <p className="text-muted-foreground">
                      Use our SDKs or REST API directly. All endpoints return JSON.
                    </p>
                    <div className="flex gap-2">
                      <Badge variant="outline">REST API</Badge>
                      <Badge variant="outline">JSON Responses</Badge>
                      <Badge variant="outline">OAuth 2.0</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Authentication Tab */}
          <TabsContent value="auth" className="space-y-6">
            <Card data-testid="content-auth">
              <CardHeader>
                <CardTitle>Authentication Flow</CardTitle>
                <CardDescription>
                  Secure your API requests with session-based authentication
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Session-Based Authentication</h3>
                  <p className="text-muted-foreground">
                    The API uses secure session cookies for authentication. Follow these steps to authenticate:
                  </p>

                  <div className="space-y-4">
                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-2">1. Login</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Send your credentials to the login endpoint
                      </p>
                      <div className="relative group">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(`curl -X POST ${API_BASE_URL}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "demo.developer@example.com",
    "password": "password123"
  }' \\
  -c cookies.txt`, 'login')}
                          data-testid="btn-copy-login"
                        >
                          {copiedSnippet === 'login' ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">
                          <code>{`curl -X POST ${API_BASE_URL}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "username": "demo.developer@example.com",
    "password": "password123"
  }' \\
  -c cookies.txt`}</code>
                        </pre>
                      </div>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-2">2. Get CSRF Token</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Retrieve a CSRF token for state-changing requests
                      </p>
                      <div className="relative group">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(`curl ${API_BASE_URL}/api/csrf-token \\
  -b cookies.txt`, 'csrf')}
                          data-testid="btn-copy-csrf"
                        >
                          {copiedSnippet === 'csrf' ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">
                          <code>{`curl ${API_BASE_URL}/api/csrf-token \\
  -b cookies.txt`}</code>
                        </pre>
                      </div>
                    </div>

                    <div className="border-l-4 border-primary pl-4">
                      <h4 className="font-semibold mb-2">3. Make Authenticated Requests</h4>
                      <p className="text-sm text-muted-foreground mb-3">
                        Include session cookie and CSRF token in your requests
                      </p>
                      <div className="relative group">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => copyToClipboard(`curl -X POST ${API_BASE_URL}/api/benefits/calculate \\
  -H "Content-Type: application/json" \\
  -H "x-csrf-token: YOUR_CSRF_TOKEN" \\
  -b cookies.txt \\
  -d '{"householdSize": 2, "income": 30000}'`, 'authenticated')}
                          data-testid="btn-copy-authenticated"
                        >
                          {copiedSnippet === 'authenticated' ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                        <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto">
                          <code>{`curl -X POST ${API_BASE_URL}/api/benefits/calculate \\
  -H "Content-Type: application/json" \\
  -H "x-csrf-token: YOUR_CSRF_TOKEN" \\
  -b cookies.txt \\
  -d '{"householdSize": 2, "income": 30000}'`}</code>
                        </pre>
                      </div>
                    </div>
                  </div>

                  <Alert className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                    <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                    <AlertDescription className="text-yellow-700 dark:text-yellow-400">
                      <strong>Security Note:</strong> Always use HTTPS in production. Session cookies are HTTP-only and secure in production mode.
                    </AlertDescription>
                  </Alert>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* API Versioning Tab */}
          <TabsContent value="versioning" className="space-y-6">
            <Card data-testid="content-versioning">
              <CardHeader>
                <CardTitle>API Versioning</CardTitle>
                <CardDescription>
                  Manage API versions and handle deprecation gracefully
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Current Version: v1</h3>
                    <p className="text-muted-foreground">
                      The API supports version-specific requests to ensure backward compatibility. You can specify the version in three ways:
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardHeader>
                        <Code className="h-6 w-6 text-primary mb-2" />
                        <CardTitle className="text-base">URL Path</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <code className="text-sm bg-muted px-2 py-1 rounded block">
                          /api/v1/benefits
                        </code>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <Key className="h-6 w-6 text-primary mb-2" />
                        <CardTitle className="text-base">Accept-Version Header</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <code className="text-sm bg-muted px-2 py-1 rounded block">
                          Accept-Version: v1
                        </code>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <Shield className="h-6 w-6 text-primary mb-2" />
                        <CardTitle className="text-base">X-API-Version Header</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <code className="text-sm bg-muted px-2 py-1 rounded block">
                          X-API-Version: v1
                        </code>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="border-l-4 border-yellow-500 pl-4 py-2">
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                      <AlertCircle className="h-5 w-5 text-yellow-600" />
                      Deprecation Notices
                    </h4>
                    <p className="text-sm text-muted-foreground">
                      When an API version is deprecated, you'll receive warning headers in the response:
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-2 space-y-1">
                      <li><code className="bg-muted px-1 rounded">Warning: 299 - "API version vX is deprecated..."</code></li>
                      <li><code className="bg-muted px-1 rounded">X-API-Deprecated: true</code></li>
                      <li><code className="bg-muted px-1 rounded">X-API-Sunset-Date: YYYY-MM-DD</code></li>
                    </ul>
                  </div>

                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                    <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
                      <CheckCircle2 className="h-5 w-5" />
                      Best Practices
                    </h4>
                    <ul className="list-disc list-inside text-sm text-green-700 dark:text-green-400 space-y-1">
                      <li>Always specify the API version explicitly in production code</li>
                      <li>Monitor deprecation warnings and plan migrations early</li>
                      <li>Test new versions in sandbox before migrating</li>
                      <li>Subscribe to API changelog notifications</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Best Practices Tab */}
          <TabsContent value="best-practices" className="space-y-6">
            <Card data-testid="content-best-practices">
              <CardHeader>
                <CardTitle>API Best Practices</CardTitle>
                <CardDescription>
                  Build reliable and efficient integrations
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Zap className="h-5 w-5 text-yellow-600" />
                      Rate Limiting
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Respect rate limits to ensure fair usage:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• Standard users: 100 req/min</li>
                      <li>• Authenticated: 300 req/min</li>
                      <li>• Admin: 1000 req/min</li>
                    </ul>
                    <Alert>
                      <AlertDescription className="text-xs">
                        Check <code className="bg-muted px-1 rounded">X-RateLimit-Remaining</code> header
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Shield className="h-5 w-5 text-green-600" />
                      Error Handling
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Handle errors gracefully:
                    </p>
                    <ul className="text-sm text-muted-foreground space-y-1">
                      <li>• 4xx: Client errors (check request)</li>
                      <li>• 5xx: Server errors (retry with backoff)</li>
                      <li>• 429: Rate limit exceeded (wait)</li>
                    </ul>
                    <Alert>
                      <AlertDescription className="text-xs">
                        All errors return JSON with <code className="bg-muted px-1 rounded">error</code> and <code className="bg-muted px-1 rounded">message</code>
                      </AlertDescription>
                    </Alert>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-blue-600" />
                      Idempotency
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Use idempotency keys for safe retries on POST/PUT requests.
                    </p>
                    <div className="relative group">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(`Idempotency-Key: uuid-here`, 'idempotency')}
                      >
                        {copiedSnippet === 'idempotency' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-100 p-3 rounded-lg">
                        <code>Idempotency-Key: uuid-here</code>
                      </pre>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold flex items-center gap-2">
                      <Code className="h-5 w-5 text-purple-600" />
                      Pagination
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Use pagination for large datasets:
                    </p>
                    <div className="relative group">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(`?page=1&limit=50`, 'pagination')}
                      >
                        {copiedSnippet === 'pagination' ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="text-xs bg-slate-900 dark:bg-slate-950 text-slate-100 p-3 rounded-lg">
                        <code>?page=1&limit=50</code>
                      </pre>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Resources Section */}
        <Card>
          <CardHeader>
            <CardTitle>Additional Resources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Link href="/api-explorer">
                <Button variant="outline" className="w-full justify-between" data-testid="btn-api-reference">
                  API Reference
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </Link>
              
              <Button variant="outline" className="w-full justify-between" disabled data-testid="btn-changelog">
                Changelog
                <ExternalLink className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" className="w-full justify-between" disabled data-testid="btn-status">
                System Status
                <ExternalLink className="h-4 w-4" />
              </Button>
              
              <Button variant="outline" className="w-full justify-between" disabled data-testid="btn-support">
                Developer Support
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
