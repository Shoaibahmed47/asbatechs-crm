import type { AgentHealthState } from "@/lib/attendance-agent-health-state";

/** Admin-facing filter chips — stale is merged into installed. */
export type AgentHealthFilterState = "all" | "running" | "installed" | "not_installed";

export const AGENT_HEALTH_FILTER_OPTIONS: Exclude<AgentHealthFilterState, "all">[] = [
  "running",
  "installed",
  "not_installed"
];

export function normalizeAgentHealthFilter(
  raw: string | undefined | null
): AgentHealthFilterState {
  const value = (raw ?? "").toLowerCase();
  if (value === "running" || value === "installed" || value === "not_installed") {
    return value;
  }
  if (value === "stale") return "installed";
  return "all";
}

export function matchesAgentHealthFilter(
  rowState: AgentHealthState,
  filter: AgentHealthFilterState
): boolean {
  if (filter === "all") return true;
  if (filter === "installed") {
    return rowState === "installed" || rowState === "stale";
  }
  return rowState === filter;
}

export function labelForDisplayAgentState(state: AgentHealthState): string {
  if (state === "running") return "Running";
  if (state === "installed" || state === "stale") return "Installed";
  return "Not installed";
}

export function toneForDisplayAgentState(state: AgentHealthState): string {
  if (state === "running") {
    return "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300";
  }
  if (state === "installed" || state === "stale") {
    return "bg-sky-500/15 text-sky-800 dark:text-sky-300";
  }
  return "bg-slate-200/80 text-slate-700 dark:bg-slate-800 dark:text-slate-400";
}

export function employeeAgentBadgeClass(state: AgentHealthState): string {
  if (state === "running") return "bg-emerald-100 text-emerald-800";
  if (state === "installed" || state === "stale") return "bg-sky-100 text-sky-800";
  return "bg-slate-200 text-slate-700";
}

export function agentStateHintForDisplay(state: AgentHealthState): string {
  if (state === "running") return "Live monitoring is active.";
  if (state === "installed" || state === "stale") {
    return "Agent is installed on this device.";
  }
  return "Agent not installed yet.";
}

export function displayAgentHealthCounts(
  counts: Record<AgentHealthState, number>
): Record<AgentHealthFilterState, number> {
  const installed = counts.installed + counts.stale;
  return {
    all: counts.not_installed + installed + counts.running,
    running: counts.running,
    installed,
    not_installed: counts.not_installed
  };
}
