"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Bell,
  BookMarked,
  BookOpen,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Cpu,
  FileText,
  FlaskConical,
  LayoutDashboard,
  Microscope,
  Package,
  Ruler,
  Search,
  Settings,
  ShieldCheck,
  Tags,
  TestTube2,
  Thermometer,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { NAV_ITEMS } from "@/lib/constants";
import { useAuth } from "@/contexts/auth-context";
import { BrandMark } from "@/components/layout/brand";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types";

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard,
  Search,
  Bell,
  FlaskConical,
  TestTube2,
  FileText,
  CheckCircle2,
  Building2,
  Microscope,
  Package,
  Users,
  Boxes,
  ClipboardList,
  Cpu,
  BookMarked,
  BookOpen,
  Ruler,
  Tags,
  Thermometer,
  UserCog,
  Activity,
  ShieldCheck,
  Settings,
};

export function AppSidebar() {
  const pathname = usePathname();
  const { profile, isRole } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <BrandMark collapsed={collapsed} />
      </SidebarHeader>
      <SidebarContent>
        {NAV_ITEMS.map((group) => {
          const items = group.items.filter((item) => {
            const roles = "roles" in item ? (item.roles as UserRole[] | undefined) : undefined;
            if (!roles) return true;
            return isRole(...roles);
          });
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.title}>
              <SidebarGroupLabel>{group.title}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {items.map((item) => {
                    const Icon = ICONS[item.icon] || LayoutDashboard;
                    const active =
                      pathname === item.href ||
                      pathname.startsWith(`${item.href}/`);
                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={active}
                          tooltip={item.title}
                          className={cn(
                            active && "bg-sidebar-accent text-sidebar-accent-foreground"
                          )}
                        >
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <div className="rounded-xl bg-primary/5 px-3 py-2.5 text-xs text-muted-foreground">
            Signed in as{" "}
            <span className="font-medium text-foreground">
              {profile?.displayName || "User"}
            </span>
          </div>
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
