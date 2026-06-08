import { getLocalDateString } from "@/lib/attendance-date";
import {
  ATTENDANCE_AGENT_INSTALLED_SECONDS,
  ATTENDANCE_AGENT_RUNNING_SECONDS
} from "@/lib/attendance-policy";

export type AgentHealthState = "not_installed" | "installed" | "running" | "stale";

/** Latest agent heartbeat or agent-sourced activity that falls on the attendance day. */
export function pickLatestAgentSignalOnDate(
  date: string,
  signals: Array<Date | null | undefined>
): Date | null {
  let latest: Date | null = null;
  for (const signal of signals) {
    if (!signal) continue;
    const at = signal instanceof Date ? signal : new Date(signal);
    if (getLocalDateString(at) !== date) continue;
    if (!latest || at.getTime() > latest.getTime()) {
      latest = at;
    }
  }
  return latest;
}

export function resolveAgentHealthState(params: {
  lastAgentAtOnDate: Date | null;
  lastSetupAt: Date | null;
  openShift: boolean;
}): {
  state: AgentHealthState;
  ageSeconds: number | null;
} {
  const { lastAgentAtOnDate, lastSetupAt, openShift } = params;
  if (lastAgentAtOnDate) {
    return classifyAgentState(lastAgentAtOnDate);
  }
  if (openShift && lastSetupAt) {
    return { state: "stale", ageSeconds: null };
  }
  if (lastSetupAt) {
    const ageSeconds = Math.max(
      0,
      Math.floor((Date.now() - lastSetupAt.getTime()) / 1000)
    );
    return { state: "installed", ageSeconds };
  }
  return { state: "not_installed", ageSeconds: null };
}

export function classifyAgentState(lastActivityAt: Date | null): {
  state: AgentHealthState;
  ageSeconds: number | null;
} {
  if (!lastActivityAt) {
    return { state: "not_installed", ageSeconds: null };
  }

  const ageSeconds = Math.max(
    0,
    Math.floor((Date.now() - lastActivityAt.getTime()) / 1000)
  );
  if (ageSeconds <= ATTENDANCE_AGENT_RUNNING_SECONDS) return { state: "running", ageSeconds };
  if (ageSeconds <= ATTENDANCE_AGENT_INSTALLED_SECONDS) return { state: "installed", ageSeconds };
  return { state: "stale", ageSeconds };
}
