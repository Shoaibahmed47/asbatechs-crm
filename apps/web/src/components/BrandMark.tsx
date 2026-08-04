"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
  /** Pixel size of the circle (width & height). */
  size?: number;
  title?: string;
};

/**
 * AsbaTechs monogram — deep teal disc + teal→orange “AT” (matches CRM shell/theme).
 */
export function BrandMark({ className, size = 40, title = "AsbaTechs" }: BrandMarkProps) {
  const reactId = useId().replace(/:/g, "");
  const gradientId = `brand-at-${reactId}`;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      role="img"
      aria-label={title}
    >
      <title>{title}</title>
      <defs>
        <linearGradient id={gradientId} x1="10" y1="12" x2="30" y2="28" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2d9b8a" />
          <stop offset="0.55" stopColor="#1a7a6d" />
          <stop offset="1" stopColor="#e86a17" />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill="#0f4c45" />
      <circle cx="20" cy="20" r="18.5" stroke="#1a7a6d" strokeOpacity="0.45" strokeWidth="1" fill="none" />
      <text
        x="20"
        y="21"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif"
        fontSize="15"
        fontWeight="800"
        letterSpacing="-0.04em"
        fill={`url(#${gradientId})`}
      >
        AT
      </text>
    </svg>
  );
}
