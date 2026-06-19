import { resolveEmployeeScheduleForDate, type UserScheduleFields } from "@/lib/attendance-employee-schedule";
import type { AttendanceOfficeHours } from "@/lib/attendance-office-hours";

const office: AttendanceOfficeHours = {
  expectedCheckInTime: "19:00",
  shiftEndTime: "04:00",
  lateGraceMinutes: 15,
  updatedAt: null
};

describe("resolveEmployeeScheduleForDate", () => {
  const activeUser: UserScheduleFields = {
    expectedCheckInTime: "19:00",
    expectedShiftEndTime: "04:00",
    pendingExpectedCheckInTime: "17:00",
    pendingExpectedShiftEndTime: "03:00",
    scheduleEffectiveFrom: "2026-06-21"
  };

  it("uses active schedule before effective date", () => {
    const resolved = resolveEmployeeScheduleForDate(activeUser, office, "2026-06-20");
    expect(resolved.effectiveExpectedCheckInTime).toBe("19:00");
    expect(resolved.effectiveExpectedShiftEndTime).toBe("04:00");
    expect(resolved.scheduleSource).toBe("active");
  });

  it("uses pending schedule on and after effective date", () => {
    const resolved = resolveEmployeeScheduleForDate(activeUser, office, "2026-06-21");
    expect(resolved.effectiveExpectedCheckInTime).toBe("17:00");
    expect(resolved.effectiveExpectedShiftEndTime).toBe("03:00");
    expect(resolved.scheduleSource).toBe("pending");
  });
});
