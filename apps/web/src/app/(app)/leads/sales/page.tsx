"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { getLocalDateString } from "@/lib/attendance-date";

type SaleLead = {
  id: number;
  type: string;
  clientName: string;
  phone: string | null;
  email: string | null;
  departmentId: number | null;
  assignedUserId: number | null;
  saleAmount: string | null;
  servicePurchased: string | null;
  dateOfSale: string | null;
  notes: string | null;
  status: string;
  createdAt: string | null;
};

type Department = { id: number; name: string };
type UserRow = { id: number; name: string; email: string };

const STATUS_OPTIONS = ["Closed", "Pending", "Refunded"] as const;

export default function SalesLeadsPage() {
  const [leads, setLeads] = useState<SaleLead[]>([]);
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
  const [departmentId, setDepartmentId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  const [servicePurchased, setServicePurchased] = useState("");
  const [saleDate, setSaleDate] = useState(() => getLocalDateString());
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("Closed");
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
      const res = await fetch(`/api/leads/sales?${params.toString()}`, {
        credentials: "same-origin"
      });
      if (!res.ok) {
        setError(
          res.status === 401
            ? "Sign in to view sales leads."
            : "Unable to load sales leads."
        );
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
  }, []);

  const deptName = (id: number | null) =>
    id == null
      ? "—"
      : departments.find((d) => d.id === id)?.name ?? `#${id}`;

  const userName = (id: number | null) =>
    id == null
      ? "—"
      : users.find((u) => u.id === id)?.name ?? `#${id}`;

  const totalSales = leads.reduce((sum, lead) => {
    const amount = lead.saleAmount ? Number(lead.saleAmount) : 0;
    return sum + (Number.isNaN(amount) ? 0 : amount);
  }, 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const amountNum = saleAmount.trim() ? Number(saleAmount) : undefined;
      if (
        saleAmount.trim() &&
        (Number.isNaN(amountNum) || (amountNum != null && amountNum < 0))
      ) {
        setError("Enter a valid sale amount.");
        setSaving(false);
        return;
      }

      const body: Record<string, unknown> = {
        clientName: clientName.trim(),
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        servicePurchased: servicePurchased.trim() || undefined,
        notes: notes.trim() || undefined,
        saleDate: saleDate || undefined,
        status
      };
      if (amountNum != null && !Number.isNaN(amountNum)) {
        body.saleAmount = amountNum;
      }
      if (departmentId) body.departmentId = Number(departmentId);
      else body.departmentId = null;
      if (assignedUserId) body.assignedUserId = Number(assignedUserId);
      else body.assignedUserId = null;

      const res = await fetch("/api/leads/sales", {
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
            : "Could not save sale lead."
        );
        setSaving(false);
        return;
      }
      setSuccess("Sale lead saved.");
      setClientName("");
      setPhone("");
      setEmail("");
      setDepartmentId("");
      setAssignedUserId("");
      setSaleAmount("");
      setServicePurchased("");
      setSaleDate(getLocalDateString());
      setStatus("Closed");
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
        <h1 className="text-2xl font-semibold text-slate-900">Sales leads</h1>
        <p className="mt-1 text-sm text-slate-600">
          Closed revenue in the unified <code className="text-xs">leads</code>{" "}
          table (<code className="text-xs">type = sale</code>) with{" "}
          <code className="text-xs">sale_amount</code>,{" "}
          <code className="text-xs">service_purchased</code>, and{" "}
          <code className="text-xs">sale_date</code>.
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
          Record a sale (manual entry)
        </h2>
        <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={handleCreate}>
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700">
              Client name <span className="text-red-500">*</span>
            </label>
            <input
              className={`${inputClass} mt-1`}
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Phone
            </label>
            <input className={`${inputClass} mt-1`} value={phone} onChange={(e) => setPhone(e.target.value)} />
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
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Sale amount (USD)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={`${inputClass} mt-1`}
              value={saleAmount}
              onChange={(e) => setSaleAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Service purchased
            </label>
            <input
              className={`${inputClass} mt-1`}
              value={servicePurchased}
              onChange={(e) => setServicePurchased(e.target.value)}
              placeholder="Package or SKU"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-700">
              Sale date
            </label>
            <input
              type="date"
              className={`${inputClass} mt-1`}
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
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
                  {u.name}
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
              className={`${inputClass} mt-1 min-h-[80px]`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button type="submit" size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save sale lead"}
            </Button>
          </div>
        </form>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              All sales leads
            </h2>
            <div className="flex flex-wrap items-end gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search client, service…"
                className="h-9 w-44 rounded-md border border-slate-200 px-2 text-sm"
              />
              <select
                value={filterDept}
                onChange={(e) => setFilterDept(e.target.value)}
                className="h-9 rounded-md border border-slate-200 px-2 text-sm"
              >
                <option value="">All departments</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
              <select
                value={filterAssign}
                onChange={(e) => setFilterAssign(e.target.value)}
                className="h-9 rounded-md border border-slate-200 px-2 text-sm"
              >
                <option value="">All assignees</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <Button type="button" size="sm" variant="outline" onClick={() => void loadLeads()}>
                Refresh
              </Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] table-auto text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                  <th className="pb-2 text-left font-medium">Client</th>
                  <th className="pb-2 text-left font-medium">Service</th>
                  <th className="pb-2 text-left font-medium">Amount</th>
                  <th className="pb-2 text-left font-medium">Sale date</th>
                  <th className="pb-2 text-left font-medium">Dept</th>
                  <th className="pb-2 text-left font-medium">Assigned</th>
                  <th className="pb-2 text-left font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                      Loading…
                    </td>
                  </tr>
                ) : leads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-xs text-slate-500">
                      No sales leads match your filters.
                    </td>
                  </tr>
                ) : (
                  leads.map((lead) => (
                    <tr key={lead.id} className="border-b border-slate-50 last:border-b-0">
                      <td className="py-2 text-sm font-medium text-slate-900">
                        {lead.clientName}
                      </td>
                      <td className="py-2 text-xs text-slate-600">
                        {lead.servicePurchased || "—"}
                      </td>
                      <td className="py-2 text-xs text-slate-700">
                        {lead.saleAmount
                          ? Number(lead.saleAmount).toLocaleString(undefined, {
                              style: "currency",
                              currency: "USD"
                            })
                          : "—"}
                      </td>
                      <td className="py-2 text-xs text-slate-600">
                        {lead.dateOfSale
                          ? new Date(lead.dateOfSale + "T12:00:00").toLocaleDateString()
                          : "—"}
                      </td>
                      <td className="py-2 text-xs">{deptName(lead.departmentId)}</td>
                      <td className="py-2 text-xs">{userName(lead.assignedUserId)}</td>
                      <td className="py-2 text-xs font-medium">{lead.status}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Summary (current view)
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">
            {totalSales.toLocaleString(undefined, {
              style: "currency",
              currency: "USD"
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Sum of amounts for sales leads shown in the table.
          </p>
        </div>
      </div>
    </div>
  );
}
