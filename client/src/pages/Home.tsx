import SearchInterface from "@/components/SearchInterface";
import SystemArchitecture from "@/components/SystemArchitecture";

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section with Search */}
      <section className="mb-12" aria-labelledby="main-heading">
        <div className="text-center mb-8">
          <h1 id="main-heading" className="text-4xl font-bold text-foreground mb-4">
            Maryland SNAP Benefits Information
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Find answers about Maryland food assistance benefits (SNAP). 
            Get the same information that state workers use to help people apply for and keep their benefits.
          </p>
        </div>
        
        <SearchInterface />
      </section>

      {/* System Information */}
      <section aria-labelledby="system-info-heading">
        <h2 id="system-info-heading" className="sr-only">How this system works</h2>
        <SystemArchitecture />
      </section>
    </div>
  );
}
