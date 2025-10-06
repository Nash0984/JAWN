import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { File, Search, FileText, HelpCircle, Menu, Bell, User, Calculator, BookOpen, FileCheck, Users, Shield } from "lucide-react";
import LanguageSelector from "./LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";

// Maryland State Seal Component (official seal)
const MarylandSeal = ({ className = "h-8 w-auto", t }: { className?: string; t: any }) => (
  <div className="flex items-center space-x-3">
    <img 
      src="/maryland-seal.svg" 
      alt="Maryland State Seal" 
      className={`${className} flex-shrink-0`}
      onError={(e) => {
        console.log('Failed to load Maryland seal:', e);
        (e.target as HTMLImageElement).style.display = 'none';
      }}
    />
    <div className="hidden sm:block">
      <h1 className="text-lg font-semibold text-foreground leading-tight">{t("nav.title")}</h1>
      <p className="text-xs text-muted-foreground">{t("nav.subtitle")}</p>
    </div>
  </div>
);

export default function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentLanguage, changeLanguage, t } = useLanguage();

  const navigation = [
    { name: t("nav.home"), href: "/", icon: FileText, current: location === "/" },
    { name: "Verify Documents", href: "/verify", icon: FileCheck, current: location === "/verify" },
    { name: "Navigator Workspace", href: "/navigator", icon: Users, current: location === "/navigator" },
    { name: "Consent Forms", href: "/consent", icon: Shield, current: location === "/consent" },
    { name: "Eligibility Check", href: "/eligibility", icon: Calculator, current: location === "/eligibility" },
    { name: "Policy Manual", href: "/manual", icon: BookOpen, current: location === "/manual" },
    { name: t("nav.search"), href: "/search", icon: Search, current: location === "/search" },
    { name: t("nav.help"), href: "/help", icon: HelpCircle, current: location === "/help" },
  ];

  const NavItems = ({ mobile = false }) => (
    <div className={`${mobile ? "space-y-2" : "hidden md:ml-10 md:flex md:space-x-8"}`}>
      {navigation.map((item) => {
        const Icon = item.icon;
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={() => mobile && setMobileMenuOpen(false)}
            className={`${
              mobile ? "w-full justify-start" : ""
            } ${
              item.current
                ? "bg-primary text-primary-foreground"
                : "text-foreground hover:text-primary"
            } inline-flex items-center px-3 py-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50`}
            data-testid={`nav-${item.href === "/" ? "home" : item.href.slice(1)}`}
            aria-current={item.current ? "page" : undefined}
          >
            <Icon className={`h-4 w-4 ${mobile ? "mr-2" : "md:hidden"}`} aria-hidden="true" />
            <span className={mobile ? "" : "hidden md:inline"}>{item.name}</span>
          </Link>
        );
      })}
    </div>
  );

  return (
    <nav className="bg-card border-b border-border sticky top-0 z-50" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center">
            <Link href="/">
              <div className="cursor-pointer" data-testid="nav-logo">
                <MarylandSeal className="h-12 w-auto" t={t} />
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <NavItems />
          </div>

          {/* Right side items */}
          <div className="flex items-center space-x-4">
            <LanguageSelector 
              currentLanguage={currentLanguage} 
              onLanguageChange={changeLanguage} 
            />
            <Button variant="ghost" size="sm" data-testid="nav-notifications">
              <Bell className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" data-testid="nav-profile">
              <User className="h-4 w-4" />
            </Button>
            
            {/* Mobile menu button */}
            <div className="md:hidden">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" data-testid="nav-mobile-menu">
                    <Menu className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[400px]">
                  <div className="flex flex-col space-y-4 mt-6">
                    <div className="flex items-center space-x-3 pb-4 border-b border-border">
                      <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                        <File className="text-primary-foreground h-5 w-5" />
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">Maryland SNAP Policy Manual</h2>
                    </div>
                    <NavItems mobile />
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
