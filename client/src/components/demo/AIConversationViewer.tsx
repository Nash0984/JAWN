import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, User, Languages, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DemoAIConversation } from "@server/services/demoDataService";

interface AIConversationViewerProps {
  conversation: DemoAIConversation;
}

export function AIConversationViewer({ conversation }: AIConversationViewerProps) {
  return (
    <Card 
      className="h-full flex flex-col"
      data-testid={`conversation-card-${conversation.id}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg flex-1" data-testid={`conversation-title-${conversation.id}`}>
            {conversation.type === 'intake_copilot' && 'Intake Copilot'}
            {conversation.type === 'policy_rag' && 'Policy Q&A'}
            {conversation.type === 'notice_explanation' && 'Notice Explanation'}
            {conversation.type === 'document_analysis' && 'Document Analysis'}
          </CardTitle>
          <div className="flex gap-2">
            {conversation.language !== 'English' && (
              <Badge 
                variant="secondary" 
                className="flex items-center gap-1"
                data-testid={`language-badge-${conversation.id}`}
              >
                <Languages className="h-3 w-3" />
                {conversation.language}
              </Badge>
            )}
            <Badge variant="outline" data-testid={`status-badge-${conversation.id}`}>
              {conversation.status}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col">
        <ScrollArea className="flex-1 pr-4" data-testid={`conversation-messages-${conversation.id}`}>
          <div className="space-y-4">
            {conversation.messages.map((message, index) => (
              <div
                key={index}
                className={cn(
                  "flex gap-3",
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
                data-testid={`message-${conversation.id}-${index}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-purple-600 dark:text-purple-300" />
                    </div>
                  </div>
                )}
                <div
                  className={cn(
                    "rounded-lg px-4 py-2 max-w-[80%]",
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  )}
                >
                  <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  {message.policyCitation && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <FileText className="h-3 w-3" />
                        <span>Citation: {message.policyCitation.source}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {message.policyCitation.citation}
                      </p>
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex-shrink-0 mt-1">
                    <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-300" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
        {conversation.summary && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              <strong>Summary:</strong> {conversation.summary}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
