import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type DashboardStatCardProps = {
  title: string;
  value: ReactNode;
  description?: string;
  icon: ReactNode;
  tone?: "mint" | "teal" | "orange" | "gold";
  className?: string;
  children?: ReactNode;
};

const toneClass: Record<NonNullable<DashboardStatCardProps["tone"]>, string> = {
  mint: "portal-stat-card--mint",
  teal: "portal-stat-card--teal",
  orange: "portal-stat-card--orange",
  gold: "portal-stat-card--gold"
};

const labelClass: Record<NonNullable<DashboardStatCardProps["tone"]>, string> = {
  mint: "portal-stat-label--teal",
  teal: "portal-stat-label--teal",
  orange: "portal-stat-label--orange",
  gold: "portal-stat-label--gold"
};

const valueClass: Record<NonNullable<DashboardStatCardProps["tone"]>, string> = {
  mint: "portal-stat-value--teal",
  teal: "portal-stat-value--teal",
  orange: "portal-stat-value--orange",
  gold: "portal-stat-value--gold"
};

/**
 * Partner-style KPI card — icon + label + value. Presentation only.
 */
export function DashboardStatCard({
  title,
  value,
  description,
  icon,
  tone = "teal",
  className,
  children
}: DashboardStatCardProps) {
  return (
    <div className={cn("portal-stat-card", toneClass[tone], className)}>
      <div className="portal-stat-card-body">
        <div className="portal-stat-card-row">
          <div className="min-w-0">
            <div className={cn("portal-stat-label", labelClass[tone])}>{title}</div>
            <div className={cn("portal-stat-value", valueClass[tone])}>{value}</div>
            {description ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 sm:text-sm">
                {description}
              </p>
            ) : null}
            {children}
          </div>
          <div className="portal-stat-icon" aria-hidden>
            {icon}
          </div>
        </div>
      </div>
    </div>
  );
}
