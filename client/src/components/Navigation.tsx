import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { File, Search, FileText, HelpCircle, Menu, User, Calculator, BookOpen, FileCheck, Users, Shield, LogOut, LogIn, UserPlus, Settings, Globe, Activity, LayoutDashboard } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import LanguageSelector from "./LanguageSelector";
import NotificationBell from "./NotificationBell";
import { MarylandFlag } from "./MarylandFlag";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// Maryland State Header Component matching official branding
const MarylandStateHeader = ({ t }: { t: any }) => (
  <div className="flex items-center gap-3">
    <MarylandFlag className="h-10 w-10 flex-shrink-0" />
    <div className="hidden sm:block">
      <div className="text-sm font-semibold text-white leading-tight">State of Maryland</div>
      <div className="text-xs text-white/90">Benefits Navigator</div>
    </div>
  </div>
);

export default function Navigation() {
  const [location] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { currentLanguage, changeLanguage, t } = useLanguage();
  const { user, isAuthenticated, isClient, isStaff, isAdmin, logout, isLoading } = useAuth();
  const { toast } = useToast();

  // Define all navigation items with role requirements
  const allNavigationItems = [
    { name: t("nav.home"), href: "/", icon: FileText, roles: ["public", "client", "navigator", "caseworker", "admin", "super_admin"] },
    { name: t("nav.search"), href: "/search", icon: Search, roles: ["public", "client", "navigator", "caseworker", "admin", "super_admin"] },
    { name: "Demo Showcase", href: "/demo", icon: LayoutDashboard, roles: ["public", "client", "navigator", "caseworker", "admin", "super_admin"], highlight: true },
    { name: "Applicant Tools", href: "/public/documents", icon: Globe, roles: ["public", "client", "navigator", "caseworker", "admin", "super_admin"] },
    { name: "Eligibility Check", href: "/eligibility", icon: Calculator, roles: ["client", "navigator", "caseworker", "admin", "super_admin"] },
    { name: "VITA Tax Help", href: "/vita", icon: BookOpen, roles: ["navigator", "caseworker", "admin", "super_admin"] },
    { name: "Verify Documents", href: "/verify", icon: FileCheck, roles: ["navigator", "caseworker", "admin", "super_admin"] },
    { name: "Navigator Workspace", href: "/navigator", icon: Users, roles: ["navigator", "caseworker", "admin", "super_admin"] },
    { name: "Consent Forms", href: "/consent", icon: Shield, roles: ["navigator", "caseworker", "admin", "super_admin"] },
    { name: "My QC Cockpit", href: "/caseworker/cockpit", icon: Activity, roles: ["caseworker", "admin", "super_admin"] },
    { name: "QC Command Center", href: "/supervisor/cockpit", icon: LayoutDashboard, roles: ["admin", "super_admin"] },
    { name: "Policy Manual", href: "/manual", icon: BookOpen, roles: ["client", "navigator", "caseworker", "admin", "super_admin"] },
    { name: "Admin Panel", href: "/admin", icon: Settings, roles: ["admin", "super_admin"] },
    { name: t("nav.help"), href: "/help", icon: HelpCircle, roles: ["public", "client", "navigator", "caseworker", "admin", "super_admin"] },
  ];

  // Filter navigation items based on user role
  const navigation = allNavigationItems
    .filter(item => {
      if (!isAuthenticated) {
        return item.roles.includes("public");
      }
      return item.roles.includes(user?.role || "client");
    })
    .map(item => ({
      ...item,
      current: location === item.href
    }));

  // Handle logout
  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
      setMobileMenuOpen(false);
    } catch (error) {
      toast({
        title: "Logout failed",
        description: "There was a problem logging you out. Please try again.",
        variant: "destructive",
      });
    }
  };

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
              mobile ? "w-full justify-start text-foreground hover:bg-accent" : "text-white hover:text-white"
            } ${
              item.current
                ? mobile ? "bg-accent text-accent-foreground" : "bg-white/20 text-white"
                : mobile ? "" : "hover:bg-white/10"
            } ${
              item.highlight && !mobile ? "ring-2 ring-md-gold/50" : ""
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
    <nav className="bg-md-red border-b-4 border-md-gold sticky top-0 z-50" role="navigation" aria-label="Main navigation">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Maryland State Logo/Branding */}
          <div className="flex items-center">
            <Link href="/">
              <div className="cursor-pointer" data-testid="nav-logo">
                <MarylandStateHeader t={t} />
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
              
              {isAuthenticated ? (
                <>
                  <NotificationBell />
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" data-testid="nav-profile">
                        <User className="h-4 w-4" />
                        <span className="ml-2 hidden lg:inline">{user?.fullName || user?.username}</span>
                      </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{user?.fullName || user?.username}</p>
                        <p className="text-xs leading-none text-muted-foreground capitalize">{user?.role?.replace('_', ' ')}</p>
                      </div>
                    </DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="cursor-pointer" data-testid="dropdown-profile">
                        <User className="mr-2 h-4 w-4" />
                        <span>Profile</span>
                      </Link>
                    </DropdownMenuItem>
                    {isAdmin && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer" data-testid="dropdown-admin">
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive" data-testid="dropdown-logout">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" asChild data-testid="nav-login">
                  <Link href="/login">
                    <LogIn className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Log in</span>
                  </Link>
                </Button>
                <Button size="sm" className="bg-md-gold text-black hover:bg-md-gold/90" asChild data-testid="nav-signup">
                  <Link href="/signup">
                    <UserPlus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Sign up</span>
                  </Link>
                </Button>
              </>
            )}
            
              {/* Mobile menu button */}
              <div className="md:hidden">
                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-white hover:text-white hover:bg-white/20" data-testid="nav-mobile-menu">
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
                    
                    {isAuthenticated && user && (
                      <div className="flex flex-col space-y-2 pb-4 border-b border-border">
                        <p className="text-sm font-medium">{user.fullName || user.username}</p>
                        <p className="text-xs text-muted-foreground capitalize">{user.role.replace('_', ' ')}</p>
                      </div>
                    )}
                    
                    <NavItems mobile />
                    
                    {isAuthenticated ? (
                      <Button 
                        variant="destructive" 
                        className="w-full mt-4" 
                        onClick={handleLogout}
                        data-testid="mobile-logout"
                      >
                        <LogOut className="mr-2 h-4 w-4" />
                        Log out
                      </Button>
                    ) : (
                      <div className="flex flex-col space-y-2 mt-4">
                        <Button variant="outline" className="w-full" asChild data-testid="mobile-login">
                          <Link href="/login" onClick={() => setMobileMenuOpen(false)}>
                            <LogIn className="mr-2 h-4 w-4" />
                            Log in
                          </Link>
                        </Button>
                        <Button className="w-full" asChild data-testid="mobile-signup">
                          <Link href="/signup" onClick={() => setMobileMenuOpen(false)}>
                            <UserPlus className="mr-2 h-4 w-4" />
                            Sign up
                          </Link>
                        </Button>
                      </div>
                    )}
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
