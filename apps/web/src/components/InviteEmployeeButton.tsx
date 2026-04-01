"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";

type Department = {
  id: number;
  name: string;
};

export function InviteEmployeeButton() {
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const data = await apiFetch<{ departments?: Department[] }>("/api/departments");
        const cleanedDepartments = (data?.departments ?? []).filter(
          (department: Department) =>
            typeof department?.name === "string" &&
            department.name.trim().length > 0 &&
            department.name.trim().toLowerCase() !== "null"
        );
        setDepartments(cleanedDepartments);
      } catch {
        setDepartments([]);
      }
    }

    if (open) {
      void loadDepartments();
    }
  }, [open]);

  function resetState() {
    setError(null);
    setCanResend(false);
  }

  async function sendInvitation(action: "invite" | "resend") {
    setLoading(true);
    setError(null);

    try {
      await apiFetch.post("/api/admin/employees", {
          email,
          departmentId: departmentId ? Number(departmentId) : null,
          action
      });

      setCanResend(false);
      setLoading(false);
      toast.success(
        action === "resend" ? "Invitation resent" : "Invitation sent",
        { description: email }
      );
      setOpen(false);
      setEmail("");
      setFirstName("");
      setLastName("");
      setDepartmentId("");
      resetState();
    } catch (error) {
      if (error instanceof ApiFetchError) {
        if (
          error.status === 409 &&
          typeof error.details === "object" &&
          error.details &&
          "code" in (error.details as Record<string, unknown>) &&
          (error.details as Record<string, unknown>).code === "EMAIL_ALREADY_ADDED"
        ) {
          setCanResend(
            Boolean((error.details as Record<string, unknown>).canResend)
          );
        }
        setError(error.message);
      } else {
        toast.error("Something went wrong. Please try again.");
      }
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetState();

    if (!email) {
      toast.error("Email is required.");
      return;
    }

    await sendInvitation("invite");
  }

  async function handleResend() {
    resetState();
    if (!email) {
      toast.error("Email is required.");
      return;
    }
    await sendInvitation("resend");
  }

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setOpen(true);
          resetState();
        }}
      >
        Invite employee
      </Button>

      {mounted &&
        open &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex min-h-[100dvh] items-center justify-center overflow-y-auto bg-slate-950/65 px-4 py-8 backdrop-blur-md sm:px-6 sm:py-10 dark:bg-slate-950/75"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setOpen(false);
            }}
          >
            <div
              className="my-auto w-full max-w-2xl overflow-hidden rounded-[28px] border border-slate-200/90 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.25)] dark:border-slate-700 dark:bg-slate-950"
              role="dialog"
              aria-modal="true"
              aria-labelledby="invite-employee-title"
              onClick={(e) => e.stopPropagation()}
            >
            <div className="flex items-start justify-between border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                  Employee onboarding
                </div>
                <h2
                  id="invite-employee-title"
                  className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white"
                >
                  Invite new employee
                </h2>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                  Send a secure invitation and assign the employee to the correct department.
                </p>
              </div>
              <button
                type="button"
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-6">
              {error && (
                <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
                  {error}
                </div>
              )}
              <form className="space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input"
                    placeholder="employee@example.com"
                    required
                  />
                </div>

                <div className="grid gap-5 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      First name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="form-input"
                      placeholder="John"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                      Last name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="form-input"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                    Department
                  </label>
                  <select
                    value={departmentId}
                    onChange={(e) => setDepartmentId(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select department</option>
                    {departments.map((department) => (
                      <option key={department.id} value={department.id}>
                        {department.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap justify-end gap-3 pt-2">
                  {canResend && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleResend}
                      disabled={loading}
                    >
                      {loading ? "Resending..." : "Resend invitation"}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setOpen(false);
                      resetState();
                    }}
                    disabled={loading}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? "Sending..." : "Send invitation"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>,
          document.body
        )}
    </>
  );
}
