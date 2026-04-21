import { buildBreadcrumb, positionBreadcrumb, removeBreadcrumb } from "./breadcrumb";
import { getElementId, getElementTitle, hitTest } from "./elements";
import { postToParent } from "./messageBridge";

const CLASS_TARGET = "grid-inspect-target";
const CLASS_ANCESTOR = ["grid-inspect-ancestor-1", "grid-inspect-ancestor-2", "grid-inspect-ancestor-3"];

interface Inspector {
  active: boolean;
  mutated: Set<HTMLElement>;
  currentHover: HTMLElement | null;
  onMouseMove: (event: MouseEvent) => void;
  onMouseLeave: () => void;
  pendingFrame: number | null;
  pendingTarget: HTMLElement | null;
  destroy(): void;
  flush(): void; // test hook
}

export function createInspector(): Inspector {
  const inspector: Inspector = {
    active: false,
    mutated: new Set(),
    currentHover: null,
    pendingFrame: null,
    pendingTarget: null,
    onMouseMove: () => {},
    onMouseLeave: () => {},
    destroy: () => {
      deactivate(inspector);
    },
    flush: () => {
      if (inspector.pendingFrame !== null) {
        cancelAnimationFrame(inspector.pendingFrame);
        processHover(inspector, inspector.pendingTarget);
        inspector.pendingFrame = null;
        inspector.pendingTarget = null;
      }
    },
  };

  inspector.onMouseMove = (event: MouseEvent) => {
    if (!inspector.active) return;
    const target = hitTest(event.target as Element | null);
    inspector.pendingTarget = target;
    if (inspector.pendingFrame !== null) return;
    inspector.pendingFrame = requestAnimationFrame(() => {
      inspector.pendingFrame = null;
      processHover(inspector, inspector.pendingTarget);
      inspector.pendingTarget = null;
    });
  };

  inspector.onMouseLeave = () => {
    if (!inspector.active) return;
    if (inspector.currentHover !== null) {
      clearHighlightDom(inspector);
      postToParent({ type: "grid-inspect:unhover" });
      inspector.currentHover = null;
    }
  };

  return inspector;
}

function processHover(inspector: Inspector, target: HTMLElement | null): void {
  if (target === inspector.currentHover) return;

  clearHighlightDom(inspector);

  if (target === null) {
    postToParent({ type: "grid-inspect:unhover" });
    inspector.currentHover = null;
    return;
  }

  const id = getElementId(target);
  if (id === null) return;

  applyHighlight(inspector, target);
  inspector.currentHover = target;
  postToParent({ type: "grid-inspect:hover", id });
}

function applyHighlight(inspector: Inspector, target: HTMLElement): void {
  target.classList.add(CLASS_TARGET);
  inspector.mutated.add(target);

  const ancestors = walkAncestors(target).slice(0, 3);
  ancestors.forEach((ancestor, index) => {
    ancestor.classList.add(CLASS_ANCESTOR[index]);
    inspector.mutated.add(ancestor);
  });

  const labels = buildLabels(target, ancestors);
  const rect = target.getBoundingClientRect();
  const breadcrumb = buildBreadcrumb(labels);
  positionBreadcrumb(breadcrumb, rect);
}

function walkAncestors(target: HTMLElement): HTMLElement[] {
  const acc: HTMLElement[] = [];
  let current: HTMLElement | null = target.parentElement;
  while (current !== null) {
    if (current.hasAttribute("data-grid-element-id")) acc.push(current);
    current = current.parentElement;
  }
  return acc;
}

function buildLabels(target: HTMLElement, ancestors: readonly HTMLElement[]): string[] {
  const labels = [...ancestors].reverse().map((el) => getElementTitle(el) ?? "Element");
  labels.push(getElementTitle(target) ?? "Element");
  return labels;
}

function clearHighlightDom(inspector: Inspector): void {
  for (const el of inspector.mutated) {
    el.classList.remove(CLASS_TARGET, ...CLASS_ANCESTOR);
  }
  inspector.mutated.clear();
  removeBreadcrumb();
}

export function activate(inspector: Inspector): void {
  if (inspector.active) return;
  inspector.active = true;
  document.addEventListener("mousemove", inspector.onMouseMove, { passive: true });
  document.documentElement.addEventListener("mouseleave", inspector.onMouseLeave);
}

export function deactivate(inspector: Inspector): void {
  if (!inspector.active) return;
  inspector.active = false;
  document.removeEventListener("mousemove", inspector.onMouseMove);
  document.documentElement.removeEventListener("mouseleave", inspector.onMouseLeave);
  if (inspector.pendingFrame !== null) {
    cancelAnimationFrame(inspector.pendingFrame);
    inspector.pendingFrame = null;
    inspector.pendingTarget = null;
  }
  clearHighlightDom(inspector);
  inspector.currentHover = null;
}

export function highlight(inspector: Inspector, id: number): void {
  const target = document.querySelector<HTMLElement>(`[data-grid-element-id="${id}"]`);
  if (target === null) {
    postToParent({ type: "grid-inspect:missing", id });
    return;
  }

  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    postToParent({ type: "grid-inspect:missing", id });
    return;
  }

  clearHighlightDom(inspector);
  applyHighlight(inspector, target);
  target.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

export function clear(inspector: Inspector): void {
  clearHighlightDom(inspector);
  inspector.currentHover = null;
}
