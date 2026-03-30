"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type HotLead = {
  id: number;
  type: "hot";
  clientName: string;
  phone: string | null;
  email: string | null;
  source: string | null;
  departmentId: number | null;
  assignedUserId: number | null;
  status: string;
  notes: string | null;
  createdAt: string | null;
};

type Department = { id: number; name: string };
type UserRow = { id: number; name: string; email: string };

const STATUS_OPTIONS = ["New", "Contacted", "Follow Up", "Closed"] as const;

export default function HotLeadsPage() {
  const [leads, setLeads] = useState<HotLead[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState("");
  const [filterAssign, setFilterAssign] = useState("");

  const [clientName, setClientName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [source, setSource] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("New");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    async function loadMeta() {
      try {
        const [dRes, uRes] = await Promise.all([
          fetch("/api/departments", { credentials: "same-origin" }),
          fetch("/api/users", { credentials: "same-origin" })
        ]);
        if (dRes.ok) {
          const d = await dRes.json();
          setDepartments(d.departments ?? []);
        }
        if (uRes.ok) {
          const u = await uRes.json();
          setUsers(u.users ?? []);
        }
      } catch {
        setDepartments([]);
        setUsers([]);
      }
    }
    void loadMeta();
  }, []);

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (filterDept) params.set("departmentId", filterDept);
      if (filterAssign) params.set("assignedUserId", filterAssign);
      const res = await fetch(`/api/leads/hot?${params.toString()}`, {
        credentials: "same-origin"
      });
      if (!res.ok) {
        if (res.status === 401) {
          setError("Sign in to view hot leads.");
        } else {
          setError("Unable to load hot leads.");
        }
        setLoading(false);
        return;
      }
      const data = await res.json();
      setLeads(data.leads ?? []);
    } catch {
      setError("Something went wrong while loading leads.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLeads();
    // Initial load only; filters use Refresh
  }, []);

  const deptName = (id: number | null) =>
    id == null
      ? "—"
      : departments.find((d) => d.id === id)?.name ?? `#${id}`;

  const userName = (id: number | null) =>
    id == null
      ? "—"
      : users.find((u) => u.id === id)?.name ?? `#${id}`;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const body: Record<string, unknown> = {
        clientName: clientName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        source: source.trim() || undefined,
        status,
        notes: notes.trim() || undefined
      };
      if (departmentId) body.departmentId = Number(departmentId);
      else body.departmentId = null;
      if (assignedUserId) body.assignedUserId = Number(assignedUserId);
      else body.assignedUserId = null;

      const res = await fetch("/api/leads/hot", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof data?.error === "string"
            ? data.error
            : "Could not save lead. Check required fields."
        );
        setSaving(false);
        return;
      }
      setSuccess("Hot lead saved.");
      setClientName("");
      setPhone("");
      setEmail("");
      setSource("");
      setDepartmentId("");
      setAssignedUserId("");
      setStatus("New");
      setNotes("");
      await loadLeads();
    } catch {
      setError("Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Hot leads</h1>
        <p className="mt-1 text-sm text-slate-600">
          Potential clients (type: <span className="font-medium">hot</span>).
          Rows live in the unified <code className="text-xs">leads</code> table
          with <code className="text-xs">type = hot</code>.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          {success}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Add hot lead (manual entry)
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Required: client name. Optional: phone, email, source, department,
          assignee, notes.
        </p>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700">
              Client name <span className="text-red-500">*</span>
            </label>
            <input
              className={`${inputClass} mt-1`}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Company or contact name"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Phone
            </label>
            <input
              className={`${inputClass} mt-1`}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 …"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Email
            </label>
            <input
              type="email"
              className={`${inputClass} mt-1`}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Source
            </label>
            <input
              className={`${inputClass} mt-1`}
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="Referral, website, event…"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Department
            </label>
            <select
              className={`${inputClass} mt-1`}
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Assigned user
            </label>
            <select
              className={`${inputClass} mt-1`}
              value={assignedUserId}
              onChange={(e) => setAssignedUserId(e.target.value)}
            >
              <option value="">Auto assign (round robin)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Status
            </label>
            <select
              className={`${inputClass} mt-1`}
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])
              }
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700">
              Notes
            </label>
            <textarea
              className={`${inputClass} mt-1 min-h-[88px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Context, next step, objections…"
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save hot lead"}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          <h2 className="text-sm font-semibold text-slate-900">All hot leads</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500">
                Search
              </label>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Name, phone, email…"
                className="h-9 w-44 rounded-md border border-slate-200 px-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500">
                Department
              </label>
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="h-9 min-w-[8rem] rounded-md border border-slate-200 px-2 text-sm"
              >
                <option value="">All</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium uppercase text-slate-500">
                Assigned
              </label>
              <select
                value={filterAssign}
                onChange={(e) => setFilterAssign(e.target.value)}
                className="h-9 min-w-[8rem] rounded-md border border-slate-200 px-2 text-sm"
              >
                <option value="">All</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void loadLeads()}
            >
              Refresh
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] table-auto text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="pb-2 text-left font-medium">Client</th>
                <th className="pb-2 text-left font-medium">Phone</th>
                <th className="pb-2 text-left font-medium">Email</th>
                <th className="pb-2 text-left font-medium">Source</th>
                <th className="pb-2 text-left font-medium">Department</th>
                <th className="pb-2 text-left font-medium">Assigned</th>
                <th className="pb-2 text-left font-medium">Status</th>
                <th className="pb-2 text-left font-medium">Notes</th>
                <th className="pb-2 text-left font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-6 text-center text-xs text-slate-500"
                  >
                    Loading…
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="py-6 text-center text-xs text-slate-500"
                  >
                    No hot leads match your filters.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-50 last:border-b-0"
                  >
                    <td className="py-2.5 text-sm font-medium text-slate-900">
                      {lead.clientName}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600">
                      {lead.phone || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600">
                      {lead.email || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-600">
                      {lead.source || "—"}
                    </td>
                    <td className="py-2.5 text-xs text-slate-700">
                      {deptName(lead.departmentId)}
                    </td>
                    <td className="py-2.5 text-xs text-slate-700">
                      {userName(lead.assignedUserId)}
                    </td>
                    <td className="py-2.5 text-xs font-medium text-slate-800">
                      {lead.status}
                    </td>
                    <td className="max-w-[140px] truncate py-2.5 text-xs text-slate-600" title={lead.notes ?? ""}>
                      {lead.notes || "—"}
                    </td>
                    <td className="whitespace-nowrap py-2.5 text-xs text-slate-500">
                      {lead.createdAt
                        ? new Date(lead.createdAt).toLocaleString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
