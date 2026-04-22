import type { ElementNode } from '@/types/elements';

/**
 * Attributes returned by {@link useInspectHoverBinding}. Spread directly on
 * the root element of a block component.
 *
 * Only `data-node-id` is attached — actual hover detection is handled by
 * {@link InspectHoverDelegate} via a single delegated `mousemove` listener.
 * Per-element React `onMouseEnter` / `onMouseLeave` handlers don't compose
 * across nested bound elements: a child's enter cancels the parent's pending
 * highlight and the parent's enter never refires when the cursor comes back
 * from that child. The delegated listener resolves the innermost
 * `[data-node-id]` ancestor on every move and drives state from that,
 * matching the preview-side inspector's hit-test model.
 */
export interface InspectHoverBindingAttrs {
  'data-node-id': string;
}

/**
 * Per-block binding helper. Kept as a hook (not a plain function) so
 * block components have a stable import point should we need to add
 * element-local state later (e.g., aria-activedescendant for keyboard
 * traversal), without churning every call site.
 */
export function useInspectHoverBinding(node: ElementNode): InspectHoverBindingAttrs {
  return {
    'data-node-id': String(node.id),
  };
}
