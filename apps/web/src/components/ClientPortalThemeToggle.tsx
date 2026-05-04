"use client";

import { useEffect, useState } from "react";
import { MoonStar, SunMedium } from "lucide-react";

type ThemeMode = "light" | "dark";

export function ClientPortalThemeToggle() {
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const root = document.documentElement;
    const stored = window.localStorage.getItem("crm-theme");
    const initial: ThemeMode = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    root.classList.toggle("dark", initial === "dark");
  }, []);

  function setThemeMode(nextTheme: ThemeMode) {
    setTheme(nextTheme);
    const root = document.documentElement;
    root.classList.toggle("dark", nextTheme === "dark");
    window.localStorage.setItem("crm-theme", nextTheme);
  }

  return (
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
  );
}
