"use client";

import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";

function clearInteractionLocks() {
  document.body.style.removeProperty("pointer-events");
  document.documentElement.style.removeProperty("pointer-events");
  document.body.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("overflow");
}

/**
 * Radix modal menus / scroll lock can leave `pointer-events: none` or `overflow: hidden` on
 * `body` if cleanup does not run. Clears those on navigation and after paint.
 */
export function BodyPointerEventsGuard() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    clearInteractionLocks();
    const t = requestAnimationFrame(() => clearInteractionLocks());
    return () => cancelAnimationFrame(t);
  }, [pathname]);

  useEffect(() => {
    clearInteractionLocks();
  }, [pathname]);

  useEffect(() => {
    return () => {
      clearInteractionLocks();
    };
  }, []);

  return null;
}
