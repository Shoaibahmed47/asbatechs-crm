/** Clear Radix / modal leftovers that block clicks site-wide. */
export function clearInteractionLocks() {
  document.body.style.removeProperty("pointer-events");
  document.documentElement.style.removeProperty("pointer-events");
  document.body.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("overflow");
  document.body.removeAttribute("data-scroll-locked");
  document.documentElement.removeAttribute("data-scroll-locked");

  // Remove orphaned full-screen overlays left in the DOM after failed portal cleanup.
  document.querySelectorAll("body > div").forEach((node) => {
    if (!(node instanceof HTMLElement)) return;
    const style = window.getComputedStyle(node);
    if (style.position !== "fixed") return;
    const top = style.top;
    const left = style.left;
    const coversViewport =
      (top === "0px" || top === "0") &&
      (left === "0px" || left === "0") &&
      node.offsetWidth >= window.innerWidth - 2 &&
      node.offsetHeight >= window.innerHeight - 2;
    if (!coversViewport) return;
    const hasDialog =
      node.getAttribute("role") === "dialog" ||
      node.id === "attendance-employee-schedule-popover" ||
      node.id === "attendance-absence-detail-popover" ||
      node.querySelector("[role='dialog']") != null;
    if (!hasDialog && node.childElementCount <= 1) {
      node.remove();
    }
  });
}
