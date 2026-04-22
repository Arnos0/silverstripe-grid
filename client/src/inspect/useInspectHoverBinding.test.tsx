import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { createSimpleElement } from '@/testing/factories';
import { useInspectHoverBinding } from './useInspectHoverBinding';

describe('useInspectHoverBinding', () => {
  it('returns data-node-id as a string derived from node.id', () => {
    const node = createSimpleElement({ id: 42 });
    const { result } = renderHook(() => useInspectHoverBinding(node));
    expect(result.current['data-node-id']).toBe('42');
  });

  it('stringifies arbitrary numeric ids', () => {
    const node = createSimpleElement({ id: 1 });
    const { result } = renderHook(() => useInspectHoverBinding(node));
    expect(result.current['data-node-id']).toBe('1');
  });
});
