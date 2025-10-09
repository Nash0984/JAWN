import { Link, useLocation } from "wouter";
import { FileText, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PublicPortalNav() {
  const [location] = useLocation();

  const links = [
    {
      href: "/public/documents",
      label: "Document Checklist",
      icon: FileText,
      active: location === "/public/documents",
    },
    {
      href: "/public/notices",
      label: "Notice Explainer",
      icon: Mail,
      active: location === "/public/notices",
    },
    {
      href: "/public/search",
      label: "Policy Search",
      icon: Search,
      active: location === "/public/search",
    },
  ];

  return (
    <div className="border-b bg-card mb-8">
      <div className="container mx-auto px-4">
        <div className="flex gap-2 overflow-x-auto py-4">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant={link.active ? "default" : "ghost"}
                  className="flex items-center gap-2 whitespace-nowrap"
                  data-testid={`public-nav-${link.href.split('/').pop()}`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Button>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
