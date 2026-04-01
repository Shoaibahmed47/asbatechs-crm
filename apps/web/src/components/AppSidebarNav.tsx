"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navSections = [
  {
    label: "Overview",
    items: [{ href: "/dashboard", label: "Executive Dashboard" }]
  },
  {
    label: "Operations",
    items: [
      { href: "/leads/hot", label: "Hot Leads" },
      { href: "/leads/sales", label: "Sales Leads" },
      { href: "/attendance", label: "Attendance" }
    ]
  },
  {
    label: "Administration",
    items: [
      { href: "/users", label: "Employees" },
      { href: "/settings/departments", label: "Departments" },
      { href: "/admin/overview", label: "Admin Control" }
    ]
  }
];

export function AppSidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="mt-6 flex-1 space-y-6">
      {navSections.map((section) => (
        <div key={section.label}>
          <div className="app-section-label">{section.label}</div>
          <div className="space-y-1.5">
            {section.items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

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
      ))}
    </nav>
  );
}
