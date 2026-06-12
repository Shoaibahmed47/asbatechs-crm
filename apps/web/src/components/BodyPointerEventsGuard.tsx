"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect } from "react";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";

function stripEmployeeQueryParam(pathname: string, search: string): string | null {
  if (!search.includes("employee=")) return null;
  const next = new URLSearchParams(search);
  next.delete("employee");
  const q = next.toString();
  return q ? `${pathname}?${q}` : pathname;
}

/**
 * Radix menus / modals can leave `pointer-events: none` on `body` if cleanup does not run.
 * Also clears stale `?employee=` when Escape is used so the dashboard cannot stay dimmed.
 */
export function BodyPointerEventsGuard() {
  const pathname = usePathname();
  const router = useRouter();

  useLayoutEffect(() => {
    clearInteractionLocks();
    const nextPath = stripEmployeeQueryParam(pathname, window.location.search);
    if (nextPath) {
      router.replace(nextPath, { scroll: false });
    }
    const t = requestAnimationFrame(() => clearInteractionLocks());
    return () => cancelAnimationFrame(t);
  }, [pathname, router]);

  useEffect(() => {
    clearInteractionLocks();
  }, [pathname]);

  useEffect(() => {
    const onPointerDown = () => {
      clearInteractionLocks();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      clearInteractionLocks();
      const nextPath = stripEmployeeQueryParam(pathname, window.location.search);
      if (nextPath) {
        router.replace(nextPath, { scroll: false });
      }
    };

    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("focus", clearInteractionLocks);
    window.addEventListener("pageshow", clearInteractionLocks);
    document.addEventListener("visibilitychange", clearInteractionLocks);
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("focus", clearInteractionLocks);
      window.removeEventListener("pageshow", clearInteractionLocks);
      document.removeEventListener("visibilitychange", clearInteractionLocks);
      document.removeEventListener("keydown", onKeyDown);
      clearInteractionLocks();
    };
  }, [pathname, router]);

  return null;
}
