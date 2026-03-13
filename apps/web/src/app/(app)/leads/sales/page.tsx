"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type SaleLead = {
  id: number;
  clientName: string;
  phone: string | null;
  email: string | null;
  departmentId: number | null;
  assignedUserId: number | null;
  saleAmount: string | null;
  servicePurchased: string | null;
  dateOfSale: string | null;
};

export default function SalesLeadsPage() {
  const [leads, setLeads] = useState<SaleLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  async function loadLeads() {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      const res = await fetch(`/api/leads/sales?${params.toString()}`);
      if (!res.ok) {
        setError("Unable to load sales leads.");
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalSales = leads.reduce((sum, lead) => {
    const amount = lead.saleAmount ? Number(lead.saleAmount) : 0;
    return sum + (Number.isNaN(amount) ? 0 : amount);
  }, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Sales leads</h1>
          <p className="mt-1 text-sm text-slate-600">
            Track closed sales with revenue and services.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by client..."
            className="h-9 rounded-md border border-slate-200 px-3 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
          />
          <Button size="sm" variant="outline" onClick={loadLeads}>
            Search
          </Button>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-[2fr,1fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="pb-2 text-left">Client</th>
                <th className="pb-2 text-left">Service</th>
                <th className="pb-2 text-left">Amount</th>
                <th className="pb-2 text-left">Date</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-4 text-center text-xs text-slate-500"
                  >
                    Loading...
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="py-4 text-center text-xs text-slate-500"
                  >
                    No sales leads found.
                  </td>
                </tr>
              ) : (
                leads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="border-b border-slate-50 last:border-b-0"
                  >
                    <td className="py-2 text-sm text-slate-900">
                      {lead.clientName}
                    </td>
                    <td className="py-2 text-xs text-slate-600">
                      {lead.servicePurchased || "—"}
                    </td>
                    <td className="py-2 text-xs text-slate-700">
                      {lead.saleAmount ? Number(lead.saleAmount).toFixed(2) : "0.00"}
                    </td>
                    <td className="py-2 text-xs text-slate-600">
                      {lead.dateOfSale
                        ? new Date(lead.dateOfSale).toLocaleDateString()
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold uppercase text-slate-500">
            Summary
          </div>
          <div className="mt-3 text-2xl font-semibold text-slate-900">
            {totalSales.toLocaleString(undefined, {
              style: "currency",
              currency: "USD"
            })}
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Total recorded sales amount from all leads in the current view.
          </p>
        </div>
      </div>
    </div>
  );
}

