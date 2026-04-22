import { describe, expect, it } from 'vitest';
import type { TreeApiResponse } from '@/types/elements';
import {
  createColumnNode,
  createRowNode,
  createSectionNode,
  createSimpleElement,
  createTreeApiResponse,
} from '@/testing/factories';
import { resolveAncestorIds, resolveAncestorPath } from './ancestry';

/**
 * Build a Section(10) > Row(11) > Column(12) > Element(13) tree. Using the
 * canonical factories guarantees the nodes carry every BaseFields key
 * (self/parent/nodeKey/parentKey/blockSchema/etc.) so the test is robust to
 * type changes — only the walk semantics are asserted here.
 */
function buildLinearTree(): TreeApiResponse {
  const element = createSimpleElement({ id: 13, parent: { type: 'column', id: 12 } });
  const column = createColumnNode({
    id: 12,
    parent: { type: 'row', id: 11 },
    children: [element],
  });
  const row = createRowNode({
    id: 11,
    parent: { type: 'section', id: 10 },
    children: [column],
  });
  const section = createSectionNode({
    id: 10,
    parent: { type: 'page', id: 1 },
    children: [row],
  });
  return createTreeApiResponse({ rootParent: { type: 'page', id: 1 }, sections: [section] });
}

describe('resolveAncestorIds', () => {
  it('returns outside-in ancestor ids for a leaf', () => {
    const tree = buildLinearTree();
    expect(resolveAncestorIds(tree, 13)).toEqual([10, 11, 12]);
  });

  it('returns ancestor ids for an intermediate column', () => {
    const tree = buildLinearTree();
    expect(resolveAncestorIds(tree, 12)).toEqual([10, 11]);
  });

  it('returns ancestor ids for an intermediate row', () => {
    const tree = buildLinearTree();
    expect(resolveAncestorIds(tree, 11)).toEqual([10]);
  });

  it('returns empty array for a root section', () => {
    const tree = buildLinearTree();
    expect(resolveAncestorIds(tree, 10)).toEqual([]);
  });

  it('returns empty array when id is missing from the tree', () => {
    const tree = buildLinearTree();
    expect(resolveAncestorIds(tree, 999)).toEqual([]);
  });

  it('walks nested siblings correctly across multiple sections', () => {
    // Two sections sharing a page parent; pick the leaf of the second one.
    const e1 = createSimpleElement({ id: 200, parent: { type: 'column', id: 150 } });
    const c1 = createColumnNode({
      id: 150,
      parent: { type: 'row', id: 120 },
      children: [e1],
    });
    const r1 = createRowNode({
      id: 120,
      parent: { type: 'section', id: 100 },
      children: [c1],
    });
    const s1 = createSectionNode({
      id: 100,
      parent: { type: 'page', id: 1 },
      children: [r1],
    });

    const e2 = createSimpleElement({ id: 203, parent: { type: 'column', id: 152 } });
    const c2 = createColumnNode({
      id: 152,
      parent: { type: 'row', id: 122 },
      children: [e2],
    });
    const r2 = createRowNode({
      id: 122,
      parent: { type: 'section', id: 102 },
      children: [c2],
    });
    const s2 = createSectionNode({
      id: 102,
      parent: { type: 'page', id: 1 },
      children: [r2],
    });

    const tree = createTreeApiResponse({
      rootParent: { type: 'page', id: 1 },
      sections: [s1, s2],
    });

    expect(resolveAncestorIds(tree, 203)).toEqual([102, 122, 152]);
    expect(resolveAncestorIds(tree, 200)).toEqual([100, 120, 150]);
  });
});

describe('resolveAncestorPath', () => {
  it('returns outside-in path including the target as the last segment', () => {
    const tree = buildLinearTree();
    const path = resolveAncestorPath(tree, 13);
    expect(path.map((s) => s.id)).toEqual([10, 11, 12, 13]);
    expect(path.map((s) => s.type)).toEqual(['section', 'row', 'column', 'element']);
  });

  it('carries titles alongside ids so consumers can render a breadcrumb without looking nodes back up', () => {
    // Build with explicit titles that a real tree would carry.
    const element = createSimpleElement({
      id: 13,
      parent: { type: 'column', id: 12 },
      title: 'Hero paragraph',
    });
    const column = createColumnNode({
      id: 12,
      parent: { type: 'row', id: 11 },
      children: [element],
      title: 'Column 2',
    });
    const row = createRowNode({
      id: 11,
      parent: { type: 'section', id: 10 },
      children: [column],
      title: 'Row 1',
    });
    const section = createSectionNode({
      id: 10,
      parent: { type: 'page', id: 1 },
      children: [row],
      title: 'Section 1',
    });
    const tree = createTreeApiResponse({
      rootParent: { type: 'page', id: 1 },
      sections: [section],
    });

    expect(resolveAncestorPath(tree, 13).map((s) => s.title)).toEqual([
      'Section 1',
      'Row 1',
      'Column 2',
      'Hero paragraph',
    ]);
  });

  it('returns a single-segment path for a root section (just the section itself)', () => {
    const tree = buildLinearTree();
    const path = resolveAncestorPath(tree, 10);
    expect(path).toHaveLength(1);
    expect(path[0].id).toBe(10);
  });

  it('returns an empty path when the id is missing from the tree', () => {
    const tree = buildLinearTree();
    expect(resolveAncestorPath(tree, 999)).toEqual([]);
  });
});
