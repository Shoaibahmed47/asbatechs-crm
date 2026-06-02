import {
  ATTENDANCE_AGENT_INSTALLED_SECONDS,
  ATTENDANCE_AGENT_RUNNING_SECONDS
} from "@/lib/attendance-policy";

export type AgentHealthState = "not_installed" | "installed" | "running" | "stale";

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
