import { Helmet } from "react-helmet-async";
import { Link } from "wouter";
import { 
  Shield, 
  FileText, 
  Eye, 
  Lock, 
  AlertTriangle, 
  Info,
  ChevronRight
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const legalPages = [
  {
    id: "privacy",
    title: "Privacy Policy",
    description: "How we collect, use, and protect your personal and health information with HIPAA-compliant practices.",
    icon: Shield,
    path: "/legal/privacy",
    lastUpdated: "October 16, 2025",
    color: "text-blue-600 dark:text-blue-400"
  },
  {
    id: "terms",
    title: "Terms of Service",
    description: "Your rights and responsibilities when using the Maryland Benefits Platform.",
    icon: FileText,
    path: "/legal/terms",
    lastUpdated: "October 16, 2025",
    color: "text-green-600 dark:text-green-400"
  },
  {
    id: "accessibility",
    title: "Accessibility Statement",
    description: "Our commitment to WCAG 2.1 AA compliance and ensuring equal access for all users.",
    icon: Eye,
    path: "/legal/accessibility",
    lastUpdated: "October 16, 2025",
    color: "text-purple-600 dark:text-purple-400"
  },
  {
    id: "security",
    title: "Data Security Policy",
    description: "Technical safeguards including AES-256-GCM encryption, audit logging, and security controls.",
    icon: Lock,
    path: "/legal/security",
    lastUpdated: "October 16, 2025",
    color: "text-red-600 dark:text-red-400"
  },
  {
    id: "breach-notification",
    title: "Breach Notification Policy",
    description: "Our procedures for detecting, responding to, and notifying you of security incidents.",
    icon: AlertTriangle,
    path: "/legal/breach-notification",
    lastUpdated: "October 16, 2025",
    color: "text-orange-600 dark:text-orange-400"
  },
  {
    id: "disclaimer",
    title: "Disclaimer",
    description: "Important notices about platform limitations, user responsibilities, and legal disclaimers.",
    icon: Info,
    path: "/legal/disclaimer",
    lastUpdated: "October 16, 2025",
    color: "text-gray-600 dark:text-gray-400"
  },
];

export default function LegalHub() {
  return (
    <>
      <Helmet>
        <title>Legal & Policy Documentation - Maryland Benefits Platform</title>
        <meta 
          name="description" 
          content="Access all legal and policy documentation for Maryland Benefits Platform including Privacy Policy, Terms of Service, Accessibility Statement, and Security policies." 
        />
      </Helmet>
      
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-12 max-w-7xl">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold mb-4" data-testid="text-legal-hub-title">
              Legal & Policy Documentation
            </h1>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto" data-testid="text-legal-hub-description">
              Welcome to our legal hub. Here you'll find comprehensive information about how we protect your data, 
              ensure accessibility, and maintain security standards. All policies comply with HIPAA regulations and 
              Maryland state law.
            </p>
          </div>

          {/* Legal Pages Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {legalPages.map((page) => {
              const IconComponent = page.icon;
              return (
                <Link key={page.id} href={page.path} className="group">
                  <Card 
                    className="h-full transition-all hover:shadow-lg hover:border-primary cursor-pointer" 
                    data-testid={`card-legal-${page.id}`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between mb-2">
                        <div className={`p-3 rounded-lg bg-muted ${page.color}`}>
                          <IconComponent className="h-6 w-6" />
                        </div>
                        <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors" data-testid={`text-${page.id}-title`}>
                        {page.title}
                      </CardTitle>
                      <CardDescription data-testid={`text-${page.id}-description`}>
                        {page.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground" data-testid={`text-${page.id}-updated`}>
                        Last updated: {page.lastUpdated}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>

          {/* Quick Links Section */}
          <div className="bg-muted rounded-lg p-8 mb-12" data-testid="section-quick-links">
            <h2 className="text-2xl font-bold mb-6">Quick Links</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">For Users</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link href="/legal/privacy" className="text-primary hover:underline" data-testid="link-privacy-quick">
                      How we protect your data →
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/accessibility" className="text-primary hover:underline" data-testid="link-accessibility-quick">
                      Accessibility features →
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/disclaimer" className="text-primary hover:underline" data-testid="link-disclaimer-quick">
                      Important disclaimers →
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-2">For Developers & Administrators</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link href="/legal/security" className="text-primary hover:underline" data-testid="link-security-quick">
                      Security policies →
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/breach-notification" className="text-primary hover:underline" data-testid="link-breach-quick">
                      Breach procedures →
                    </Link>
                  </li>
                  <li>
                    <Link href="/legal/terms" className="text-primary hover:underline" data-testid="link-terms-quick">
                      Terms of Service →
                    </Link>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Information */}
          <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-lg p-6" data-testid="section-contact">
            <h2 className="text-xl font-bold mb-4">Questions or Concerns?</h2>
            <p className="text-muted-foreground mb-4">
              If you have questions about our legal policies or need to report a concern, please contact the appropriate team:
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="font-semibold">Privacy Inquiries</p>
                <p className="text-muted-foreground">privacy@marylandbenefits.org</p>
                <p className="text-muted-foreground">(410) 555-PRIVACY</p>
              </div>
              <div>
                <p className="font-semibold">Accessibility Support</p>
                <p className="text-muted-foreground">accessibility@marylandbenefits.org</p>
                <p className="text-muted-foreground">(410) 555-ACCESS</p>
              </div>
              <div>
                <p className="font-semibold">Security Issues</p>
                <p className="text-muted-foreground">security@marylandbenefits.org</p>
                <p className="text-muted-foreground">(410) 555-SECURE</p>
              </div>
            </div>
          </div>

          {/* Back to Home */}
          <div className="mt-12 text-center">
            <Link href="/">
              <Button variant="outline" size="lg" data-testid="button-back-home">
                ← Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
