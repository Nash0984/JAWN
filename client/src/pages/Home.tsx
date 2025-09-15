import SearchInterface from "@/components/SearchInterface";
import DocumentVerification from "@/components/DocumentVerification";
import { Camera, FileText, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {/* Hero Section - Document Verification Focus */}
      <section className="mb-8 sm:mb-12" aria-labelledby="main-heading">
        <div className="text-center mb-6 sm:mb-8">
          <h1 id="main-heading" className="text-2xl sm:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            Check Your SNAP Documents
          </h1>
          <p className="text-base sm:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
            Upload a photo or document to see if it meets Maryland SNAP requirements. 
            Get plain English answers with official policy citations.
          </p>
        </div>
        
        {/* Document Upload Options */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="upload-mobile-photo">
            <CardHeader className="text-center pb-4">
              <Camera className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-lg">Take a Photo</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Use your phone camera to check paystubs, bank statements, or other documents
              </p>
              <Button className="w-full" data-testid="button-camera">
                Open Camera
              </Button>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow cursor-pointer" data-testid="upload-pdf">
            <CardHeader className="text-center pb-4">
              <FileText className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-lg">Upload PDF</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Upload existing PDF documents for verification against SNAP policy
              </p>
              <Button variant="outline" className="w-full" data-testid="button-pdf">
                Choose File
              </Button>
            </CardContent>
          </Card>
          
          <Card className="hover:shadow-md transition-shadow cursor-pointer sm:col-span-2 lg:col-span-1" data-testid="upload-other">
            <CardHeader className="text-center pb-4">
              <Upload className="h-8 w-8 mx-auto text-primary mb-2" />
              <CardTitle className="text-lg">Other Documents</CardTitle>
            </CardHeader>
            <CardContent className="text-center pt-0">
              <p className="text-sm text-muted-foreground mb-4">
                Upload images or scanned documents (PNG, JPG, JPEG)
              </p>
              <Button variant="outline" className="w-full" data-testid="button-upload">
                Browse Files
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Ask Questions Section */}
      <section className="mb-8 sm:mb-12" aria-labelledby="search-heading">
        <div className="text-center mb-6">
          <h2 id="search-heading" className="text-xl sm:text-2xl font-semibold text-foreground mb-2">
            Or Ask About Maryland SNAP
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground">
            Get answers from Maryland's official SNAP policy manual
          </p>
        </div>
        
        <SearchInterface />
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
