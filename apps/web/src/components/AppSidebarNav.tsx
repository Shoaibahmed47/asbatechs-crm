"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Briefcase,
  Building2,
  Gauge,
  LayoutDashboard,
  Megaphone,
  TrendingUp,
  UserRoundCog,
  Users
} from "lucide-react";
import {
  canViewEmployeeDirectory,
  isAdminRole,
  isManagerRole
} from "@/lib/rbac";
import { cn } from "@/lib/utils";

type NavItem = { href: string; label: string; icon?: LucideIcon };

export const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Executive Dashboard", icon: LayoutDashboard }]
  },
  {
    label: "Operations",
    items: [
      { href: "/leads", label: "All Leads", icon: Briefcase },
      { href: "/leads/hot", label: "Hot Leads", icon: TrendingUp },
      { href: "/leads/sales", label: "Sales Leads", icon: Megaphone },
      { href: "/work-updates", label: "Work Updates", icon: Activity },
      { href: "/attendance", label: "Attendance", icon: Gauge }
    ]
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Employees", icon: Users },
      { href: "/settings/departments", label: "Departments", icon: Building2 },
      { href: "/settings/clients", label: "Clients", icon: Building2 },
      { href: "/admin/overview", label: "Admin Control", icon: UserRoundCog }
    ]
  }
];

export function filterNavItems(
  items: NavItem[],
  role: string | undefined
): NavItem[] {
  return items.filter((item) => {
    if (item.href === "/settings/departments") return isAdminRole(role);
    if (item.href === "/settings/clients") return isAdminRole(role);
    if (item.href === "/users") return canViewEmployeeDirectory(role);
    if (item.href === "/admin/overview")
      return isAdminRole(role) || isManagerRole(role);
    if (item.href === "/attendance")
      return !isAdminRole(role) && !isManagerRole(role);
    return true;
  });
}

type AppSidebarNavProps = {
  userRole?: string | null;
  collapsed?: boolean;
};

export function AppSidebarNav({ userRole, collapsed = false }: AppSidebarNavProps) {
  const pathname = usePathname();
  const role = userRole ?? undefined;

  return (
    <nav
      className={cn(
        "portal-scroll min-h-0 flex-1 space-y-5 overflow-x-hidden overflow-y-auto overscroll-contain py-3",
        collapsed ? "px-1.5" : "px-2.5"
      )}
      aria-label="Main navigation"
      data-testid="app-sidebar-nav"
    >
      {navSections.map((section) => {
        const items = filterNavItems(section.items, role);
        if (items.length === 0) return null;

        return (
          <div key={section.label}>
            {!collapsed ? (
              <div className="app-section-label">{section.label}</div>
            ) : (
              <div className="sr-only">{section.label}</div>
            )}
            <div className={cn("space-y-0.5", collapsed && "flex flex-col items-center")}>
              {items.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    item.href !== "/attendance" &&
                    pathname.startsWith(`${item.href}/`));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={item.label}
                    aria-label={item.label}
                    className={cn(
                      "app-nav-link",
                      active && "app-nav-link-active",
                      collapsed && "!justify-center !gap-0 !px-0 h-10 w-10 !rounded-xl mx-auto"
                    )}
                  >
                    {item.icon ? (
                      <item.icon
                        className="h-[18px] w-[18px] shrink-0 opacity-90"
                        aria-hidden
                        strokeWidth={1.75}
                      />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-60" />
                    )}
                    {!collapsed ? <span className="truncate">{item.label}</span> : null}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </nav>
  );
}
