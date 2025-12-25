import DocumentVerification from "@/components/DocumentVerification";

export default function DocumentVerificationPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" data-testid="heading-page-title">
          Document Verification
        </h1>
        <p className="text-muted-foreground">
          Upload documents to verify they meet SNAP program requirements. The system will analyze documents and provide instant feedback on whether they satisfy verification requirements.
        </p>
      </div>
      
      <DocumentVerification />
    </div>
  );
}
