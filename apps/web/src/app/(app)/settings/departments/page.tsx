import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";

async function createDepartment(formData: FormData) {
  "use server";
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (!name) return;
  await db.insert(schema.departments).values({
    name,
    description: description || null
  });
  revalidatePath("/settings/departments");
}

export default async function DepartmentsPage() {
  const departments = await db
    .select()
    .from(schema.departments)
    .orderBy(schema.departments.name);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Departments</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage brands and departments used for leads, users, and reports.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr,1.2fr]">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium text-slate-900">
            Existing departments
          </div>
          <table className="w-full table-auto text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase text-slate-500">
                <th className="pb-2 text-left">Name</th>
                <th className="pb-2 text-left">Description</th>
              </tr>
            </thead>
            <tbody>
              {departments.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="py-4 text-center text-xs text-slate-500"
                  >
                    No departments yet. Create your first one on the right.
                  </td>
                </tr>
              ) : (
                departments.map((dept) => (
                  <tr
                    key={dept.id}
                    className="border-b border-slate-50 last:border-b-0"
                  >
                    <td className="py-2 text-sm text-slate-900">{dept.name}</td>
                    <td className="py-2 text-xs text-slate-600">
                      {dept.description || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 text-sm font-medium text-slate-900">
            Add department
          </div>
          <form action={createDepartment} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Name
              </label>
              <input
                name="name"
                className="block w-full rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="ResumePro"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="block w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                placeholder="Short description of the department or brand."
              />
            </div>
            <Button type="submit" className="w-full">
              Save department
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

