const CLASS = 'grid-inspect-breadcrumb';
const OFFSET_ABOVE = 32;
const OFFSET_BELOW = 8;
const EDGE_PADDING = 8;

export interface TargetRect {
  top: number;
  left: number;
  bottom: number;
  right: number;
  width: number;
  height: number;
}

export function buildBreadcrumb(labels: readonly string[]): HTMLDivElement {
  let node = document.querySelector<HTMLDivElement>(`.${CLASS}`);
  if (node === null) {
    node = document.createElement('div');
    node.className = CLASS;
    document.body.appendChild(node);
  }
  node.textContent = labels.join(' › ');
  return node;
}

export function positionBreadcrumb(node: HTMLDivElement, target: TargetRect): void {
  const crumb = node.getBoundingClientRect();
  const wouldOverflowTop = target.top - OFFSET_ABOVE < 0;
  const top = wouldOverflowTop ? target.bottom + OFFSET_BELOW : target.top - OFFSET_ABOVE;

  const rawLeft = target.left;
  const maxLeft = window.innerWidth - crumb.width - EDGE_PADDING;
  const left = Math.max(EDGE_PADDING, Math.min(rawLeft, maxLeft));

  node.style.position = 'fixed';
  node.style.top = `${top}px`;
  node.style.left = `${left}px`;
}

export function removeBreadcrumb(): void {
  const node = document.querySelector(`.${CLASS}`);
  if (node !== null) node.remove();
}
