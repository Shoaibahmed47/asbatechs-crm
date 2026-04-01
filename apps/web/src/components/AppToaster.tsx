"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

export function AppToaster() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const root = document.documentElement;
    const sync = () =>
      setTheme(root.classList.contains("dark") ? "dark" : "light");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      closeButton
      duration={4200}
      expand
      visibleToasts={4}
      toastOptions={{
        classNames: {
          toast:
            "group toast app-toast !rounded-2xl !border !p-4 !gap-3 !text-[0.875rem]",
          title: "!text-[0.9375rem] !font-semibold !leading-snug",
          description: "!text-[0.8125rem] !leading-relaxed !opacity-90"
        }
      }}
    />
  );
}
