import DocumentUpload from "@/components/DocumentUpload";
import ProcessingStatus from "@/components/ProcessingStatus";

export default function Upload() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-2">
          Document Upload & Processing
        </h1>
        <p className="text-muted-foreground">
          Upload policy documents for AI-powered processing and indexing
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <DocumentUpload />
        <ProcessingStatus />
      </div>
    </div>
  );
}
