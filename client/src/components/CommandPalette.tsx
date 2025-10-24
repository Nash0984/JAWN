import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Home,
  FileText,
  Upload,
  Settings,
  Users,
  BarChart3,
  BookOpen,
  Shield,
  Bell,
  MessageSquare,
  FileCheck,
  Briefcase,
  ClipboardList,
  Search,
  Calculator,
  FileStack,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface NavItem {
  title: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
  group: string;
  roles?: string[];
}

const navigationItems: NavItem[] = [
  // Main Navigation
  { title: "Home", path: "/", icon: Home, group: "Main" },
  { title: "Search Policy Manual", path: "/search", icon: Search, group: "Main" },
  { title: "Eligibility Calculator", path: "/eligibility", icon: Calculator, group: "Main" },
  { title: "Policy Manual", path: "/manual", icon: BookOpen, group: "Main" },
  
  // Documents - Staff/Admin only
  { title: "Upload Document", path: "/upload", icon: Upload, group: "Documents", roles: ["admin", "super_admin"] },
  { title: "Document Verification", path: "/verify", icon: FileCheck, group: "Documents", roles: ["navigator", "caseworker", "admin", "super_admin"] },
  
  // Tools - Staff only
  { title: "Navigator Workspace", path: "/navigator", icon: Briefcase, group: "Tools", roles: ["navigator", "admin", "super_admin"] },
  { title: "Consent Management", path: "/consent", icon: Shield, group: "Tools", roles: ["navigator", "admin", "super_admin"] },
  
  // Admin
  { title: "Admin Dashboard", path: "/admin", icon: Settings, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "Rules Extraction", path: "/admin/rules", icon: FileStack, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "Policy Sources", path: "/admin/sources", icon: FileText, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "AI Monitoring", path: "/admin/ai-monitoring", icon: BarChart3, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "E-File Monitoring", path: "/admin/efile-monitoring", icon: FileCheck, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "Audit Logs", path: "/admin/audit-logs", icon: ClipboardList, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "API Documentation", path: "/admin/api-docs", icon: FileText, group: "Admin", roles: ["admin", "super_admin"] },
  { title: "Feedback Management", path: "/admin/feedback", icon: MessageSquare, group: "Admin", roles: ["admin", "super_admin"] },
  
  // Settings
  { title: "Notifications", path: "/notifications", icon: Bell, group: "Settings" },
  { title: "Notification Settings", path: "/settings/notifications", icon: Settings, group: "Settings" },
  
  // Public Tools
  { title: "Document Checklist", path: "/public/documents", icon: ClipboardList, group: "Public Tools" },
  { title: "Notice Explainer", path: "/public/notices", icon: FileText, group: "Public Tools" },
  { title: "Simplified Search", path: "/public/search", icon: Search, group: "Public Tools" },
  { title: "Benefits Cliff Calculator", path: "/cliff-calculator", icon: TrendingUp, group: "Public Tools" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [, navigate] = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const filterItemsByRole = (items: NavItem[]) => {
    if (!user) return items.filter(item => !item.roles);
    
    return items.filter(item => {
      if (!item.roles) return true;
      return item.roles.includes(user.role);
    });
  };

  const handleSelect = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const groupedItems = filterItemsByRole(navigationItems).reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {} as Record<string, NavItem[]>);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." data-testid="input-command-search" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        {Object.entries(groupedItems).map(([group, items], index) => (
          <div key={group}>
            {index > 0 && <CommandSeparator />}
            <CommandGroup heading={group}>
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <CommandItem
                    key={item.path}
                    onSelect={() => handleSelect(item.path)}
                    data-testid={`command-item-${item.path.replace(/\//g, '-')}`}
                  >
                    <Icon className="mr-2 h-4 w-4" />
                    <span>{item.title}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </div>
        ))}
      </CommandList>
    </CommandDialog>
  );
}
