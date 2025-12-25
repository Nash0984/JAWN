import { useState } from 'react';
import { API_ENDPOINTS, API_CATEGORIES } from '@shared/apiEndpoints';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Code, Search, Lock, Zap, BookOpen, Filter, Copy, Check } from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useToast } from '@/hooks/use-toast';
import { generateCodeSnippets } from '@/lib/codeSnippets';
import { useTenant } from '@/contexts/TenantContext';

export default function APIExplorer() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [copiedSnippet, setCopiedSnippet] = useState<string | null>(null);
  const { toast } = useToast();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';

  // Filter endpoints based on search and category
  const filteredEndpoints = API_ENDPOINTS.filter(endpoint => {
    const matchesSearch = searchQuery === '' || 
      endpoint.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      endpoint.category.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === null || endpoint.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Count endpoints by method
  const methodCounts = {
    GET: API_ENDPOINTS.filter(e => e.method === 'GET').length,
    POST: API_ENDPOINTS.filter(e => e.method === 'POST').length,
    PUT: API_ENDPOINTS.filter(e => e.method === 'PUT').length,
    PATCH: API_ENDPOINTS.filter(e => e.method === 'PATCH').length,
    DELETE: API_ENDPOINTS.filter(e => e.method === 'DELETE').length,
  };

  // Get method badge color
  const getMethodBadgeVariant = (method: string) => {
    switch (method) {
      case 'GET':
        return 'default';
      case 'POST':
        return 'secondary';
      case 'PUT':
      case 'PATCH':
        return 'outline';
      case 'DELETE':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  // Copy code snippet to clipboard
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
        <title>API Explorer - {stateName} Universal Benefits-Tax Navigator</title>
        <meta name="description" content="Interactive API documentation with 218 endpoints covering benefits, tax, AI, and more" />
      </Helmet>

      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Code className="h-10 w-10 text-primary" />
            </div>
            <div>
              <h1 className="text-4xl font-bold" data-testid="heading-api-explorer">
                API Explorer
              </h1>
              <p className="text-lg text-muted-foreground">
                Interactive documentation for all {API_ENDPOINTS.length} API endpoints
              </p>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card className="p-4" data-testid="card-stat-total">
            <div className="text-3xl font-bold text-primary">{API_ENDPOINTS.length}</div>
            <div className="text-sm text-muted-foreground">Total Endpoints</div>
          </Card>
          <Card className="p-4" data-testid="card-stat-categories">
            <div className="text-3xl font-bold text-primary">{API_CATEGORIES.length}</div>
            <div className="text-sm text-muted-foreground">Categories</div>
          </Card>
          <Card className="p-4" data-testid="card-stat-get">
            <div className="text-3xl font-bold text-blue-600">{methodCounts.GET}</div>
            <div className="text-sm text-muted-foreground">GET</div>
          </Card>
          <Card className="p-4" data-testid="card-stat-post">
            <div className="text-3xl font-bold text-green-600">{methodCounts.POST}</div>
            <div className="text-sm text-muted-foreground">POST</div>
          </Card>
          <Card className="p-4" data-testid="card-stat-auth">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-green-500" />
              <div className="text-2xl font-bold">OAuth</div>
            </div>
            <div className="text-sm text-muted-foreground">Authentication</div>
          </Card>
          <Card className="p-4" data-testid="card-stat-rest">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <div className="text-2xl font-bold">REST</div>
            </div>
            <div className="text-sm text-muted-foreground">Architecture</div>
          </Card>
        </div>

        {/* Search and Filter */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                data-testid="input-api-search"
                placeholder="Search endpoints by path, description, or category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <select
                data-testid="select-category-filter"
                value={selectedCategory || 'all'}
                onChange={(e) => setSelectedCategory(e.target.value === 'all' ? null : e.target.value)}
                className="px-4 py-2 rounded-md border bg-background min-w-[200px]"
              >
                <option value="all">All Categories</option>
                {API_CATEGORIES.map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>
          </div>
          
          {/* Results count */}
          <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <BookOpen className="h-4 w-4" />
            <span data-testid="text-results-count">
              Showing {filteredEndpoints.length} of {API_ENDPOINTS.length} endpoints
            </span>
          </div>
        </Card>

        {/* Endpoints List */}
        <ScrollArea className="h-[800px] pr-4">
          <div className="space-y-3">
            {filteredEndpoints.length === 0 ? (
              <Card className="p-8 text-center">
                <p className="text-muted-foreground" data-testid="text-no-results">
                  No endpoints found matching your search criteria.
                </p>
              </Card>
            ) : (
              filteredEndpoints.map(endpoint => (
                <Card 
                  key={endpoint.id} 
                  className="p-5 hover:shadow-lg transition-all hover:border-primary/50" 
                  data-testid={`endpoint-card-${endpoint.id}`}
                >
                  <div className="space-y-4">
                    {/* Method, Path, and Auth */}
                    <div className="flex items-center gap-3 flex-wrap">
                      <Badge 
                        variant={getMethodBadgeVariant(endpoint.method)}
                        className="font-mono font-semibold min-w-[70px] justify-center"
                        data-testid={`badge-method-${endpoint.id}`}
                      >
                        {endpoint.method}
                      </Badge>
                      <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded flex-1" data-testid={`code-path-${endpoint.id}`}>
                        {endpoint.path}
                      </code>
                      {endpoint.requiresAuth && (
                        <Badge 
                          variant="outline" 
                          className="flex items-center gap-1 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400" 
                          data-testid={`badge-auth-${endpoint.id}`}
                        >
                          <Lock className="h-3 w-3" />
                          Auth Required
                        </Badge>
                      )}
                    </div>

                    {/* Description */}
                    <p className="text-sm leading-relaxed" data-testid={`text-description-${endpoint.id}`}>
                      {endpoint.description}
                    </p>

                    {/* Category and Roles */}
                    <div className="flex gap-2 flex-wrap items-center">
                      <Badge 
                        variant="secondary" 
                        className="bg-primary/10 text-primary border-primary/20"
                        data-testid={`badge-category-${endpoint.id}`}
                      >
                        {endpoint.category}
                      </Badge>
                      {endpoint.requiredRole && endpoint.requiredRole.map(role => (
                        <Badge 
                          key={role} 
                          variant="outline" 
                          className="bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400"
                          data-testid={`badge-role-${endpoint.id}-${role}`}
                        >
                          Role: {role}
                        </Badge>
                      ))}
                    </div>

                    {/* Query Parameters */}
                    {endpoint.queryParams && endpoint.queryParams.length > 0 && (
                      <div className="space-y-2">
                        <div className="text-sm font-semibold">Query Parameters:</div>
                        <div className="space-y-1">
                          {endpoint.queryParams.map((param, idx) => (
                            <div 
                              key={idx} 
                              className="text-xs bg-muted/50 p-2 rounded"
                              data-testid={`param-${endpoint.id}-${param.name}`}
                            >
                              <code className="font-mono font-semibold">{param.name}</code>
                              <span className="text-muted-foreground"> ({param.type})</span>
                              {param.required && (
                                <Badge variant="destructive" className="ml-2 h-4 text-[10px]">required</Badge>
                              )}
                              <p className="mt-1 text-muted-foreground">{param.description}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Code Snippets & Examples */}
                    <Tabs defaultValue="snippets" className="mt-3">
                      <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${1 + (endpoint.requestBody ? 1 : 0) + (endpoint.responseExample ? 1 : 0)}, 1fr)` }}>
                        <TabsTrigger value="snippets" data-testid={`tab-snippets-${endpoint.id}`}>
                          Code Examples
                        </TabsTrigger>
                        {endpoint.requestBody && (
                          <TabsTrigger value="request" data-testid={`tab-request-${endpoint.id}`}>
                            Request Body
                          </TabsTrigger>
                        )}
                        {endpoint.responseExample && (
                          <TabsTrigger value="response" data-testid={`tab-response-${endpoint.id}`}>
                            Response
                          </TabsTrigger>
                        )}
                      </TabsList>
                      
                      {/* Code Snippets Tab */}
                      <TabsContent value="snippets" data-testid={`content-snippets-${endpoint.id}`}>
                        <Tabs defaultValue="curl" className="w-full">
                          <TabsList className="grid w-full max-w-md grid-cols-3">
                            <TabsTrigger value="curl">cURL</TabsTrigger>
                            <TabsTrigger value="javascript">JavaScript</TabsTrigger>
                            <TabsTrigger value="python">Python</TabsTrigger>
                          </TabsList>
                          {generateCodeSnippets(endpoint).map((snippet) => (
                            <TabsContent key={snippet.language} value={snippet.language}>
                              <div className="relative group">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                                  onClick={() => copyToClipboard(snippet.code, `${endpoint.id}-${snippet.language}`)}
                                  data-testid={`btn-copy-${endpoint.id}-${snippet.language}`}
                                >
                                  {copiedSnippet === `${endpoint.id}-${snippet.language}` ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <Copy className="h-4 w-4" />
                                  )}
                                </Button>
                                <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto border border-slate-700">
                                  <code>{snippet.code}</code>
                                </pre>
                              </div>
                            </TabsContent>
                          ))}
                        </Tabs>
                      </TabsContent>
                      
                      {/* Request Body Tab */}
                      {endpoint.requestBody && (
                        <TabsContent value="request" data-testid={`content-request-${endpoint.id}`}>
                          <div className="relative group">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => copyToClipboard(JSON.stringify(endpoint.requestBody, null, 2), `${endpoint.id}-request`)}
                              data-testid={`btn-copy-${endpoint.id}-request`}
                            >
                              {copiedSnippet === `${endpoint.id}-request` ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto border border-slate-700">
                              <code>{JSON.stringify(endpoint.requestBody, null, 2)}</code>
                            </pre>
                          </div>
                        </TabsContent>
                      )}
                      
                      {/* Response Example Tab */}
                      {endpoint.responseExample && (
                        <TabsContent value="response" data-testid={`content-response-${endpoint.id}`}>
                          <div className="relative group">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="absolute right-2 top-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => copyToClipboard(JSON.stringify(endpoint.responseExample, null, 2), `${endpoint.id}-response`)}
                              data-testid={`btn-copy-${endpoint.id}-response`}
                            >
                              {copiedSnippet === `${endpoint.id}-response` ? (
                                <Check className="h-4 w-4 text-green-500" />
                              ) : (
                                <Copy className="h-4 w-4" />
                              )}
                            </Button>
                            <pre className="text-xs font-mono bg-slate-900 dark:bg-slate-950 text-slate-100 p-4 rounded-lg overflow-x-auto border border-slate-700">
                              <code>{JSON.stringify(endpoint.responseExample, null, 2)}</code>
                            </pre>
                          </div>
                        </TabsContent>
                      )}
                    </Tabs>
                  </div>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Category Summary */}
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-4">API Categories Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {API_CATEGORIES.map(category => {
              const count = API_ENDPOINTS.filter(e => e.category === category).length;
              return (
                <button
                  key={category}
                  onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                  className={`p-4 rounded-lg border-2 transition-all text-left hover:shadow-md ${
                    selectedCategory === category 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  data-testid={`category-btn-${category.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <div className="font-semibold">{category}</div>
                  <div className="text-sm text-muted-foreground mt-1">{count} endpoint{count !== 1 ? 's' : ''}</div>
                </button>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}
