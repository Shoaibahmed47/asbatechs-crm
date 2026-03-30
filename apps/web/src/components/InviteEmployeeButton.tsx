"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type Department = {
  id: number;
  name: string;
};

export function InviteEmployeeButton() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [departmentId, setDepartmentId] = useState<string>("");
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    async function loadDepartments() {
      try {
        const res = await fetch("/api/departments");
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
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
    setSuccess(null);
    setCanResend(false);
  }

  async function sendInvitation(action: "invite" | "resend") {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/admin/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          departmentId: departmentId ? Number(departmentId) : null,
          action
        })
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 403) {
          setError("Only admins can invite employees.");
        } else if (res.status === 409 && data?.code === "EMAIL_ALREADY_ADDED") {
          setError("This email is already added");
          setCanResend(Boolean(data?.canResend));
        } else {
          setError(data?.error ?? "Unable to send invitation.");
        }
        setLoading(false);
        return;
      }

      setSuccess(
        action === "resend" ? "Invitation resent successfully." : "Invitation sent successfully."
      );
      setCanResend(false);
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    resetState();

    if (!email) {
      setError("Email is required.");
      return;
    }

    await sendInvitation("invite");
  }

  async function handleResend() {
    resetState();
    if (!email) {
      setError("Email is required.");
      return;
    }
    await sendInvitation("resend");
  }

  return (
    <>
      <Button
        type="button"
        className="text-xs"
        onClick={() => {
          setOpen(true);
          resetState();
        }}
      >
        Invite employee
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-base font-semibold text-slate-900">
                Add New Employee
              </h2>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            {error && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                {success}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  placeholder="employee@example.com"
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    First name
                  </label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="John"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-xs font-medium text-slate-700">
                    Last name
                  </label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                    placeholder="Doe"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-xs font-medium text-slate-700">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Select department</option>
                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex justify-end gap-2 text-xs">
                {canResend && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleResend}
                    disabled={loading}
                  >
                    {loading ? "Resending..." : "Resend Invitation"}
                  </Button>
                )}
                <button
                  type="button"
                  className="rounded-md border border-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-50"
                  onClick={() => {
                    setOpen(false);
                    resetState();
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Sending..." : "Send Invitation"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

