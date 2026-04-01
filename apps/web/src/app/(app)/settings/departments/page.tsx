import { db } from "@/lib/db";
import { schema } from "@asbatechs-crm/database";
import { Button } from "@/components/ui/button";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";

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

async function updateDepartment(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") || "").trim();
  const description = String(formData.get("description") || "").trim();
  if (Number.isNaN(id) || !name) return;

  await db
    .update(schema.departments)
    .set({
      name,
      description: description || null
    })
    .where(eq(schema.departments.id, id));

  revalidatePath("/settings/departments");
}

async function deleteDepartment(formData: FormData) {
  "use server";
  const id = Number(formData.get("id"));
  if (Number.isNaN(id)) return;

  await db.delete(schema.departments).where(eq(schema.departments.id, id));
  revalidatePath("/settings/departments");
}

export default async function DepartmentsPage() {
  const allDepartments = await db
    .select()
    .from(schema.departments)
    .orderBy(schema.departments.name);

  const departments = allDepartments.filter(
    (dept) => dept.name && dept.name.toLowerCase() !== "null"
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-100">
          Departments
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Manage brands and departments used for leads, users, and reports.
        </p>
      </div>
      <div className="grid gap-6 md:grid-cols-[2fr,1.2fr]">
        <div className="data-card p-4">
          <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            Existing departments
          </div>
          <div className="space-y-3">
            {departments.length === 0 ? (
              <div className="py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                No departments yet. Create your first one on the right.
              </div>
            ) : (
              departments.map((dept) => (
                <form
                  key={dept.id}
                  action={updateDepartment}
                  className="grid gap-3 rounded-lg border border-slate-200/80 p-3 md:grid-cols-[1fr,1.4fr,auto] dark:border-slate-700/80"
                >
                  <input type="hidden" name="id" value={dept.id} />
                  <input
                    name="name"
                    defaultValue={dept.name}
                    className="form-input py-2 text-sm"
                    required
                  />
                  <textarea
                    name="description"
                    defaultValue={dept.description ?? ""}
                    rows={2}
                    className="form-input resize-none py-2 text-xs"
                    placeholder="Add description"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button type="submit" size="sm" variant="outline">
                      Edit
                    </Button>
                    <button
                      type="submit"
                      formAction={deleteDepartment}
                      className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 dark:border-red-900/60 dark:text-red-300 dark:hover:bg-red-950/40"
                    >
                      Delete
                    </button>
                  </div>
                </form>
              ))
            )}
          </div>
        </div>
        <div className="data-card p-4">
          <div className="mb-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            Add department
          </div>
          <form action={createDepartment} className="space-y-4">
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                Name
              </label>
              <input
                name="name"
                className="form-input"
                placeholder="ResumePro"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                className="form-input resize-none"
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

