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
      { href: "/attendance", label: "Attendance", icon: Gauge },
      { href: "/attendance/report", label: "Attendance report", icon: UserRoundCog }
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
    if (item.href === "/attendance/report")
      return isAdminRole(role) || isManagerRole(role);
    return true;
  });
}

export function AppSidebarNav({ userRole }: { userRole?: string | null }) {
  const pathname = usePathname();
  const role = userRole ?? undefined;

  return (
    <nav
      className="mt-6 min-h-0 flex-1 space-y-6 overflow-x-hidden overflow-y-auto overscroll-contain pr-0.5"
      aria-label="Main navigation"
    >
      {navSections.map((section) => {
        const items = filterNavItems(section.items, role);
        if (items.length === 0) return null;

        return (
          <div key={section.label}>
            <div className="app-section-label">{section.label}</div>
            <div className="space-y-1.5">
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
                    className={`app-nav-link ${active ? "app-nav-link-active" : ""}`}
                  >
                    {item.icon ? <item.icon className="h-3.5 w-3.5 opacity-80" /> : <span className="h-2 w-2 rounded-full bg-current opacity-60" />}
                    <span>{item.label}</span>
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
