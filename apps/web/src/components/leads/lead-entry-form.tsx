"use client";

import { Button } from "@/components/ui/button";
import { ServicePurchasedTagsInput } from "@/components/leads/service-purchased-tags-input";
import type { LeadStage } from "@/lib/lead-workflow";

type Department = { id: number; name: string };
type UserRow = { id: number; name: string; email: string };
type TimezoneOption = { value: string; label: string };

type LeadEntryFormProps = {
  mode: "hot" | "sale";
  formId: string;
  title: string;
  description?: string;
  submitLabel: string;
  saving: boolean;
  departments: Department[];
  users: UserRow[];
  statusOptions: readonly LeadStage[];
  clientName: string;
  onClientNameChange: (value: string) => void;
  phone: string;
  onPhoneChange: (value: string) => void;
  email: string;
  onEmailChange: (value: string) => void;
  source: string;
  onSourceChange: (value: string) => void;
  departmentId: string;
  onDepartmentIdChange: (value: string) => void;
  assignedUserId: string;
  onAssignedUserIdChange: (value: string) => void;
  status: LeadStage;
  onStatusChange: (value: LeadStage) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  nextFollowUpAtLocal?: string;
  onNextFollowUpAtLocalChange?: (value: string) => void;
  followUpTimezone?: string;
  onFollowUpTimezoneChange?: (value: string) => void;
  timezoneOptions?: TimezoneOption[];
  showCustomTimezoneInput?: boolean;
  customTimezone?: string;
  onCustomTimezoneChange?: (value: string) => void;
  saleAmount?: string;
  onSaleAmountChange?: (value: string) => void;
  /** Sale mode: services as removable tags (stored as JSON in `service_purchased`). */
  servicePurchasedTags?: string[];
  onServicePurchasedTagsChange?: (tags: string[]) => void;
  saleDate?: string;
  onSaleDateChange?: (value: string) => void;
  onSubmit: (e: React.FormEvent) => Promise<void> | void;
  /** Extra hint below the description (e.g. employee role limits). */
  formHint?: string;
  /** When true, department cannot be changed (non-admin users tied to one department). */
  departmentLocked?: boolean;
  /** Show/hide department field. */
  showDepartment?: boolean;
  /** Optional guard to disable submit with user-facing reason. */
  submitDisabledReason?: string;
  /** Optional secondary action (e.g. cancel editing). */
  onCancel?: () => void;
  cancelLabel?: string;
  /** Optional backend validation messages keyed by field name. */
  fieldErrors?: Partial<Record<string, string>>;
};

export function LeadEntryForm({
  mode,
  formId,
  title,
  description,
  submitLabel,
  saving,
  departments,
  users,
  statusOptions,
  clientName,
  onClientNameChange,
  phone,
  onPhoneChange,
  email,
  onEmailChange,
  source,
  onSourceChange,
  departmentId,
  onDepartmentIdChange,
  assignedUserId,
  onAssignedUserIdChange,
  status,
  onStatusChange,
  notes,
  onNotesChange,
  nextFollowUpAtLocal,
  onNextFollowUpAtLocalChange,
  followUpTimezone,
  onFollowUpTimezoneChange,
  timezoneOptions,
  showCustomTimezoneInput,
  customTimezone,
  onCustomTimezoneChange,
  saleAmount,
  onSaleAmountChange,
  servicePurchasedTags,
  onServicePurchasedTagsChange,
  saleDate,
  onSaleDateChange,
  onSubmit,
  formHint,
  departmentLocked,
  showDepartment = true,
  submitDisabledReason,
  onCancel,
  cancelLabel,
  fieldErrors
}: LeadEntryFormProps) {
  const isSales = mode === "sale";

  const isSubmitDisabled = saving || !!submitDisabledReason;
  const errorFor = (field: string) => fieldErrors?.[field];
  const inputClass = (field: string) =>
    `form-input mt-1 ${errorFor(field) ? "border-red-300 ring-1 ring-red-200 dark:border-red-700 dark:ring-red-900/40" : ""}`;

  return (
    <div className="data-card p-5" id={formId}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {description ? (
        <p className="mt-1 text-base text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      {formHint ? (
        <p className="mt-2 rounded-md border border-sky-200/80 bg-sky-50/80 px-2.5 py-2 text-sm text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
          {formHint}
        </p>
      ) : null}
      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="md:col-span-2">
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Client name <span className="text-red-500">*</span>
          </label>
          <input
            className={inputClass("clientName")}
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="Company or contact name"
            required
          />
          {errorFor("clientName") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("clientName")}</p>
          ) : null}
        </div>
        {!isSales ? (
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Follow-up date and time
            </label>
            <input
              type="datetime-local"
              className={inputClass("nextFollowUpAtLocal")}
              value={nextFollowUpAtLocal ?? ""}
              onChange={(e) => onNextFollowUpAtLocalChange?.(e.target.value)}
            />
            {errorFor("nextFollowUpAtLocal") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("nextFollowUpAtLocal")}</p>
            ) : null}
          </div>
        ) : null}
        {!isSales ? (
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Follow-up timezone
            </label>
            <select
              className={inputClass("followUpTimezone")}
              value={followUpTimezone ?? ""}
              onChange={(e) => onFollowUpTimezoneChange?.(e.target.value)}
            >
              <option value="">Select timezone</option>
              {(timezoneOptions ?? []).map((tz) => (
                <option key={tz.value} value={tz.value}>
                  {tz.label}
                </option>
              ))}
            </select>
            {errorFor("followUpTimezone") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("followUpTimezone")}</p>
            ) : null}
          </div>
        ) : null}
        {!isSales && showCustomTimezoneInput ? (
          <div className="md:col-span-2">
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Other timezone (IANA)
            </label>
            <input
              className={inputClass("customTimezone")}
              value={customTimezone ?? ""}
              onChange={(e) => onCustomTimezoneChange?.(e.target.value)}
              placeholder="e.g. Europe/London"
            />
            {errorFor("customTimezone") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("customTimezone")}</p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Phone
          </label>
          <input
            className={inputClass("phone")}
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+1 …"
          />
          {errorFor("phone") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("phone")}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            type="email"
            className={inputClass("email")}
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="name@company.com"
          />
          {errorFor("email") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("email")}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Source
          </label>
          <input
            className={inputClass("source")}
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="Referral, website, event…"
          />
          {errorFor("source") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("source")}</p>
          ) : null}
        </div>

        {isSales ? (
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Sale amount (USD)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className={inputClass("saleAmount")}
              value={saleAmount ?? ""}
              onChange={(e) => onSaleAmountChange?.(e.target.value)}
              placeholder="0.00"
            />
            {errorFor("saleAmount") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("saleAmount")}</p>
            ) : null}
          </div>
        ) : null}

        {isSales ? (
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Service purchased
            </label>
            <ServicePurchasedTagsInput
              tags={servicePurchasedTags ?? []}
              onChange={onServicePurchasedTagsChange ?? (() => {})}
              hasError={!!errorFor("servicePurchased")}
            />
            <p className="mt-1 text-base text-slate-500 dark:text-slate-400">
              Type a service name, then press Enter to add a tag. Click × to remove.
            </p>
            {errorFor("servicePurchased") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("servicePurchased")}</p>
            ) : null}
          </div>
        ) : null}

        {isSales ? (
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Sale date
            </label>
            <input
              type="date"
              className={inputClass("saleDate")}
              value={saleDate ?? ""}
              onChange={(e) => onSaleDateChange?.(e.target.value)}
            />
            {errorFor("saleDate") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("saleDate")}</p>
            ) : null}
          </div>
        ) : null}

        {showDepartment ? (
          <div>
            <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
              Department (optional)
            </label>
            <select
              className={`${inputClass("departmentId")} disabled:cursor-not-allowed disabled:opacity-70`}
              disabled={departmentLocked}
              value={departmentId}
              onChange={(e) => onDepartmentIdChange(e.target.value)}
            >
              <option value="">Unassigned</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            {errorFor("departmentId") ? (
              <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("departmentId")}</p>
            ) : null}
          </div>
        ) : null}
        <div>
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Assigned user
          </label>
          <select
            className={inputClass("assignedUserId")}
            value={assignedUserId}
            onChange={(e) => onAssignedUserIdChange(e.target.value)}
          >
            <option value="">Auto assign (round robin)</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {isSales ? u.name : `${u.name} (${u.email})`}
              </option>
            ))}
          </select>
          {errorFor("assignedUserId") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("assignedUserId")}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Stage
          </label>
          <select
            className={inputClass("status")}
            value={status}
            onChange={(e) => onStatusChange(e.target.value as LeadStage)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {errorFor("status") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("status")}</p>
          ) : null}
        </div>
        <div className="md:col-span-2">
          <label className="block text-base font-medium text-slate-700 dark:text-slate-200">
            Notes
          </label>
          <textarea
            className={`${inputClass("notes")} min-h-[88px]`}
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Context, next step, objections…"
          />
          {errorFor("notes") ? (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400">{errorFor("notes")}</p>
          ) : null}
        </div>
        <div className="md:col-span-2 space-y-2">
          {submitDisabledReason ? (
            <p className="text-right text-sm text-amber-700 dark:text-amber-300">
              {submitDisabledReason}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            {onCancel ? (
              <Button type="button" size="sm" variant="outline" onClick={onCancel}>
                {cancelLabel ?? "Cancel"}
              </Button>
            ) : null}
            <Button type="submit" size="sm" disabled={isSubmitDisabled}>
              {saving ? "Saving…" : submitLabel}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}

