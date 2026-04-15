"use client";

import { useState } from "react";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

export function DeleteRegisteredClientButton({
  clientId,
  email
}: {
  clientId: number;
  email: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function onDelete() {
    if (
      !confirm(
        `Remove client ${email}? Their projects and work updates in the database will be deleted. This cannot be undone.`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await apiFetch.del(`/api/admin/clients/${clientId}`);
      router.refresh();
    } catch (e) {
      alert(e instanceof ApiFetchError ? e.message : "Could not delete client");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/40"
      disabled={busy}
      onClick={() => void onDelete()}
    >
      {busy ? "Removing…" : "Remove"}
    </Button>
  );
}
