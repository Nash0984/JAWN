import { Link, useLocation } from "wouter";
import { Home, Search, Bell, BookOpen } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ElementType;
  testId: string;
  requiresAuth?: boolean;
}

export default function MobileBottomNav() {
  const [location] = useLocation();
  const { isAuthenticated } = useAuth();

  const navItems: NavItem[] = [
    {
      href: "/",
      label: "Home",
      icon: Home,
      testId: "bottom-nav-home",
    },
    {
      href: "/search",
      label: "Search",
      icon: Search,
      testId: "bottom-nav-search",
    },
    {
      href: isAuthenticated ? "/notifications" : "/login",
      label: "Updates",
      icon: Bell,
      testId: "bottom-nav-updates",
      requiresAuth: true,
    },
    {
      href: "/manual",
      label: "Resources",
      icon: BookOpen,
      testId: "bottom-nav-resources",
    },
  ];

  return (
    <nav 
      className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-gray-950 border-t border-gray-200 dark:border-gray-800 shadow-lg"
      aria-label="Mobile bottom navigation"
    >
      <div className="grid grid-cols-4 h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;
          const isDisabled = item.requiresAuth && !isAuthenticated;
          
          return (
            <Link 
              key={item.testId} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center h-full w-full gap-1 transition-all duration-200",
                isDisabled && "opacity-50",
                isActive 
                  ? "text-md-blue dark:text-md-gold bg-md-blue/5 dark:bg-md-gold/10" 
                  : "text-gray-600 dark:text-gray-400 hover:text-md-blue dark:hover:text-md-gold hover:bg-md-blue/5 dark:hover:bg-md-gold/5"
              )}
              data-testid={item.testId}
              aria-label={`${item.label} navigation${isDisabled ? ' (requires login)' : ''}`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon 
                className={cn(
                  "h-5 w-5 transition-transform",
                  isActive && "scale-110"
                )} 
                aria-hidden="true"
              />
              <span className={cn(
                "text-xs font-medium",
                isActive && "font-semibold"
              )}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
