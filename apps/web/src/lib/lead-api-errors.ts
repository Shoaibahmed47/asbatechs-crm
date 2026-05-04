import type { ZodError } from "zod";

const FIELD_LABELS: Record<string, string> = {
  clientName: "Client name",
  email: "Email",
  phone: "Phone",
  source: "Source",
  departmentId: "Department",
  assignedUserId: "Assigned user",
  status: "Stage",
  notes: "Notes",
  saleAmount: "Sale amount",
  servicePurchased: "Service purchased",
  saleDate: "Sale date"
};

/**
 * Turn Zod validation into one readable sentence for toasts and API `error` text.
 */
export function leadValidationUserMessage(error: ZodError): string {
  const flat = error.flatten();
  const parts: string[] = [];

  for (const [key, msgs] of Object.entries(flat.fieldErrors)) {
    if (!msgs?.length) continue;
    const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ");
    const cleaned = msgs.map((m) => m.replace(/^Invalid /i, "").trim()).join("; ");
    parts.push(`${label}: ${cleaned}`);
  }

  for (const fe of flat.formErrors) {
    if (fe.trim()) parts.push(fe);
  }

  return parts.length > 0
    ? parts.join(" · ")
    : "Please check the form fields and try again.";
}

/** Map common lead API failures to clear copy (English). */
export function leadPermissionUserMessage(
  status: number,
  rawMessage: string
): string {
  if (status === 401) {
    return "You are not signed in. Please log in again.";
  }
  if (status === 404) {
    return "This lead was not found or may have been removed.";
  }
  if (status === 409) {
    return rawMessage || "This action is not allowed for this lead.";
  }
  if (status !== 403) {
    return rawMessage || "Something went wrong. Please try again.";
  }

  const m = (rawMessage ?? "").trim();
  if (!m || m.toLowerCase() === "forbidden") {
    return "You are not allowed to save this lead. If you are an employee: use your own department, assign only to yourself (or use Auto assign), and ask an admin if your profile has no department.";
  }
  return m;
}
