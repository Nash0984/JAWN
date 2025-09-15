import SearchInterface from "@/components/SearchInterface";
import DocumentUploadToggle from "@/components/DocumentUploadToggle";
import { Camera, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Hero Section - Conversational Search Priority */}
      <section className="mb-8 sm:mb-12" aria-labelledby="main-heading">
        <div className="text-center mb-6 sm:mb-8">
          <h1 id="main-heading" className="text-2xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            Ask About Maryland SNAP Benefits
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Get answers from Maryland's official SNAP policy manual. 
            Ask questions in plain English and get clear, helpful responses.
          </p>
        </div>
        
        <SearchInterface />
      </section>

      {/* Document Verification - Secondary Feature */}
      <section className="mb-8 sm:mb-12" aria-labelledby="document-heading">
        <div className="text-center mb-6">
          <h2 id="document-heading" className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            Need to Check Documents?
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground mb-4">
            Upload photos of paystubs, bank statements, or other documents to verify they meet SNAP requirements
          </p>
          <DocumentUploadToggle />
        </div>
      </section>

      {/* System Status - Minimal */}
      <section className="mt-12 pt-8 border-t border-border" aria-labelledby="status-heading">
        <div className="text-center">
          <h3 id="status-heading" className="text-sm font-medium text-muted-foreground mb-2">
            System Status: 
            <span className="text-green-600 font-semibold ml-1">Active</span>
          </h3>
          <p className="text-xs text-muted-foreground">
            Policy manual last updated: September 2025
          </p>
        </div>
      </section>
    </div>
  );
}
