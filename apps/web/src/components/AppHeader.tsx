"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

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
      await fetch("/api/auth/logout", {
        method: "POST"
      });
    } finally {
      router.push("/login");
    }
  }

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="hidden flex-col text-right md:flex dark:text-slate-100">
        <span className="font-medium text-slate-900 dark:text-slate-100">Current user</span>
        <span className="text-slate-500 dark:text-slate-400">Department · Role</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center rounded-md border border-slate-300 bg-white p-0.5 dark:border-slate-600 dark:bg-slate-800">
          <button
            type="button"
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              theme === "light"
                ? "bg-slate-900 text-white"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
            onClick={() => setThemeMode("light")}
          >
            Light
          </button>
          <button
            type="button"
            className={`rounded px-2 py-1 text-[11px] font-medium ${
              theme === "dark"
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700"
            }`}
            onClick={() => setThemeMode("dark")}
          >
            Dark
          </button>
        </div>
        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-700" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
          onClick={handleLogout}
        >
          Log out
        </Button>
      </div>
    </div>
  );
}

