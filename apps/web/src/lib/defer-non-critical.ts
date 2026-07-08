/** Run work after the first paint so navigation feels responsive. */
export function runAfterFirstPaint(task: () => void, delayMs = 0): void {
  if (typeof window === "undefined") return;
  const run = () => {
    window.setTimeout(task, delayMs);
  };
  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(run, { timeout: 1500 });
    return;
  }
  run();
}
