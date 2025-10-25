import { useState } from "react";
import { useQuery } from "@tanstack/react-query";

interface TwilioStatus {
  isConfigured: boolean;
  phoneNumber?: string;
  reason?: string;
}

interface ConversationStats {
  total: number;
  completed: number;
  abandoned: number;
  active: number;
  completionRate: string;
  byType: Record<string, number>;
}

interface Conversation {
  id: string;
  phoneNumber: string;
  sessionType: string;
  state: string;
  createdAt: string;
}
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  MessageSquare, 
  Phone, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  BarChart3,
  Settings,
  MessageCircle,
  TrendingUp
} from "lucide-react";

export default function SmsConfig() {
  const [selectedTenant, setSelectedTenant] = useState<string>("");

  // Fetch Twilio configuration status
  const { data: twilioStatus, isLoading: statusLoading } = useQuery<TwilioStatus>({
    queryKey: ['/api/sms/status'],
  });

  // Fetch conversation statistics
  const { data: conversationStats, isLoading: statsLoading } = useQuery<ConversationStats>({
    queryKey: ['/api/sms/stats', selectedTenant],
  });

  // Fetch SMS conversations
  const { data: conversations, isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: ['/api/sms/conversations'],
  });

  const isConfigured = twilioStatus?.isConfigured;

  return (
    <div className="container mx-auto py-8 space-y-6" data-testid="page-sms-config">
      <div>
        <h1 className="text-3xl font-bold" data-testid="text-page-title">SMS Configuration</h1>
        <p className="text-muted-foreground" data-testid="text-page-description">
          Manage text-based benefit screening and intake via Twilio
        </p>
      </div>

      {/* Twilio Connection Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Twilio Connection Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statusLoading ? (
            <p data-testid="text-status-loading">Loading status...</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {isConfigured ? (
                  <>
                    <CheckCircle2 className="h-6 w-6 text-green-500" data-testid="icon-status-success" />
                    <div>
                      <p className="font-medium" data-testid="text-status-connected">Twilio Connected</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-phone-number">
                        Phone: {twilioStatus?.phoneNumber}
                      </p>
                    </div>
                  </>
                ) : (
                  <>
                    <XCircle className="h-6 w-6 text-red-500" data-testid="icon-status-error" />
                    <div>
                      <p className="font-medium" data-testid="text-status-disconnected">Twilio Not Configured</p>
                      <p className="text-sm text-muted-foreground" data-testid="text-status-reason">
                        {twilioStatus?.reason || "Missing configuration"}
                      </p>
                    </div>
                  </>
                )}
              </div>

              {!isConfigured && (
                <Alert data-testid="alert-configuration-instructions">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-medium mb-2">Configuration Required</p>
                    <p className="text-sm mb-3">Add the following environment variables to enable SMS features:</p>
                    <div className="bg-muted p-3 rounded font-mono text-sm space-y-1">
                      <div>TWILIO_ACCOUNT_SID=your_account_sid</div>
                      <div>TWILIO_AUTH_TOKEN=your_auth_token</div>
                      <div>TWILIO_PHONE_NUMBER=+12345678900</div>
                    </div>
                    <p className="text-sm mt-3">
                      Get these credentials from your{" "}
                      <a 
                        href="https://console.twilio.com" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary underline"
                        data-testid="link-twilio-console"
                      >
                        Twilio Console
                      </a>
                    </p>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {isConfigured && (
        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList data-testid="tabs-sms-management">
            <TabsTrigger value="analytics" data-testid="tab-analytics">
              <BarChart3 className="h-4 w-4 mr-2" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="conversations" data-testid="tab-conversations">
              <MessageCircle className="h-4 w-4 mr-2" />
              Conversations
            </TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card data-testid="card-stat-total">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-stat-total">
                    {conversationStats?.total || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-completed">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-stat-completed">
                    {conversationStats?.completed || 0}
                  </div>
                  <p className="text-xs text-muted-foreground" data-testid="text-stat-completion-rate">
                    {conversationStats?.completionRate || 0}% completion rate
                  </p>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-active">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Active</CardTitle>
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-stat-active">
                    {conversationStats?.active || 0}
                  </div>
                </CardContent>
              </Card>

              <Card data-testid="card-stat-abandoned">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Abandoned</CardTitle>
                  <XCircle className="h-4 w-4 text-red-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold" data-testid="text-stat-abandoned">
                    {conversationStats?.abandoned || 0}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Conversation Types Breakdown */}
            <Card data-testid="card-conversation-types">
              <CardHeader>
                <CardTitle>Conversation Types</CardTitle>
                <CardDescription>Breakdown by session type</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {conversationStats?.byType && Object.entries(conversationStats.byType).map(([type, count]: [string, any]) => (
                    <div key={type} className="flex items-center justify-between" data-testid={`stat-type-${type}`}>
                      <span className="text-sm capitalize">{type.replace('_', ' ')}</span>
                      <Badge variant="secondary" data-testid={`badge-type-count-${type}`}>{count}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Conversations Tab */}
          <TabsContent value="conversations" className="space-y-4">
            <Card data-testid="card-conversations-list">
              <CardHeader>
                <CardTitle>Recent Conversations</CardTitle>
                <CardDescription>View and manage SMS conversations</CardDescription>
              </CardHeader>
              <CardContent>
                {conversationsLoading ? (
                  <p data-testid="text-conversations-loading">Loading conversations...</p>
                ) : conversations && conversations.length > 0 ? (
                  <div className="space-y-4">
                    {conversations.map((conv) => (
                      <div 
                        key={conv.id} 
                        className="border rounded-lg p-4 space-y-2"
                        data-testid={`conversation-${conv.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium" data-testid={`text-phone-${conv.id}`}>
                              {conv.phoneNumber}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`text-type-${conv.id}`}>
                              {conv.sessionType}
                            </p>
                          </div>
                          <Badge 
                            variant={conv.state === 'completed' ? 'default' : 'secondary'}
                            data-testid={`badge-state-${conv.id}`}
                          >
                            {conv.state}
                          </Badge>
                        </div>
                        <div className="text-xs text-muted-foreground" data-testid={`text-date-${conv.id}`}>
                          {new Date(conv.createdAt).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground" data-testid="text-no-conversations">
                    No conversations yet
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card data-testid="card-webhook-settings">
              <CardHeader>
                <CardTitle>Webhook Configuration</CardTitle>
                <CardDescription>Configure Twilio webhooks for your phone number</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">Incoming Message Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="webhook-url"
                      readOnly 
                      value={`${window.location.origin}/api/sms/incoming`}
                      data-testid="input-webhook-incoming"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/sms/incoming`)}
                      data-testid="button-copy-incoming"
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set this as your "A message comes in" webhook in Twilio Console
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status-url">Status Callback URL</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="status-url"
                      readOnly 
                      value={`${window.location.origin}/api/sms/status`}
                      data-testid="input-webhook-status"
                    />
                    <Button 
                      variant="outline" 
                      onClick={() => navigator.clipboard.writeText(`${window.location.origin}/api/sms/status`)}
                      data-testid="button-copy-status"
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Set this as your status callback URL for delivery tracking
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card data-testid="card-keywords">
              <CardHeader>
                <CardTitle>Supported Keywords</CardTitle>
                <CardDescription>Keywords users can text to start conversations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-2 md:grid-cols-2">
                  <div className="border rounded p-3" data-testid="keyword-snap">
                    <p className="font-medium">SNAP, FOOD</p>
                    <p className="text-sm text-muted-foreground">Start benefit screener</p>
                  </div>
                  <div className="border rounded p-3" data-testid="keyword-tax">
                    <p className="font-medium">TAX, VITA</p>
                    <p className="text-sm text-muted-foreground">Tax preparation help</p>
                  </div>
                  <div className="border rounded p-3" data-testid="keyword-help">
                    <p className="font-medium">HELP</p>
                    <p className="text-sm text-muted-foreground">List available options</p>
                  </div>
                  <div className="border rounded p-3" data-testid="keyword-stop">
                    <p className="font-medium">STOP</p>
                    <p className="text-sm text-muted-foreground">Unsubscribe (TCPA required)</p>
                  </div>
                  <div className="border rounded p-3" data-testid="keyword-start">
                    <p className="font-medium">START</p>
                    <p className="text-sm text-muted-foreground">Re-subscribe</p>
                  </div>
                  <div className="border rounded p-3" data-testid="keyword-reset">
                    <p className="font-medium">RESET, RESTART</p>
                    <p className="text-sm text-muted-foreground">Start new conversation</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
