import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DragContext, type DragContextValue } from '@/hooks/useDragAndDrop';
import { createSimpleElement } from '@/testing/factories';
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
import { InspectProvider, useInspect } from './InspectContext';
import { useInspectHoverBinding } from './useInspectHoverBinding';

const realLocalStorage = globalThis.localStorage;

function makeWrapper(dragValue: DragContextValue = { activeType: null }) {
  return function Wrapper({ children }: { children: ReactNode }): React.JSX.Element {
    return (
      <InspectProvider>
        <DragContext.Provider value={dragValue}>{children}</DragContext.Provider>
      </InspectProvider>
    );
  };
}

describe('useInspectHoverBinding', () => {
  beforeEach(() => {
    installMockLocalStorage();
  });
  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: realLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('always returns data-node-id as a string derived from node.id', () => {
    const node = createSimpleElement({ id: 42 });
    const { result } = renderHook(() => useInspectHoverBinding(node), {
      wrapper: makeWrapper(),
    });
    expect(result.current['data-node-id']).toBe('42');
  });

  it('does not bind mouse handlers when inspect is disabled', () => {
    const node = createSimpleElement({ id: 7 });
    const { result } = renderHook(() => useInspectHoverBinding(node), {
      wrapper: makeWrapper(),
    });
    expect(result.current.onMouseEnter).toBeUndefined();
    expect(result.current.onMouseLeave).toBeUndefined();
  });

  it('binds mouse handlers when inspect is enabled and no drag is active', () => {
    const node = createSimpleElement({ id: 7 });
    // Seed storage so the provider hydrates with enabled = true
    localStorage.setItem('grid:inspect-mode', 'true');
    const { result } = renderHook(() => useInspectHoverBinding(node), {
      wrapper: makeWrapper(),
    });
    expect(result.current.onMouseEnter).toBeDefined();
    expect(result.current.onMouseLeave).toBeDefined();
  });

  it('does not bind handlers while a drag is in progress even if enabled', () => {
    const node = createSimpleElement({ id: 7 });
    localStorage.setItem('grid:inspect-mode', 'true');
    const { result } = renderHook(() => useInspectHoverBinding(node), {
      wrapper: makeWrapper({ activeType: 'section' }),
    });
    expect(result.current.onMouseEnter).toBeUndefined();
    expect(result.current.onMouseLeave).toBeUndefined();
  });

  it('onMouseEnter sets editor hover to the node and onMouseLeave clears it', () => {
    const node = createSimpleElement({ id: 55 });
    localStorage.setItem('grid:inspect-mode', 'true');

    // Combine the binding hook with useInspect in the same render so we can
    // observe the context mutations caused by invoking the handlers.
    const { result } = renderHook(
      () => ({
        binding: useInspectHoverBinding(node),
        inspect: useInspect(),
      }),
      { wrapper: makeWrapper() },
    );

    // Initial state: no hover.
    expect(result.current.inspect.hover).toBeNull();

    // onMouseEnter should set an editor-source hover for this node.
    act(() => {
      result.current.binding.onMouseEnter?.();
    });
    expect(result.current.inspect.hover).toMatchObject({
      source: 'editor',
      id: 55,
      nodeKey: node.nodeKey,
    });

    // onMouseLeave should clear the hover.
    act(() => {
      result.current.binding.onMouseLeave?.();
    });
    expect(result.current.inspect.hover).toBeNull();
  });

  it('throws when used outside an InspectProvider', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const node = createSimpleElement({ id: 1 });
    expect(() => renderHook(() => useInspectHoverBinding(node))).toThrow(
      /useInspect must be used within/,
    );
    errorSpy.mockRestore();
  });
});
