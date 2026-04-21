import { type CSSProperties, useEffect, useState } from 'react';
import { useInspect } from './InspectContext';

const HALO_CLASS = 'inspect-halo';

/**
 * Resolve the first element in document order that matches any of the
 * candidate node ids. Used inside-out: if the direct target is missing from
 * the DOM (e.g. its parent column was collapsed), fall back to the nearest
 * ancestor that IS visible so the user still gets a visual anchor.
 *
 * `ancestorIds` is ordered outermost → immediate parent, so iterating in
 * reverse checks the immediate parent first, then walks outward.
 */
function resolveHaloTarget(id: number, ancestorIds: readonly number[]): HTMLElement | null {
  const direct = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  if (direct !== null) return direct;
  for (let i = ancestorIds.length - 1; i >= 0; i--) {
    const ancestorId = ancestorIds[i];
    const el = document.querySelector<HTMLElement>(`[data-node-id="${ancestorId}"]`);
    if (el !== null) return el;
  }
  return null;
}

/**
 * Renders the editor-side halo in response to a preview-source hover event
 * delivered via {@link InspectContext}. The component handles only the
 * preview→editor direction — editor-source hovers drive the PREVIEW halo via
 * a separate channel (postMessage → preview bundle), never this overlay.
 *
 * The rect is captured once per hover and held until the hover changes.
 * Good enough for the 80% case; a production-ready version would observe
 * the target with `ResizeObserver` + RAF while the halo is visible.
 */
export function InspectOverlay(): React.JSX.Element | null {
  const { hover, missing } = useInspect();
  const [target, setTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (hover === null || hover.source !== 'preview') {
      setTarget(null);
      return;
    }

    const found = resolveHaloTarget(hover.id, hover.ancestorIds);
    setTarget(found);
    if (found !== null) {
      found.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [hover]);

  if (target === null) return null;

  const rect = target.getBoundingClientRect();
  const style: CSSProperties = {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    pointerEvents: 'none',
    zIndex: 9999,
  };

  const className = missing ? `${HALO_CLASS} ${HALO_CLASS}--missing` : HALO_CLASS;

  return <div className={className} data-testid="inspect-halo" style={style} />;
}
