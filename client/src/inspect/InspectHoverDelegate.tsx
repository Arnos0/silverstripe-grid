import { useEffect, useMemo, useRef } from 'react';
import { useDragContext } from '@/hooks/useDragAndDrop';
import type { ElementNode, TreeApiResponse } from '@/types/elements';
import { useInspect } from './InspectContext';

/**
 * Walks the tree and returns a flat `id → ElementNode` map. Container
 * nodes (section/row/column) expose their children on `children`; leaves
 * don't. One pass per tree update — memoised in the consumer.
 */
function buildNodeById(tree: TreeApiResponse): Map<number, ElementNode> {
  const byId = new Map<number, ElementNode>();

  const walk = (node: ElementNode): void => {
    byId.set(node.id, node);
    const children = 'children' in node ? node.children : null;
    if (children !== null && children !== undefined) {
      for (const child of children) walk(child);
    }
  };

  for (const root of tree.nodes) walk(root);
  return byId;
}

interface Props {
  readonly tree: TreeApiResponse;
}

/**
 * Single delegated `mousemove` listener that resolves the innermost block
 * under the cursor via `event.target.closest('[data-node-id]')` and drives
 * {@link useInspect}'s `setEditorHover`. Replaces per-element React
 * `onMouseEnter` / `onMouseLeave` handlers, which don't compose correctly
 * across nested bound elements: React only fires `onMouseEnter` on the
 * outer wrapper when the cursor enters from OUTSIDE the wrapper, so moving
 * the cursor back from a child (ElementCard) to the column's own header
 * never refires the column's handler and the preview stayed stuck on the
 * child's highlight.
 *
 * A single delegated listener mirrors how the preview-side inspector already
 * works (`client/src/preview/inspector.ts`): on every mousemove, resolve the
 * innermost `[data-node-id]` ancestor and drive state from that.
 *
 * Must be rendered inside {@link DragContext.Provider} so drag suppression
 * reflects live drag state; the consumer (`GridEditor`) mounts one instance
 * per render branch (editable and readonly).
 */
export function InspectHoverDelegate({ tree }: Props): null {
  const { enabled, setEditorHover } = useInspect();
  const { activeType } = useDragContext();

  const nodeById = useMemo(() => buildNodeById(tree), [tree]);

  const lastIdRef = useRef<number | null>(null);
  // `activeType` is captured in a ref so the document-level listener can
  // read fresh drag state without re-binding on every drag state change.
  const activeTypeRef = useRef(activeType);
  useEffect(() => {
    activeTypeRef.current = activeType;
  }, [activeType]);

  useEffect(() => {
    if (!enabled) {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        setEditorHover(null);
      }
      return;
    }

    const onMove = (event: MouseEvent): void => {
      if (activeTypeRef.current !== null) return;

      const rawTarget = event.target;
      const target = rawTarget instanceof Element ? rawTarget : null;
      const el = target?.closest<HTMLElement>('[data-node-id]') ?? null;

      if (el === null) {
        if (lastIdRef.current !== null) {
          lastIdRef.current = null;
          setEditorHover(null);
        }
        return;
      }

      const parsed = Number.parseInt(el.dataset.nodeId ?? '', 10);
      if (!Number.isFinite(parsed) || parsed === lastIdRef.current) return;

      const node = nodeById.get(parsed);
      if (node === undefined) return;

      lastIdRef.current = parsed;
      setEditorHover(node);
    };

    const onLeaveDocument = (): void => {
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        setEditorHover(null);
      }
    };

    document.addEventListener('mousemove', onMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onLeaveDocument);

    return () => {
      document.removeEventListener('mousemove', onMove);
      document.documentElement.removeEventListener('mouseleave', onLeaveDocument);
      if (lastIdRef.current !== null) {
        lastIdRef.current = null;
        setEditorHover(null);
      }
    };
  }, [enabled, nodeById, setEditorHover]);

  return null;
}
