import SearchInterface from "@/components/SearchInterface";
import SystemArchitecture from "@/components/SystemArchitecture";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section with Search */}
      <section className="mb-12">
        <div className="text-center mb-8">
          <h2 className="text-4xl font-bold text-foreground mb-4">
            AI-Powered Benefits Navigation
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get instant, accurate answers about benefit policies across all programs. 
            Our RAG-powered system searches through thousands of policy documents to provide you with the most relevant information.
          </p>
        </div>
        
        <SearchInterface />
      </section>

      {/* Architecture Overview */}
      <SystemArchitecture />
    </div>
  );
}
