"use client";

import { Button } from "@/components/ui/button";
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
  servicePurchased?: string;
  onServicePurchasedChange?: (value: string) => void;
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
  servicePurchased,
  onServicePurchasedChange,
  saleDate,
  onSaleDateChange,
  onSubmit,
  formHint,
  departmentLocked,
  showDepartment = true,
  submitDisabledReason,
  onCancel,
  cancelLabel
}: LeadEntryFormProps) {
  const isSales = mode === "sale";

  const isSubmitDisabled = saving || !!submitDisabledReason;

  return (
    <div className="data-card p-5" id={formId}>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
      {description ? (
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      ) : null}
      {formHint ? (
        <p className="mt-2 rounded-md border border-sky-200/80 bg-sky-50/80 px-2.5 py-2 text-xs text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
          {formHint}
        </p>
      ) : null}
      <form className="mt-4 grid gap-4 md:grid-cols-2" onSubmit={onSubmit}>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Client name <span className="text-red-500">*</span>
          </label>
          <input
            className="form-input mt-1"
            value={clientName}
            onChange={(e) => onClientNameChange(e.target.value)}
            placeholder="Company or contact name"
            required
          />
        </div>
        {!isSales ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Follow-up date and time
            </label>
            <input
              type="datetime-local"
              className="form-input mt-1"
              value={nextFollowUpAtLocal ?? ""}
              onChange={(e) => onNextFollowUpAtLocalChange?.(e.target.value)}
            />
          </div>
        ) : null}
        {!isSales ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Follow-up timezone
            </label>
            <select
              className="form-input mt-1"
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
          </div>
        ) : null}
        {!isSales && showCustomTimezoneInput ? (
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Other timezone (IANA)
            </label>
            <input
              className="form-input mt-1"
              value={customTimezone ?? ""}
              onChange={(e) => onCustomTimezoneChange?.(e.target.value)}
              placeholder="e.g. Europe/London"
            />
          </div>
        ) : null}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Phone
          </label>
          <input
            className="form-input mt-1"
            value={phone}
            onChange={(e) => onPhoneChange(e.target.value)}
            placeholder="+1 …"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Email
          </label>
          <input
            type="email"
            className="form-input mt-1"
            value={email}
            onChange={(e) => onEmailChange(e.target.value)}
            placeholder="name@company.com"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Source
          </label>
          <input
            className="form-input mt-1"
            value={source}
            onChange={(e) => onSourceChange(e.target.value)}
            placeholder="Referral, website, event…"
          />
        </div>

        {isSales ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Sale amount (USD)
            </label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="form-input mt-1"
              value={saleAmount ?? ""}
              onChange={(e) => onSaleAmountChange?.(e.target.value)}
              placeholder="0.00"
            />
          </div>
        ) : null}

        {isSales ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Service purchased
            </label>
            <input
              className="form-input mt-1"
              value={servicePurchased ?? ""}
              onChange={(e) => onServicePurchasedChange?.(e.target.value)}
              placeholder="Package or SKU"
            />
          </div>
        ) : null}

        {isSales ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Sale date
            </label>
            <input
              type="date"
              className="form-input mt-1"
              value={saleDate ?? ""}
              onChange={(e) => onSaleDateChange?.(e.target.value)}
            />
          </div>
        ) : null}

        {showDepartment ? (
          <div>
            <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
              Department (optional)
            </label>
            <select
              className="form-input mt-1 disabled:cursor-not-allowed disabled:opacity-70"
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
          </div>
        ) : null}
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Assigned user
          </label>
          <select
            className="form-input mt-1"
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
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Stage
          </label>
          <select
            className="form-input mt-1"
            value={status}
            onChange={(e) => onStatusChange(e.target.value as LeadStage)}
          >
            {statusOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs font-medium text-slate-700 dark:text-slate-200">
            Notes
          </label>
          <textarea
            className="form-input mt-1 min-h-[88px]"
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Context, next step, objections…"
          />
        </div>
        <div className="md:col-span-2 space-y-2">
          {submitDisabledReason ? (
            <p className="text-right text-xs text-amber-700 dark:text-amber-300">
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

