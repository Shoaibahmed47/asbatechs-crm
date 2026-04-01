"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";

export function AppHeaderUser() {
  const router = useRouter();
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem("crm-theme");
    const initial = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    root.classList.toggle("dark", initial === "dark");
  }, []);

  function setThemeMode(nextTheme: "light" | "dark") {
    setTheme(nextTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("crm-theme", nextTheme);
  }

  async function handleLogout() {
    try {
      await apiFetch.post("/api/auth/logout");
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex flex-col items-stretch gap-3 sm:items-end">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-semibold text-slate-950 dark:text-white">
          Current user
        </div>
        <div className="text-xs text-slate-500 dark:text-slate-400">
          Department · Role
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center rounded-2xl border border-slate-200/80 bg-white/80 p-1 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
          <button
            type="button"
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
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
            className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
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

        <div className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-3 py-2 shadow-sm dark:border-slate-700/80 dark:bg-slate-900/80">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[linear-gradient(135deg,#0f172a,#2563eb)] text-sm font-semibold text-white">
            AU
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-xl"
            onClick={handleLogout}
          >
            Log out
          </Button>
        </div>
      </div>
    </div>
  );
}
