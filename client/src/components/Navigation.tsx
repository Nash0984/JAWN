import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { File, Search, Upload, Settings, Brain, Menu, Bell, User } from "lucide-react";

// Maryland State Logo SVG Component (simplified version based on brand guidelines)
const MarylandLogo = ({ className = "h-8 w-auto" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 120 40" aria-label="State of Maryland Logo" role="img">
    <rect width="120" height="40" fill="#c8122c" rx="4"/>
    <text x="60" y="22" textAnchor="middle" fill="white" fontSize="12" fontFamily="Montserrat" fontWeight="600">
      MARYLAND
    </text>
    <text x="60" y="32" textAnchor="middle" fill="#ffc838" fontSize="8" fontFamily="Montserrat" fontWeight="400">
      SNAP BENEFITS
    </text>
  </svg>
);

export default function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { name: "Search SNAP Policies", href: "/", icon: Search, current: location === "/" },
    { name: "Upload Documents", href: "/upload", icon: Upload, current: location === "/upload" },
    { name: "Administration", href: "/admin", icon: Settings, current: location === "/admin" },
    { name: "AI Training", href: "/training", icon: Brain, current: location === "/training" },
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
              <div className="flex-shrink-0 flex items-center cursor-pointer" data-testid="nav-logo">
                <MarylandLogo className="h-10 w-auto" />
                <div className="ml-3">
                  <h1 className="text-lg font-semibold text-foreground leading-tight">Maryland SNAP</h1>
                  <p className="text-sm text-muted-foreground">Policy Manual System</p>
                </div>
              </div>
            </Link>
            
            {/* Desktop Navigation */}
            <NavItems />
          </div>

          {/* Right side items */}
          <div className="flex items-center space-x-4">
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
