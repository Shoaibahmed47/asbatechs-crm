"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-fetch";
import { LogOut } from "lucide-react";

export function ClientPortalLogout() {
  const router = useRouter();

  async function logout() {
    await apiFetch.post("/api/auth/client-logout", {});
    router.push("/client/login");
    router.refresh();
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="ml-1 gap-2 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800 hover:text-white"
      onClick={() => void logout()}
    >
      <LogOut className="h-4 w-4" />
      Sign out
    </Button>
  );
}
