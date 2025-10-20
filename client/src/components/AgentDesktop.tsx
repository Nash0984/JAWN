/**
 * Agent Desktop Interface
 * Comprehensive call control and monitoring interface for agents
 */

import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useWebSocket } from "@/hooks/useWebSocket";
import {
  Phone, PhoneCall, PhoneOff, PhoneMissed,
  PhoneForwarded, PhoneIncoming, PhoneOutgoing,
  Mic, MicOff, Volume2, VolumeX,
  Play, Pause, Square, Clock,
  Users, User, UserCheck, UserX,
  MessageSquare, Info, AlertCircle,
  ArrowRight, ArrowUpDown, MoreVertical,
  CheckCircle, XCircle, Timer
} from "lucide-react";

interface CallStatus {
  callId: string;
  status: "queued" | "ringing" | "in-progress" | "completed" | "failed" | "busy" | "no-answer";
  duration?: number;
  talkTime?: number;
  holdTime?: number;
  position?: number;
  estimatedWaitTime?: number;
}

interface AgentStats {
  currentStatus: string;
  callsHandledToday: number;
  totalTalkTimeToday: number;
  averageHandleTime: number;
  currentCallId?: string;
}

interface QueueMetrics {
  queueId: string;
  queueName: string;
  waitingCalls: number;
  availableAgents: number;
  averageWaitTime: number;
  longestWaitTime: number;
}

export function AgentDesktop() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedQueueId, setSelectedQueueId] = useState<string>("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [transferTarget, setTransferTarget] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [currentCall, setCurrentCall] = useState<CallStatus | null>(null);
  const [agentStatus, setAgentStatus] = useState<"available" | "busy" | "break" | "offline">("offline");
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [dialPadVisible, setDialPadVisible] = useState(false);

  // WebSocket for real-time updates
  const { connected, subscribe } = useWebSocket("/ws/notifications");

  // Subscribe to real-time call events
  useEffect(() => {
    if (!connected) return;

    const unsubscribeCallStatus = subscribe("call_status_changed", (data: any) => {
      if (data.callId === currentCall?.callId) {
        setCurrentCall(prev => ({ ...prev!, ...data }));
      }
      queryClient.invalidateQueries({ queryKey: ["/api/phone/call/status"] });
    });

    const unsubscribeNewCall = subscribe("new_incoming_call", (data: any) => {
      toast({
        title: "Incoming Call",
        description: `Call from ${data.fromNumber}`,
        action: (
          <Button size="sm" onClick={() => handleAnswer(data.callId)}>
            Answer
          </Button>
        ),
      });
    });

    const unsubscribeQueueUpdate = subscribe("queue_status_update", () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone/queue/status"] });
    });

    return () => {
      unsubscribeCallStatus();
      unsubscribeNewCall();
      unsubscribeQueueUpdate();
    };
  }, [connected, currentCall?.callId, subscribe, toast, queryClient]);

  // Query agent stats
  const { data: agentStats } = useQuery<AgentStats>({
    queryKey: ["/api/phone/agent/stats"],
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Query queue metrics
  const { data: queueMetrics } = useQuery<{ success: boolean; data: QueueMetrics[] }>({
    queryKey: ["/api/phone/queue/status"],
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  // Query current call status
  const { data: callStatusData } = useQuery<CallStatus>({
    queryKey: ["/api/phone/call/status", currentCall?.callId],
    enabled: !!currentCall?.callId,
    refetchInterval: 1000, // Refresh every second while on call
  });

  // Mutations
  const initiateMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/phone/call/initiate", "POST", data),
    onSuccess: (data) => {
      setCurrentCall(data.data);
      toast({ title: "Call initiated", description: `Calling ${phoneNumber}` });
      setPhoneNumber("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Call failed", 
        description: error.response?.data?.error || "Failed to initiate call",
        variant: "destructive"
      });
    },
  });

  const transferMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/phone/call/transfer", "POST", data),
    onSuccess: () => {
      toast({ title: "Call transferred successfully" });
      setTransferTarget("");
    },
    onError: (error: any) => {
      toast({ 
        title: "Transfer failed", 
        description: error.response?.data?.error || "Failed to transfer call",
        variant: "destructive"
      });
    },
  });

  const holdMutation = useMutation({
    mutationFn: (callId: string) => apiRequest("/api/phone/call/hold", "POST", { callId }),
    onSuccess: () => {
      setIsOnHold(true);
      toast({ title: "Call placed on hold" });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (callId: string) => apiRequest("/api/phone/call/resume", "POST", { callId }),
    onSuccess: () => {
      setIsOnHold(false);
      toast({ title: "Call resumed" });
    },
  });

  const endCallMutation = useMutation({
    mutationFn: (callId: string) => apiRequest("/api/phone/call/end", "POST", { callId }),
    onSuccess: () => {
      setCurrentCall(null);
      setIsOnHold(false);
      setIsRecording(false);
      toast({ title: "Call ended" });
    },
  });

  const updateAgentStatusMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/phone/agent/status", "POST", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/phone/agent/stats"] });
      toast({ title: "Status updated" });
    },
  });

  const recordingMutation = useMutation({
    mutationFn: (data: any) => apiRequest("/api/phone/recording/start", "POST", data),
    onSuccess: (_, variables) => {
      setIsRecording(variables.consentGiven);
      toast({ 
        title: variables.consentGiven ? "Recording started" : "Recording stopped",
        description: variables.consentGiven ? "Call is being recorded" : "Recording has stopped"
      });
    },
  });

  // Handlers
  const handleInitiateCall = () => {
    if (!phoneNumber) {
      toast({ title: "Enter a phone number", variant: "destructive" });
      return;
    }
    initiateMutation.mutate({ to: phoneNumber });
  };

  const handleAnswer = (callId: string) => {
    // Answer incoming call logic
    setCurrentCall({ callId, status: "in-progress" });
  };

  const handleTransfer = (type: "blind" | "attended") => {
    if (!currentCall?.callId || !transferTarget) {
      toast({ title: "Enter transfer target", variant: "destructive" });
      return;
    }
    transferMutation.mutate({
      callId: currentCall.callId,
      targetExtension: transferTarget,
      transferType: type,
    });
  };

  const handleHoldToggle = () => {
    if (!currentCall?.callId) return;
    
    if (isOnHold) {
      resumeMutation.mutate(currentCall.callId);
    } else {
      holdMutation.mutate(currentCall.callId);
    }
  };

  const handleEndCall = () => {
    if (!currentCall?.callId) return;
    endCallMutation.mutate(currentCall.callId);
  };

  const handleRecordToggle = () => {
    if (!currentCall?.callId) return;
    
    recordingMutation.mutate({
      callId: currentCall.callId,
      consentGiven: !isRecording,
      consentType: "verbal",
      stateCode: "MD", // Get from user context
    });
  };

  const handleAgentStatusChange = (status: string) => {
    setAgentStatus(status as any);
    updateAgentStatusMutation.mutate({ 
      status,
      assignedQueues: selectedQueueId ? [selectedQueueId] : []
    });
  };

  const handleDialPadKey = (key: string) => {
    setPhoneNumber(prev => prev + key);
    if (currentCall?.callId) {
      // Send DTMF if on active call
      apiRequest("/api/phone/call/dtmf", "POST", { 
        callId: currentCall.callId, 
        digits: key 
      });
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex h-full">
      {/* Main Call Control Panel */}
      <div className="flex-1 p-6 space-y-6">
        {/* Agent Status Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  <span className="font-medium">Agent Status:</span>
                  <Select value={agentStatus} onValueChange={handleAgentStatusChange}>
                    <SelectTrigger className="w-32" data-testid="select-agent-status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">Available</SelectItem>
                      <SelectItem value="busy">Busy</SelectItem>
                      <SelectItem value="break">On Break</SelectItem>
                      <SelectItem value="offline">Offline</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex items-center gap-2">
                  <PhoneCall className="h-5 w-5" />
                  <span className="text-sm text-muted-foreground">
                    Calls Today: {agentStats?.callsHandledToday || 0}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  <span className="text-sm text-muted-foreground">
                    Avg Handle Time: {formatDuration(agentStats?.averageHandleTime || 0)}
                  </span>
                </div>
              </div>
              <Badge variant={connected ? "default" : "destructive"}>
                {connected ? "Connected" : "Disconnected"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Active Call Panel */}
        <Card>
          <CardHeader>
            <CardTitle>Call Control</CardTitle>
            <CardDescription>
              {currentCall 
                ? `Active Call - ${currentCall.status}` 
                : "No active call"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentCall ? (
              <>
                {/* Call Info */}
                <div className="bg-secondary p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Call ID:</span>
                    <span className="text-sm font-mono">{currentCall.callId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm font-medium">Duration:</span>
                    <span className="text-sm">{formatDuration(currentCall.duration || 0)}</span>
                  </div>
                  {currentCall.holdTime && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Hold Time:</span>
                      <span className="text-sm">{formatDuration(currentCall.holdTime)}</span>
                    </div>
                  )}
                  {currentCall.position && (
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Queue Position:</span>
                      <span className="text-sm">#{currentCall.position}</span>
                    </div>
                  )}
                </div>

                {/* Call Controls */}
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={isOnHold ? "default" : "outline"}
                    size="sm"
                    onClick={handleHoldToggle}
                    disabled={holdMutation.isPending || resumeMutation.isPending}
                    data-testid="button-hold"
                  >
                    {isOnHold ? <Play className="h-4 w-4 mr-2" /> : <Pause className="h-4 w-4 mr-2" />}
                    {isOnHold ? "Resume" : "Hold"}
                  </Button>
                  
                  <Button
                    variant={isMuted ? "default" : "outline"}
                    size="sm"
                    onClick={() => setIsMuted(!isMuted)}
                    data-testid="button-mute"
                  >
                    {isMuted ? <MicOff className="h-4 w-4 mr-2" /> : <Mic className="h-4 w-4 mr-2" />}
                    {isMuted ? "Unmute" : "Mute"}
                  </Button>
                  
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={handleRecordToggle}
                    disabled={recordingMutation.isPending}
                    data-testid="button-record"
                  >
                    <Square className="h-4 w-4 mr-2" />
                    {isRecording ? "Stop Rec" : "Record"}
                  </Button>
                </div>

                {/* Transfer Panel */}
                <div className="space-y-2">
                  <Label>Transfer Call</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Extension or phone number"
                      value={transferTarget}
                      onChange={(e) => setTransferTarget(e.target.value)}
                      data-testid="input-transfer-target"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleTransfer("blind")}
                      disabled={transferMutation.isPending}
                      data-testid="button-blind-transfer"
                    >
                      Blind
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleTransfer("attended")}
                      disabled={transferMutation.isPending}
                      data-testid="button-attended-transfer"
                    >
                      Attended
                    </Button>
                  </div>
                </div>

                {/* End Call */}
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleEndCall}
                  disabled={endCallMutation.isPending}
                  data-testid="button-end-call"
                >
                  <PhoneOff className="h-4 w-4 mr-2" />
                  End Call
                </Button>
              </>
            ) : (
              <>
                {/* Dial Pad */}
                <div className="space-y-2">
                  <Label>Make a Call</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Enter phone number"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleInitiateCall()}
                      data-testid="input-phone-number"
                    />
                    <Button
                      onClick={handleInitiateCall}
                      disabled={initiateMutation.isPending}
                      data-testid="button-dial"
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Call
                    </Button>
                  </div>
                </div>

                {/* Quick Dial Pad */}
                {dialPadVisible && (
                  <div className="grid grid-cols-3 gap-2">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "0", "#"].map((key) => (
                      <Button
                        key={key}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDialPadKey(key)}
                        data-testid={`button-dialpad-${key}`}
                      >
                        {key}
                      </Button>
                    ))}
                  </div>
                )}
                
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialPadVisible(!dialPadVisible)}
                  data-testid="button-toggle-dialpad"
                >
                  {dialPadVisible ? "Hide" : "Show"} Dial Pad
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Queue Monitoring */}
        <Card>
          <CardHeader>
            <CardTitle>Call Queue Status</CardTitle>
          </CardHeader>
          <CardContent>
            {queueMetrics?.data && queueMetrics.data.length > 0 ? (
              <div className="space-y-3">
                {queueMetrics.data.map((queue) => (
                  <div key={queue.queueId} className="border rounded-lg p-3">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-medium">{queue.queueName}</span>
                      <Badge variant={queue.waitingCalls > 5 ? "destructive" : "default"}>
                        {queue.waitingCalls} waiting
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-sm text-muted-foreground">
                      <div>
                        <Users className="h-4 w-4 inline mr-1" />
                        {queue.availableAgents} agents
                      </div>
                      <div>
                        <Clock className="h-4 w-4 inline mr-1" />
                        Avg: {formatDuration(queue.averageWaitTime)}
                      </div>
                      <div>
                        <Timer className="h-4 w-4 inline mr-1" />
                        Max: {formatDuration(queue.longestWaitTime)}
                      </div>
                    </div>
                    {queue.waitingCalls > 0 && (
                      <Progress 
                        value={(queue.availableAgents / queue.waitingCalls) * 100} 
                        className="mt-2"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No active queues
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Right Sidebar - Call History & Client Info */}
      <div className="w-96 border-l bg-muted/10 p-6 space-y-6">
        <Tabs defaultValue="history" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">Call History</TabsTrigger>
            <TabsTrigger value="client">Client Info</TabsTrigger>
          </TabsList>
          
          <TabsContent value="history" className="space-y-2">
            <ScrollArea className="h-[600px]">
              {callHistory.length > 0 ? (
                <div className="space-y-2">
                  {callHistory.map((call) => (
                    <Card key={call.id} className="p-3">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            {call.direction === "inbound" ? (
                              <PhoneIncoming className="h-4 w-4 text-blue-500" />
                            ) : (
                              <PhoneOutgoing className="h-4 w-4 text-green-500" />
                            )}
                            <span className="font-medium text-sm">{call.phoneNumber}</span>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(call.startTime).toLocaleString()}
                          </div>
                          <div className="text-xs">
                            Duration: {formatDuration(call.duration)}
                          </div>
                        </div>
                        <Badge variant={call.status === "completed" ? "default" : "secondary"}>
                          {call.status}
                        </Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center text-muted-foreground py-8">
                  No call history
                </div>
              )}
            </ScrollArea>
          </TabsContent>
          
          <TabsContent value="client" className="space-y-4">
            {currentCall ? (
              <Card>
                <CardHeader>
                  <CardTitle>Client Information</CardTitle>
                  <CardDescription>Details will appear here during calls</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Name:</span>
                      <span className="text-sm">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Account:</span>
                      <span className="text-sm">-</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm font-medium">Previous Calls:</span>
                      <span className="text-sm">-</span>
                    </div>
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <Label>Quick Actions</Label>
                    <div className="grid grid-cols-2 gap-2">
                      <Button size="sm" variant="outline">
                        View Profile
                      </Button>
                      <Button size="sm" variant="outline">
                        Add Note
                      </Button>
                      <Button size="sm" variant="outline">
                        Schedule Callback
                      </Button>
                      <Button size="sm" variant="outline">
                        Send SMS
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Client information will appear here when you're on an active call
                </AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}