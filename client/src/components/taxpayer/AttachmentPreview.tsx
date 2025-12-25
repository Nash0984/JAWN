import { FileText, Download, Image, FileSpreadsheet, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AttachmentPreviewProps {
  filename: string;
  fileSize?: number;
  mimeType?: string;
  downloadUrl?: string;
  className?: string;
}

function getFileIcon(mimeType?: string) {
  if (!mimeType) return File;
  
  if (mimeType.startsWith("image/")) return Image;
  if (mimeType === "application/pdf") return FileText;
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return FileSpreadsheet;
  
  return FileText;
}

function formatFileSize(bytes?: number): string {
  if (!bytes) return "";
  
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentPreview({
  filename,
  fileSize,
  mimeType,
  downloadUrl,
  className
}: AttachmentPreviewProps) {
  const Icon = getFileIcon(mimeType);
  const fileSizeText = formatFileSize(fileSize);

  return (
    <div
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors",
        className
      )}
      data-testid="attachment-preview"
    >
      <div className="flex-shrink-0 p-2 rounded bg-primary/10">
        <Icon className="h-5 w-5 text-primary" aria-hidden="true" />
      </div>
      
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate" data-testid="text-filename">
          {filename}
        </p>
        {fileSizeText && (
          <p className="text-xs text-muted-foreground" data-testid="text-filesize">
            {fileSizeText}
          </p>
        )}
      </div>
      
      {downloadUrl && (
        <Button
          variant="ghost"
          size="sm"
          asChild
          data-testid="button-download-attachment"
          aria-label={`Download ${filename}`}
        >
          <a href={downloadUrl} download={filename}>
            <Download className="h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
      )}
    </div>
  );
}
