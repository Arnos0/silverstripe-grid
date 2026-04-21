import { type ElementNode, isContainerNode, type TreeApiResponse } from '@/types/elements';
import type { NodeKey } from '@/types/identity';

/**
 * Walk the tree depth-first and index every node by composite `nodeKey` and
 * by numeric `id`. The tree's `nodes` field is a shallow list of root-level
 * sections — descendants live under `children` on container nodes, so we
 * must recurse to reach every element.
 */
function indexTree(tree: TreeApiResponse): {
  byKey: Map<NodeKey, ElementNode>;
  byId: Map<number, ElementNode>;
} {
  const byKey = new Map<NodeKey, ElementNode>();
  const byId = new Map<number, ElementNode>();

  const visit = (node: ElementNode): void => {
    byKey.set(node.nodeKey, node);
    byId.set(node.id, node);
    if (isContainerNode(node) && node.children !== null) {
      for (const child of node.children) visit(child);
    }
  };

  for (const node of tree.nodes) visit(node);

  return { byKey, byId };
}

/**
 * Resolve the outside-in list of ancestor ids for a node in the tree.
 *
 * - For a root-level section, returns an empty array — its parent is the page
 *   (no matching element node).
 * - For any nested node, returns `[rootSection, ..., immediateParent]` so the
 *   preview highlight can draw nested halos/breadcrumbs in document order.
 * - Returns an empty array when the id isn't found; callers should treat that
 *   as "no highlight" rather than as an error.
 *
 * Traversal uses `parentKey` (`"type-id"`) not bare `parentId` because page
 * IDs and element IDs share the same numeric namespace — keying by id alone
 * would collide whenever a page and an element coincidentally share an id.
 */
export function resolveAncestorIds(tree: TreeApiResponse, id: number): number[] {
  const { byKey, byId } = indexTree(tree);

  const start = byId.get(id);
  if (start === undefined) return [];

  const ancestors: number[] = [];
  let current: ElementNode = start;
  while (true) {
    const parent = byKey.get(current.parentKey);
    if (parent === undefined) break; // reached the page (no element node)
    ancestors.push(parent.id);
    current = parent;
  }
  return ancestors.reverse();
}
