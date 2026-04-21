import { useDragContext } from '@/hooks/useDragAndDrop';
import type { ElementNode } from '@/types/elements';
import { useInspect } from './InspectContext';

/**
 * Attributes returned by {@link useInspectHoverBinding}. Spread directly on
 * the root element of a block component.
 *
 * `data-node-id` is always present — it's what the preview-side halo uses
 * to find the target element via `document.querySelector('[data-node-id=...]')`.
 * Handlers are intentionally optional: omitting them when inspect is off
 * (or during a drag) means React attaches no listener at all, which is both
 * a no-op fast path AND avoids interfering with drag handlers that read
 * `onMouseEnter`/`onMouseLeave` through synthetic bubbling.
 */
export interface InspectHoverBindingAttrs {
  'data-node-id': string;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}

/**
 * Binding helper applied to every block component that can participate in
 * inspect mode (Section, Row, Column, Element). Keeps the block components
 * unaware of how inspect is wired — they spread the returned object and
 * everything else happens in context.
 */
export function useInspectHoverBinding(node: ElementNode): InspectHoverBindingAttrs {
  const { enabled, setEditorHover } = useInspect();
  const { activeType } = useDragContext();

  // During drag we deliberately kill the hover binding so the halo doesn't
  // flicker across blocks that are being moved. `activeType === null` means
  // no drag is in progress (the default DragContext value).
  const bindingActive = enabled && activeType === null;

  // Handlers are recreated per render — fine because they're spread onto
  // native DOM elements where React uses the latest reference directly;
  // useCallback would only matter if the return shape fed a memoised child.
  return {
    'data-node-id': String(node.id),
    onMouseEnter: bindingActive ? () => setEditorHover(node) : undefined,
    onMouseLeave: bindingActive ? () => setEditorHover(null) : undefined,
  };
}
