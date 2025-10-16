import { ReactNode } from "react";
import { Link } from "wouter";
import { ChevronRight, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

interface LegalLayoutProps {
  title: string;
  lastReviewed: string;
  children: ReactNode;
}

export default function LegalLayout({ title, lastReviewed, children }: LegalLayoutProps) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Breadcrumb Navigation */}
        <Breadcrumb className="mb-6" data-testid="breadcrumb-navigation">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/" className="text-muted-foreground hover:text-foreground" data-testid="link-home">
                  Home
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link href="/legal" className="text-muted-foreground hover:text-foreground" data-testid="link-legal">
                  Legal
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
            <BreadcrumbItem>
              <BreadcrumbPage data-testid="text-current-page">{title}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        {/* Header with Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2" data-testid="text-page-title">{title}</h1>
            <p className="text-sm text-muted-foreground" data-testid="text-last-reviewed">
              Last Reviewed: {lastReviewed}
            </p>
          </div>
          <div className="flex gap-2 mt-4 sm:mt-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              data-testid="button-print"
              aria-label="Print document"
            >
              <Printer className="h-4 w-4 mr-2" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrint}
              data-testid="button-download-pdf"
              aria-label="Download as PDF"
            >
              <Download className="h-4 w-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Legal Content */}
        <div 
          className="prose prose-slate dark:prose-invert max-w-none"
          data-testid="legal-content"
        >
          {children}
        </div>

        {/* Back to Legal Hub */}
        <div className="mt-12 pt-6 border-t">
          <Link href="/legal">
            <Button variant="outline" data-testid="button-back-legal">
              ← Back to Legal Hub
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
