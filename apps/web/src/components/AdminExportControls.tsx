"use client";

import { useCallback, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminSnapshot } from "@/lib/admin-snapshot-types";
import { adminSnapshotToCsv } from "@/lib/admin-export-csv";

type JspdfWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

export function AdminExportControls({ snapshot }: { snapshot: AdminSnapshot }) {
  const [busy, setBusy] = useState(false);

  const downloadCsv = useCallback(() => {
    const csv = adminSnapshotToCsv(snapshot);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `crm-admin-export-${snapshot.generatedAt.slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [snapshot]);

  const downloadPdf = useCallback(() => {
    setBusy(true);
    try {
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      });

      let y = 12;
      doc.setFontSize(14);
      doc.text("AsbaTechs CRM — Admin export", 14, y);
      y += 7;
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Generated: ${snapshot.generatedAt}`, 14, y);
      doc.setTextColor(0, 0, 0);
      y += 10;

      const afterTable = () => {
        const d = doc as JspdfWithTable;
        y = (d.lastAutoTable?.finalY ?? y) + 8;
      };

      autoTable(doc, {
        startY: y,
        head: [["Metric", "Count"]],
        body: [
          ["Departments", snapshot.stats.departments],
          ["Users", snapshot.stats.users],
          ["Hot leads", snapshot.stats.hotLeads],
          ["Sale leads", snapshot.stats.saleLeads],
          ["Pending invites", snapshot.stats.pendingInvites]
        ],
        styles: { fontSize: 8 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 }
      });
      afterTable();

      autoTable(doc, {
        startY: y,
        head: [["ID", "Name", "Description"]],
        body: snapshot.departments.map((d) => [
          d.id,
          d.name,
          (d.description ?? "").slice(0, 80)
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 },
        tableWidth: "auto",
        showHead: "firstPage"
      });
      afterTable();

      autoTable(doc, {
        startY: y,
        head: [["ID", "Name", "Email", "Role", "Department", "Invite"]],
        body: snapshot.users.map((u) => [
          u.id,
          u.name,
          u.email,
          u.role,
          u.departmentName ?? "",
          u.inviteStatus
        ]),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 }
      });
      afterTable();

      if (snapshot.pendingInvites.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["Email", "Department", "Created"]],
          body: snapshot.pendingInvites.map((i) => [
            i.email,
            i.departmentName ?? "",
            i.createdAt ?? ""
          ]),
          styles: { fontSize: 7 },
          headStyles: { fillColor: [71, 85, 105] },
          margin: { left: 14, right: 14 }
        });
        afterTable();
      }

      autoTable(doc, {
        startY: y,
        head: [
          [
            "ID",
            "Type",
            "Client",
            "Email",
            "Dept",
            "Assignee",
            "Status",
            "Sale",
            "Sale date"
          ]
        ],
        body: snapshot.leads.map((l) => [
          l.id,
          l.type,
          l.clientName.slice(0, 28),
          (l.email ?? "").slice(0, 28),
          (l.departmentName ?? "").slice(0, 14),
          (l.assignedUserName ?? "").slice(0, 14),
          l.status,
          l.saleAmount ?? "",
          l.saleDate ?? ""
        ]),
        styles: { fontSize: 6 },
        headStyles: { fillColor: [71, 85, 105] },
        margin: { left: 14, right: 14 }
      });
      afterTable();

      if (snapshot.recentActivity.length > 0) {
        autoTable(doc, {
          startY: y,
          head: [["When", "User", "Action", "Entity", "ID"]],
          body: snapshot.recentActivity.map((a) => [
            a.createdAt ?? "",
            a.actorName.slice(0, 22),
            a.action.slice(0, 28),
            a.entityType,
            a.entityId
          ]),
          styles: { fontSize: 6 },
          headStyles: { fillColor: [71, 85, 105] },
          margin: { left: 14, right: 14 }
        });
      }

      doc.save(
        `crm-admin-export-${snapshot.generatedAt.slice(0, 10)}.pdf`
      );
    } finally {
      setBusy(false);
    }
  }, [snapshot]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-sm"
        onClick={downloadCsv}
      >
        <FileDown className="h-3.5 w-3.5" />
        Export CSV
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5 text-sm"
        disabled={busy}
        onClick={downloadPdf}
      >
        <FileDown className="h-3.5 w-3.5" />
        Export PDF
      </Button>
    </div>
  );
}
