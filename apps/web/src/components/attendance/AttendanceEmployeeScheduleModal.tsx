"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import type { EmployeeWeeklySchedule } from "@asbatechs-crm/database";
import { Button } from "@/components/ui/button";
import { ApiFetchError, apiFetch } from "@/lib/api-fetch";
import { getTomorrowLocalDateString } from "@/lib/attendance-date";
import { formatOfficeTimeLabel, officeShiftEndsNextDay } from "@/lib/attendance-office-hours";
import { clearInteractionLocks } from "@/lib/dom-interaction-locks";
import {
  createDefaultWeeklySchedule,
  createSaturdayWorkerWeeklySchedule,
  formatWeeklyDaySummary,
  WEEKLY_SCHEDULE_DAY_KEYS,
  WEEKLY_SCHEDULE_DAY_LABELS,
  type WeeklyScheduleDayKey
} from "@/lib/attendance-weekly-schedule";

export type ScheduleAnchorRect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};

const DIALOG_ID = "attendance-employee-schedule-dialog";

type Props = {
  userId: number;
  userName: string;
  anchorRect: ScheduleAnchorRect;
  onClose: () => void;
  onSaved: () => void;
};

type Schedule = {
  weeklyScheduleEnabled: boolean;
  weeklySchedule: EmployeeWeeklySchedule | null;
  pendingWeeklySchedule: EmployeeWeeklySchedule | null;
  employeeExpectedCheckInTime: string | null;
  employeeExpectedShiftEndTime: string | null;
  officeExpectedCheckInTime: string;
  officeShiftEndTime: string;
  effectiveExpectedCheckInTime: string;
  effectiveExpectedCheckInLabel: string;
  effectiveExpectedShiftEndTime: string;
  effectiveExpectedShiftEndLabel: string;
  shiftEndsNextDay: boolean;
  usesOfficeDefault: boolean;
  isWorkingDayToday: boolean;
  hasPendingSchedule: boolean;
  pendingEffectiveFrom: string | null;
  pendingEffectiveFromLabel: string | null;
  pendingEffectiveExpectedCheckInLabel: string | null;
  pendingEffectiveExpectedShiftEndLabel: string | null;
  pendingShiftEndsNextDay: boolean;
  pendingUsesOfficeDefault: boolean;
  pendingEmployeeExpectedCheckInTime: string | null;
  pendingEmployeeExpectedShiftEndTime: string | null;
};

function cloneWeeklySchedule(schedule: EmployeeWeeklySchedule): EmployeeWeeklySchedule {
  return JSON.parse(JSON.stringify(schedule)) as EmployeeWeeklySchedule;
}

function updateWeeklyDay(
  schedule: EmployeeWeeklySchedule,
  dayKey: WeeklyScheduleDayKey,
  patch: Partial<EmployeeWeeklySchedule[WeeklyScheduleDayKey]>
): EmployeeWeeklySchedule {
  const next = cloneWeeklySchedule(schedule);
  next[dayKey] = { ...next[dayKey], ...patch };
  if (!next[dayKey].isWorking) {
    next[dayKey] = { isWorking: false, checkInTime: null, shiftEndTime: null };
  }
  return next;
}

export function AttendanceEmployeeScheduleModal({
  userId,
  userName,
  onClose,
  onSaved
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);
  const [checkInTime, setCheckInTime] = useState("19:00");
  const [shiftEndTime, setShiftEndTime] = useState("16:00");
  const [useOfficeDefault, setUseOfficeDefault] = useState(true);
  const [weeklyScheduleEnabled, setWeeklyScheduleEnabled] = useState(false);
  const [weeklySchedule, setWeeklySchedule] = useState<EmployeeWeeklySchedule | null>(null);
  const [applyImmediately, setApplyImmediately] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(() => getTomorrowLocalDateString());

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    clearInteractionLocks();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      clearInteractionLocks();
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await apiFetch<{ schedule: Schedule }>(
          `/api/admin/employee-schedule?userId=${userId}`
        );
        if (cancelled) return;
        setSchedule(data.schedule);
        setApplyImmediately(false);
        setEffectiveFrom(getTomorrowLocalDateString());
        setWeeklyScheduleEnabled(data.schedule.weeklyScheduleEnabled);

        const officeCheckIn = data.schedule.officeExpectedCheckInTime;
        const officeShiftEnd = data.schedule.officeShiftEndTime;
        const defaultWeekly = createDefaultWeeklySchedule({
          checkInTime: officeCheckIn,
          shiftEndTime: officeShiftEnd
        });

        if (data.schedule.hasPendingSchedule) {
          setUseOfficeDefault(data.schedule.pendingUsesOfficeDefault);
          setCheckInTime(
            data.schedule.pendingEmployeeExpectedCheckInTime ?? officeCheckIn
          );
          setShiftEndTime(
            data.schedule.pendingEmployeeExpectedShiftEndTime ?? officeShiftEnd
          );
          setWeeklySchedule(
            data.schedule.pendingWeeklySchedule ??
              data.schedule.weeklySchedule ??
              defaultWeekly
          );
          if (data.schedule.pendingEffectiveFrom) {
            setEffectiveFrom(data.schedule.pendingEffectiveFrom);
          }
        } else {
          setUseOfficeDefault(data.schedule.usesOfficeDefault);
          setCheckInTime(data.schedule.employeeExpectedCheckInTime ?? officeCheckIn);
          setShiftEndTime(data.schedule.employeeExpectedShiftEndTime ?? officeShiftEnd);
          setWeeklySchedule(data.schedule.weeklySchedule ?? defaultWeekly);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof ApiFetchError ? err.message : "Could not load employee schedule."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  function handleOfficeDefaultChange(checked: boolean) {
    setUseOfficeDefault(checked);
    if (checked && schedule) {
      setCheckInTime(schedule.officeExpectedCheckInTime);
      setShiftEndTime(schedule.officeShiftEndTime);
    }
  }

  function handleWeeklyModeChange(enabled: boolean) {
    setWeeklyScheduleEnabled(enabled);
    if (enabled && schedule && !weeklySchedule) {
      setWeeklySchedule(
        createDefaultWeeklySchedule({
          checkInTime: schedule.officeExpectedCheckInTime,
          shiftEndTime: schedule.officeShiftEndTime
        })
      );
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const data = await apiFetch.put<{ schedule: Schedule }>(
        "/api/admin/employee-schedule",
        {
          userId,
          expectedCheckInTime: useOfficeDefault ? null : checkInTime,
          expectedShiftEndTime: useOfficeDefault ? null : shiftEndTime,
          effectiveFrom: applyImmediately ? null : effectiveFrom,
          weeklyScheduleEnabled,
          weeklySchedule: weeklyScheduleEnabled ? weeklySchedule : null
        }
      );
      setSchedule(data.schedule);
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof ApiFetchError ? err.message : "Could not save schedule.");
    } finally {
      setSaving(false);
    }
  }

  if (!mounted || typeof document === "undefined") return null;

  const officeCheckInLabel = schedule
    ? formatOfficeTimeLabel(schedule.officeExpectedCheckInTime)
    : formatOfficeTimeLabel(checkInTime);
  const officeShiftEndLabel = schedule
    ? formatOfficeTimeLabel(schedule.officeShiftEndTime)
    : formatOfficeTimeLabel(shiftEndTime);

  const previewEndsNextDay = useOfficeDefault
    ? schedule?.shiftEndsNextDay ?? false
    : officeShiftEndsNextDay(checkInTime, shiftEndTime);

  const panel = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/55 backdrop-blur-[2px]"
        aria-label="Close dialog"
        onClick={onClose}
      />
      <div
        id={DIALOG_ID}
        role="dialog"
        aria-modal="true"
        aria-labelledby="schedule-dialog-title"
        className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-sky-200/90 bg-white p-5 shadow-2xl dark:border-sky-800/80 dark:bg-slate-950"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300">
            <Clock className="h-5 w-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2
              id="schedule-dialog-title"
              className="text-lg font-semibold text-slate-900 dark:text-slate-100"
            >
              Employee work schedule
            </h2>
            <p className="mt-1 text-base text-slate-600 dark:text-slate-400">{userName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close schedule"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-500">Loading…</p>
        ) : (
          <div className="mt-4 space-y-3">
            {schedule ? (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Active today
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
                  {schedule.isWorkingDayToday ? (
                    <>
                      {schedule.effectiveExpectedCheckInLabel}
                      <span className="text-slate-500 dark:text-slate-400"> → </span>
                      {schedule.effectiveExpectedShiftEndLabel}
                      {schedule.shiftEndsNextDay ? (
                        <span className="text-base font-medium text-slate-500 dark:text-slate-400">
                          {" "}
                          (next day)
                        </span>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-slate-600 dark:text-slate-400">Day off</span>
                  )}
                </p>
                {schedule.hasPendingSchedule &&
                schedule.pendingEffectiveExpectedCheckInLabel &&
                schedule.pendingEffectiveExpectedShiftEndLabel ? (
                  <p className="mt-2 text-base text-amber-800 dark:text-amber-300">
                    Scheduled from <strong>{schedule.pendingEffectiveFromLabel}</strong>:{" "}
                    {schedule.pendingEffectiveExpectedCheckInLabel} →{" "}
                    {schedule.pendingEffectiveExpectedShiftEndLabel}
                    {schedule.pendingShiftEndsNextDay ? " (next day)" : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                weeklyScheduleEnabled
                  ? "border-sky-300/80 bg-sky-50/80 dark:border-sky-700/70 dark:bg-sky-950/35"
                  : "border-slate-200/90 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/40"
              }`}
            >
              <input
                type="checkbox"
                checked={weeklyScheduleEnabled}
                onChange={(e) => handleWeeklyModeChange(e.target.checked)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="min-w-0">
                <span className="text-base font-medium text-slate-900 dark:text-slate-100">
                  Custom weekly schedule
                </span>
                <span className="mt-0.5 block text-base leading-relaxed text-slate-500 dark:text-slate-400">
                  Set different working days and times per day (e.g. Saturday workers, half shifts).
                </span>
              </span>
            </label>

            {weeklyScheduleEnabled && weeklySchedule ? (
              <div className="space-y-3 rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saving}
                    onClick={() => setWeeklySchedule(createSaturdayWorkerWeeklySchedule())}
                  >
                    Saturday worker template
                  </Button>
                  {schedule ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={saving}
                      onClick={() =>
                        setWeeklySchedule(
                          createDefaultWeeklySchedule({
                            checkInTime: schedule.officeExpectedCheckInTime,
                            shiftEndTime: schedule.officeShiftEndTime
                          })
                        )
                      }
                    >
                      Mon–Fri office hours
                    </Button>
                  ) : null}
                </div>

                <div className="space-y-2">
                  {WEEKLY_SCHEDULE_DAY_KEYS.map((dayKey) => {
                    const day = weeklySchedule[dayKey];
                    const endsNextDay =
                      day.isWorking &&
                      day.checkInTime &&
                      day.shiftEndTime &&
                      officeShiftEndsNextDay(day.checkInTime, day.shiftEndTime);
                    return (
                      <div
                        key={dayKey}
                        className="grid gap-2 rounded-lg border border-slate-200/80 p-2 sm:grid-cols-[120px_80px_1fr_1fr] dark:border-slate-700"
                      >
                        <span className="self-center text-sm font-medium text-slate-800 dark:text-slate-200">
                          {WEEKLY_SCHEDULE_DAY_LABELS[dayKey]}
                        </span>
                        <label className="flex items-center gap-2 self-center text-sm">
                          <input
                            type="checkbox"
                            checked={day.isWorking}
                            disabled={saving}
                            onChange={(e) =>
                              setWeeklySchedule(
                                updateWeeklyDay(weeklySchedule, dayKey, {
                                  isWorking: e.target.checked,
                                  checkInTime: e.target.checked
                                    ? day.checkInTime ??
                                      schedule?.officeExpectedCheckInTime ??
                                      "19:00"
                                    : null,
                                  shiftEndTime: e.target.checked
                                    ? day.shiftEndTime ??
                                      schedule?.officeShiftEndTime ??
                                      "04:00"
                                    : null
                                })
                              )
                            }
                            className="h-4 w-4 rounded border-slate-300 text-sky-600"
                          />
                          On
                        </label>
                        {day.isWorking ? (
                          <>
                            <input
                              type="time"
                              value={day.checkInTime ?? ""}
                              disabled={saving}
                              onChange={(e) =>
                                setWeeklySchedule(
                                  updateWeeklyDay(weeklySchedule, dayKey, {
                                    checkInTime: e.target.value
                                  })
                                )
                              }
                              className="form-input"
                              aria-label={`${WEEKLY_SCHEDULE_DAY_LABELS[dayKey]} check-in`}
                            />
                            <input
                              type="time"
                              value={day.shiftEndTime ?? ""}
                              disabled={saving}
                              onChange={(e) =>
                                setWeeklySchedule(
                                  updateWeeklyDay(weeklySchedule, dayKey, {
                                    shiftEndTime: e.target.value
                                  })
                                )
                              }
                              className="form-input"
                              aria-label={`${WEEKLY_SCHEDULE_DAY_LABELS[dayKey]} shift end`}
                            />
                          </>
                        ) : (
                          <span className="col-span-2 self-center text-sm text-slate-500 dark:text-slate-400">
                            Off
                          </span>
                        )}
                        {day.isWorking ? (
                          <span className="col-span-full text-xs text-slate-500 dark:text-slate-400 sm:col-span-4">
                            {formatWeeklyDaySummary(day)}
                            {endsNextDay ? " · next day" : ""}
                          </span>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <>
            <label
              className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                useOfficeDefault
                  ? "border-sky-300/80 bg-sky-50/80 dark:border-sky-700/70 dark:bg-sky-950/35"
                  : "border-slate-200/90 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/40"
              }`}
            >
              <input
                type="checkbox"
                checked={useOfficeDefault}
                onChange={(e) => handleOfficeDefaultChange(e.target.checked)}
                disabled={saving}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
              />
              <span className="min-w-0">
                <span className="text-base font-medium text-slate-900 dark:text-slate-100">
                  Use office default schedule
                </span>
                <span className="mt-0.5 block text-base leading-relaxed text-slate-500 dark:text-slate-400">
                  Follow check-in and check-out times from Admin Control for this employee.
                </span>
              </span>
            </label>

            {useOfficeDefault ? (
              <div className="rounded-xl border border-slate-200/90 bg-slate-50/80 px-3 py-3 dark:border-slate-700 dark:bg-slate-900/60">
                <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Office schedule
                </p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-sky-800 dark:text-sky-300">
                  {officeCheckInLabel} → {officeShiftEndLabel}
                  {schedule?.shiftEndsNextDay ? (
                    <span className="text-base font-medium text-slate-500 dark:text-slate-400">
                      {" "}
                      (next day)
                    </span>
                  ) : null}
                </p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Check-in
                  </span>
                  <input
                    type="time"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    disabled={saving}
                    className="form-input mt-2"
                  />
                  <span className="mt-1 block text-base text-slate-500 dark:text-slate-400">
                    {formatOfficeTimeLabel(checkInTime)}
                  </span>
                </label>
                <label className="block rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Check-out (shift end)
                  </span>
                  <input
                    type="time"
                    value={shiftEndTime}
                    onChange={(e) => setShiftEndTime(e.target.value)}
                    disabled={saving}
                    className="form-input mt-2"
                  />
                  <span className="mt-1 block text-base text-slate-500 dark:text-slate-400">
                    {formatOfficeTimeLabel(shiftEndTime)}
                    {previewEndsNextDay ? " · next day" : ""}
                  </span>
                </label>
              </div>
            )}

              </>
            )}

            <div className="rounded-xl border border-slate-200/90 bg-white p-3 dark:border-slate-700 dark:bg-slate-900/60">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={applyImmediately}
                  onChange={(e) => setApplyImmediately(e.target.checked)}
                  disabled={saving}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span className="min-w-0">
                  <span className="text-base font-medium text-slate-900 dark:text-slate-100">
                    Apply today (immediate)
                  </span>
                  <span className="mt-0.5 block text-base leading-relaxed text-slate-500 dark:text-slate-400">
                    Use new times for today&apos;s shift. Leave unchecked to start from a future
                    date (recommended).
                  </span>
                </span>
              </label>

              {!applyImmediately ? (
                <label className="mt-3 block">
                  <span className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Effective from
                  </span>
                  <input
                    type="date"
                    value={effectiveFrom}
                    min={getTomorrowLocalDateString()}
                    onChange={(e) => setEffectiveFrom(e.target.value)}
                    disabled={saving}
                    className="form-input mt-2"
                  />
                  <span className="mt-1 block text-base text-slate-500 dark:text-slate-400">
                    New check-in / check-out apply from this date. Today&apos;s open shift keeps the
                    current schedule.
                  </span>
                </label>
              ) : null}
            </div>
          </div>
        )}

        {error ? <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p> : null}

        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" size="sm" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => void handleSave()}
            disabled={loading || saving}
          >
            {saving ? "Saving…" : applyImmediately ? "Save now" : "Schedule change"}
          </Button>
        </div>
      </div>
    </div>
  );

  return createPortal(panel, document.body);
}
