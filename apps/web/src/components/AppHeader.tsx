"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronDown,
  LayoutDashboard,
  LogOut,
  MoonStar,
  SunMedium,
  UserCircle
} from "lucide-react";
import { apiFetch } from "@/lib/api-fetch";
import { cn } from "@/lib/utils";

const MENU_WIDTH_PX = 272;

type MeUser = {
  name: string;
  email: string;
  role: string;
  departmentName: string | null;
};

function formatRoleLabel(role: string): string {
  if (!role) return "-";
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
}

const menuLinkClass =
  "flex cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium text-slate-900 no-underline outline-none transition-colors hover:bg-slate-100 dark:text-slate-100 dark:hover:bg-slate-800";

export function AppHeaderUser() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [me, setMe] = useState<MeUser | null>(null);
  const [accountOpen, setAccountOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem("crm-theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    root.classList.toggle("dark", initial === "dark");
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch.get<{ user: MeUser | null }>("/api/auth/me");
        if (!cancelled && res.user) {
          setMe(res.user);
        }
      } catch {
        /* header stays in fallback state */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAccountOpen(false);
  }, [pathname]);

  const updateMenuPosition = () => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(Math.max(8, rect.right - MENU_WIDTH_PX), window.innerWidth - MENU_WIDTH_PX - 8);
    setMenuPos({
      top: rect.bottom + 8,
      left
    });
  };

  useLayoutEffect(() => {
    if (!accountOpen) {
      setMenuPos(null);
      return;
    }
    updateMenuPosition();
    const onReposition = () => updateMenuPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [accountOpen]);

  useEffect(() => {
    if (!accountOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setAccountOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAccountOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [accountOpen]);

  function setThemeMode(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("crm-theme", nextTheme);
  }

  async function handleLogout() {
    setAccountOpen(false);
    try {
      await apiFetch.post("/api/auth/logout");
    } finally {
      router.push("/login");
    }
  }

  const accountMenu =
    accountOpen && mounted && menuPos
      ? createPortal(
          <div
            ref={menuRef}
            className="fixed z-[9999] box-border rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl ring-1 ring-black/5 dark:border-slate-600 dark:bg-slate-900 dark:ring-white/10"
            style={{
              top: menuPos.top,
              left: menuPos.left,
              width: MENU_WIDTH_PX
            }}
            role="menu"
            aria-orientation="vertical"
          >
            <div className="border-b border-slate-100 px-2.5 pb-2.5 pt-1 dark:border-slate-700">
              <div className="truncate text-sm font-semibold text-slate-950 dark:text-white">
                {me?.name ?? "Account"}
              </div>
              {me?.email ? (
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">{me.email}</div>
              ) : null}
              {me ? (
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {me.departmentName ?? "No department"} | {formatRoleLabel(me.role)}
                </div>
              ) : null}
            </div>
            <div className="py-1">
              <Link href="/dashboard" className={menuLinkClass} role="menuitem" onClick={() => setAccountOpen(false)}>
                <LayoutDashboard className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                Dashboard
              </Link>
              <Link href="/account" className={menuLinkClass} role="menuitem" onClick={() => setAccountOpen(false)}>
                <UserCircle className="h-4 w-4 shrink-0 text-slate-500 dark:text-slate-400" />
                Profile
              </Link>
            </div>
            <div className="border-t border-slate-100 pt-1 dark:border-slate-700">
              <button
                type="button"
                className={cn(
                  menuLinkClass,
                  "w-full border-0 bg-transparent text-left text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/50"
                )}
                role="menuitem"
                onClick={() => void handleLogout()}
              >
                <LogOut className="h-4 w-4 shrink-0 opacity-80" />
                Log out
              </button>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      {accountMenu}

      <div className="hidden text-right sm:block">
        <div className="text-sm font-semibold text-slate-950 dark:text-white">{me?.name ?? "Current user"}</div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          {me ? `${me.departmentName ?? "No department"} | ${formatRoleLabel(me.role)}` : "Department | Role"}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-2xl border border-slate-200/80 bg-white/85 p-1 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/85">
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
              theme === "light"
                ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            onClick={() => setThemeMode("light")}
          >
            <SunMedium className="h-3.5 w-3.5" />
            Light
          </button>
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition-all duration-200 ${
              theme === "dark"
                ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
            onClick={() => setThemeMode("dark")}
          >
            <MoonStar className="h-3.5 w-3.5" />
            Dark
          </button>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white/85 px-2 py-1.5 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/85">
          <button
            ref={triggerRef}
            type="button"
            className={cn(
              "flex items-center gap-2 rounded-xl px-2 py-1 text-left transition",
              "hover:bg-slate-100/80 dark:hover:bg-slate-800/80",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400/40 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-slate-500/50 dark:focus-visible:ring-offset-slate-900"
            )}
            aria-label={me ? "Open account menu" : "Account menu"}
            aria-expanded={accountOpen}
            aria-haspopup="menu"
            onClick={() => setAccountOpen((o) => !o)}
          >
            <Image
              src="/brand-icon.png"
              alt=""
              width={40}
              height={40}
              className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-slate-200/80 dark:ring-slate-600"
              aria-hidden
            />
            <ChevronDown
              className={cn(
                "h-4 w-4 shrink-0 text-slate-500 transition-transform dark:text-slate-400",
                accountOpen && "rotate-180"
              )}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </div>
  );
}
