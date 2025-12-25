import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface MessageBubbleProps {
  message: string;
  senderRole: "navigator" | "taxpayer";
  senderName?: string;
  timestamp: Date | string;
  isRead?: boolean;
  className?: string;
}

export function MessageBubble({
  message,
  senderRole,
  senderName,
  timestamp,
  isRead = true,
  className
}: MessageBubbleProps) {
  const isNavigator = senderRole === "navigator";
  const dateObj = typeof timestamp === "string" ? new Date(timestamp) : timestamp;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 p-4 rounded-lg max-w-[80%]",
        isNavigator ? "self-start bg-muted" : "self-end bg-primary text-primary-foreground",
        className
      )}
      data-testid={`message-bubble-${senderRole}`}
    >
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
          <Badge
            variant={isNavigator ? "secondary" : "outline"}
            className={cn(
              "text-xs",
              !isNavigator && "bg-primary-foreground/20 text-primary-foreground border-primary-foreground/40"
            )}
            data-testid={`badge-sender-${senderRole}`}
          >
            {isNavigator ? "Navigator" : "You"}
          </Badge>
          {senderName && (
            <span className="text-sm font-medium" data-testid="text-sender-name">
              {senderName}
            </span>
          )}
        </div>
        {!isRead && (
          <Badge variant="destructive" className="text-xs">
            New
          </Badge>
        )}
      </div>
      <p className="text-sm whitespace-pre-wrap" data-testid="text-message-content">
        {message}
      </p>
      <span
        className={cn(
          "text-xs",
          isNavigator ? "text-muted-foreground" : "text-primary-foreground/70"
        )}
        data-testid="text-message-timestamp"
      >
        {format(dateObj, "MMM d, yyyy 'at' h:mm a")}
      </span>
    </div>
  );
}
