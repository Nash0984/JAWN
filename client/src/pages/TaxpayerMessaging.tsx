import { Helmet } from "react-helmet-async";
import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { MessageBubble } from "@/components/taxpayer/MessageBubble";
import { AttachmentPreview } from "@/components/taxpayer/AttachmentPreview";
import { Send, Paperclip, MessageSquare } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/contexts/TenantContext";

export default function TaxpayerMessaging() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { stateConfig } = useTenant();
  const stateName = stateConfig?.stateName || 'State';
  const [messageText, setMessageText] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all messages for the taxpayer's VITA session
  const { data: messages, isLoading } = useQuery<any[]>({
    queryKey: ["/api/taxpayer/messages", "all"],
    refetchInterval: 5000, // Poll every 5 seconds for new messages
  });

  // Mark messages as read when viewing
  useEffect(() => {
    if (messages && messages.length > 0) {
      const unreadMessages = messages.filter(msg => !msg.isRead && msg.senderRole === "navigator");
      
      unreadMessages.forEach(async (msg) => {
        try {
          await apiRequest("PATCH", `/api/taxpayer/messages/${msg.id}`, {
            isRead: true,
          });
        } catch (error) {
          // console.error("Failed to mark message as read:", error);
        }
      });
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessageMutation = useMutation({
    mutationFn: async ({ message, attachmentIds }: { message: string; attachmentIds?: string[] }) => {
      const response = await apiRequest("POST", "/api/taxpayer/messages", {
        message,
        senderRole: "taxpayer",
        attachmentIds: attachmentIds || [],
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/taxpayer/messages"] });
      setMessageText("");
      setAttachments([]);
      toast({
        title: "Message Sent",
        description: "Your message has been sent to your navigator.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Send Failed",
        description: error.message || "Failed to send message. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      const newFiles = Array.from(event.target.files);
      setAttachments(prev => [...prev, ...newFiles].slice(0, 5)); // Max 5 files
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() && attachments.length === 0) {
      toast({
        title: "Empty Message",
        description: "Please enter a message or attach a file.",
        variant: "destructive",
      });
      return;
    }

    try {
      let attachmentIds: string[] = [];

      // Upload attachments first if any
      if (attachments.length > 0) {
        for (const file of attachments) {
          const uploadUrlResponse = await apiRequest("POST", "/api/documents/upload-url", {});
          const { uploadURL } = await uploadUrlResponse.json();

          // Upload file to object storage
          await fetch(uploadURL, {
            method: "PUT",
            body: file,
            headers: {
              "Content-Type": file.type,
            },
          });

          // Create document record
          const docResponse = await apiRequest("POST", "/api/documents", {
            filename: file.name,
            originalName: file.name,
            objectPath: uploadURL,
            fileSize: file.size,
            mimeType: file.type,
            status: "uploaded",
          });

          const docData = await docResponse.json();
          attachmentIds.push(docData.id);
        }
      }

      // Send the message
      await sendMessageMutation.mutateAsync({
        message: messageText,
        attachmentIds,
      });
    } catch (error) {
      // console.error("Failed to send message:", error);
      toast({
        title: "Send Failed",
        description: "Failed to upload attachments or send message.",
        variant: "destructive",
      });
    }
  };

  const sortedMessages = messages?.sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  ) || [];

  return (
    <>
      <Helmet>
        <title>Messages | {stateName} Benefits</title>
        <meta name="description" content="Secure messaging with your tax navigator." />
      </Helmet>

      <div className="container mx-auto px-4 py-8 max-w-4xl h-[calc(100vh-8rem)]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground dark:text-foreground mb-2" data-testid="page-title">
            Messages
          </h1>
          <p className="text-muted-foreground dark:text-muted-foreground">
            Communicate securely with your tax navigator
          </p>
        </div>

        <div className="flex flex-col h-[calc(100%-8rem)]">
          {/* Messages Display */}
          <Card className="flex-1 flex flex-col bg-card dark:bg-card border-border dark:border-border overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary dark:text-primary" aria-hidden="true" />
                <CardTitle className="text-foreground dark:text-foreground">Conversation</CardTitle>
              </div>
              <CardDescription className="text-muted-foreground dark:text-muted-foreground">
                {sortedMessages.length} message{sortedMessages.length !== 1 ? 's' : ''}
              </CardDescription>
            </CardHeader>
            
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full px-6 py-4" ref={scrollRef}>
                {isLoading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-24 w-3/4" />
                    ))}
                  </div>
                ) : sortedMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-12" data-testid="empty-state-messages">
                    <MessageSquare className="h-16 w-16 text-muted-foreground dark:text-muted-foreground mb-4" aria-hidden="true" />
                    <h3 className="text-lg font-medium text-foreground dark:text-foreground mb-2">No Messages Yet</h3>
                    <p className="text-muted-foreground dark:text-muted-foreground max-w-md">
                      Start a conversation with your navigator by sending a message below.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-4">
                    {sortedMessages.map((message: any) => (
                      <div key={message.id} data-testid={`message-${message.id}`}>
                        <MessageBubble
                          message={message.message}
                          senderRole={message.senderRole}
                          senderName={message.senderRole === "navigator" ? "Navigator" : user?.fullName}
                          timestamp={message.createdAt}
                          isRead={message.isRead}
                        />
                        {/* Message Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="mt-2 space-y-2 pl-4">
                            {message.attachments.map((attachment: any) => (
                              <AttachmentPreview
                                key={attachment.id}
                                filename={attachment.filename}
                                fileSize={attachment.fileSize}
                                mimeType={attachment.mimeType}
                                downloadUrl={attachment.objectPath}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          <Separator className="my-4 bg-border dark:bg-border" />

          {/* Message Composer */}
          <Card className="flex-shrink-0 bg-card dark:bg-card border-border dark:border-border">
            <CardContent className="pt-6 space-y-4">
              {/* Attachments Preview */}
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted/30 dark:bg-muted/10 rounded">
                      <span className="text-sm text-foreground dark:text-foreground truncate">
                        {file.name}
                      </span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                        data-testid={`button-remove-attachment-${index}`}
                      >
                        Remove
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Textarea
                placeholder="Type your message here..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                className="min-h-[100px] resize-none bg-background dark:bg-background text-foreground dark:text-foreground border-border dark:border-border"
                data-testid="input-message-text"
                aria-label="Message text"
              />

              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={handleFileSelect}
                  aria-label="Attach files"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= 5}
                  data-testid="button-attach-file"
                >
                  <Paperclip className="mr-2 h-4 w-4" aria-hidden="true" />
                  Attach ({attachments.length}/5)
                </Button>

                <Button
                  onClick={handleSendMessage}
                  disabled={sendMessageMutation.isPending || (!messageText.trim() && attachments.length === 0)}
                  className="flex-1"
                  data-testid="button-send-message"
                >
                  <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                  {sendMessageMutation.isPending ? "Sending..." : "Send Message"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                Press Enter to send, Shift+Enter for new line. Max 5 attachments.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
