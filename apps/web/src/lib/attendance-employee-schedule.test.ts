import { resolveEmployeeScheduleForDate, type UserScheduleFields } from "@/lib/attendance-employee-schedule";
import type { AttendanceOfficeHours } from "@/lib/attendance-office-hours";
import { createSaturdayWorkerWeeklySchedule } from "@/lib/attendance-weekly-schedule";

const office: AttendanceOfficeHours = {
  expectedCheckInTime: "19:00",
  shiftEndTime: "04:00",
  lateGraceMinutes: 15,
  updatedAt: null
};

const baseUserFields: Omit<UserScheduleFields, "weeklyScheduleEnabled" | "weeklySchedule" | "pendingWeeklySchedule"> = {
  expectedCheckInTime: "19:00",
  expectedShiftEndTime: "04:00",
  pendingExpectedCheckInTime: "17:00",
  pendingExpectedShiftEndTime: "03:00",
  scheduleEffectiveFrom: "2026-06-21"
};

describe("resolveEmployeeScheduleForDate", () => {
  const activeUser: UserScheduleFields = {
    ...baseUserFields,
    weeklyScheduleEnabled: false,
    weeklySchedule: null,
    pendingWeeklySchedule: null
  };

  it("uses active schedule before effective date", () => {
    const resolved = resolveEmployeeScheduleForDate(activeUser, office, "2026-06-05");
    expect(resolved.effectiveExpectedCheckInTime).toBe("19:00");
    expect(resolved.effectiveExpectedShiftEndTime).toBe("04:00");
    expect(resolved.scheduleSource).toBe("active");
    expect(resolved.isWorkingDay).toBe(true);
  });

  it("uses pending schedule on and after effective date", () => {
    const resolved = resolveEmployeeScheduleForDate(activeUser, office, "2026-06-22");
    expect(resolved.effectiveExpectedCheckInTime).toBe("17:00");
    expect(resolved.effectiveExpectedShiftEndTime).toBe("03:00");
    expect(resolved.scheduleSource).toBe("pending");
  });

  it("marks Saturday off for legacy employees", () => {
    const friday = resolveEmployeeScheduleForDate(activeUser, office, "2026-06-05");
    expect(friday.isWorkingDay).toBe(true);

    const saturday = resolveEmployeeScheduleForDate(activeUser, office, "2026-06-06");
    expect(saturday.isWorkingDay).toBe(false);
  });

  it("allows Saturday work for weekly schedule employees", () => {
    const weeklyUser: UserScheduleFields = {
      ...baseUserFields,
      weeklyScheduleEnabled: true,
      weeklySchedule: createSaturdayWorkerWeeklySchedule(),
      pendingWeeklySchedule: null
    };

    const saturday = resolveEmployeeScheduleForDate(weeklyUser, office, "2026-06-06");
    expect(saturday.isWorkingDay).toBe(true);
    expect(saturday.effectiveExpectedCheckInTime).toBe("18:00");
    expect(saturday.effectiveExpectedShiftEndTime).toBe("23:00");

    const sunday = resolveEmployeeScheduleForDate(weeklyUser, office, "2026-06-07");
    expect(sunday.isWorkingDay).toBe(false);

    const monday = resolveEmployeeScheduleForDate(weeklyUser, office, "2026-06-08");
    expect(monday.isWorkingDay).toBe(true);
    expect(monday.effectiveExpectedCheckInTime).toBe("18:00");
    expect(monday.effectiveExpectedShiftEndTime).toBe("23:00");

    const tuesday = resolveEmployeeScheduleForDate(weeklyUser, office, "2026-06-09");
    expect(tuesday.isWorkingDay).toBe(true);
    expect(tuesday.effectiveExpectedShiftEndTime).toBe("03:00");
    expect(tuesday.shiftEndsNextDay).toBe(true);
  });
});
