"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  canViewEmployeeDirectory,
  isAdminRole,
  isManagerRole
} from "@/lib/rbac";

type NavItem = { href: string; label: string };

const navSections: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Executive Dashboard" }]
  },
  {
    label: "Operations",
    items: [
      { href: "/leads/hot", label: "Hot Leads" },
      { href: "/leads/sales", label: "Sales Leads" },
      { href: "/work-updates", label: "Work Updates" },
      { href: "/attendance", label: "Attendance" },
      { href: "/attendance/report", label: "Attendance report" }
    ]
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Employees" },
      { href: "/settings/departments", label: "Departments" },
      { href: "/settings/clients", label: "Clients" },
      { href: "/admin/overview", label: "Admin Control" }
    ]
  }
];

function filterItems(items: NavItem[], role: string | undefined): NavItem[] {
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
        const items = filterItems(section.items, role);
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
                    <span className="h-2 w-2 rounded-full bg-current opacity-60" />
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
