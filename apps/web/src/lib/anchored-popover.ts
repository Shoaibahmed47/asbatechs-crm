export type AnchorRect = {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
};

export const ANCHORED_POPOVER_VIEWPORT_PAD = 12;

export function anchorRectFromElement(el: HTMLElement): AnchorRect {
  const rect = el.getBoundingClientRect();
  return {
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height
  };
}

export function computeAnchoredPopoverPosition(
  anchor: AnchorRect,
  popoverWidth: number,
  estimatedHeight = 280
): { top: number; left: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const pad = ANCHORED_POPOVER_VIEWPORT_PAD;
  const width = Math.min(popoverWidth, vw - pad * 2);
  let left = anchor.left;
  left = Math.max(pad, Math.min(left, vw - width - pad));

  const spaceBelow = vh - anchor.bottom - pad;
  const spaceAbove = anchor.top - pad;
  const openBelow = spaceBelow >= Math.min(estimatedHeight, spaceAbove);

  const top = openBelow
    ? anchor.bottom + 8
    : Math.max(pad, anchor.top - estimatedHeight - 8);

  return { top, left };
}
