const ATTR_ID = 'data-grid-element-id';
const ATTR_TITLE = 'data-grid-element-title';

export function hitTest(target: Element | null): HTMLElement | null {
  if (target === null) return null;
  const start = target instanceof HTMLElement ? target : target.parentElement;
  return start?.closest<HTMLElement>(`[${ATTR_ID}]`) ?? null;
}

export function getElementId(element: HTMLElement): number | null {
  const raw = element.getAttribute(ATTR_ID);
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && String(parsed) === raw ? parsed : null;
}

export function getElementTitle(element: HTMLElement): string | null {
  const value = element.getAttribute(ATTR_TITLE);
  return value !== null && value !== '' ? value : null;
}

export function getAncestors(element: HTMLElement): number[] {
  const ancestors: number[] = [];
  let current: HTMLElement | null = element.parentElement;
  while (current !== null) {
    if (current.hasAttribute(ATTR_ID)) {
      const id = getElementId(current);
      if (id !== null) ancestors.push(id);
    }
    current = current.parentElement;
  }
  return ancestors.reverse();
}
