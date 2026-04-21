import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { ReactNode } from 'react';
import { createSimpleElement } from '@/testing/factories';
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
import { InspectProvider, useInspect } from './InspectContext';
import { STORAGE_KEY } from './storage';

const realLocalStorage = globalThis.localStorage;

function wrapper({ children }: { children: ReactNode }): React.JSX.Element {
  return <InspectProvider>{children}</InspectProvider>;
}

describe('InspectContext', () => {
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

  it('throws when useInspect is called outside a provider', () => {
    // Suppress the React error boundary noise — we only care about the throw.
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useInspect())).toThrow(/useInspect must be used within/);
    errorSpy.mockRestore();
  });

  it('starts disabled when storage empty', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    expect(result.current.enabled).toBe(false);
    expect(result.current.hover).toBeNull();
    expect(result.current.missing).toBe(false);
  });

  it('hydrates enabled from storage', () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    const { result } = renderHook(() => useInspect(), { wrapper });
    expect(result.current.enabled).toBe(true);
  });

  it('setEnabled persists and updates state', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    act(() => result.current.setEnabled(true));
    expect(result.current.enabled).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    act(() => result.current.setEnabled(false));
    expect(result.current.enabled).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('syncs across instances via module-scoped broadcast', () => {
    const a = renderHook(() => useInspect(), { wrapper });
    const b = renderHook(() => useInspect(), { wrapper });
    act(() => a.result.current.setEnabled(true));
    expect(b.result.current.enabled).toBe(true);
    expect(a.result.current.enabled).toBe(true);
  });

  it('responds to a cross-tab storage event', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    localStorage.setItem(STORAGE_KEY, 'true');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: STORAGE_KEY }));
    });
    expect(result.current.enabled).toBe(true);
  });

  it('ignores storage events for unrelated keys', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    localStorage.setItem(STORAGE_KEY, 'true');
    act(() => {
      window.dispatchEvent(new StorageEvent('storage', { key: 'something-else' }));
    });
    expect(result.current.enabled).toBe(false);
  });

  it('setEditorHover sets editor-source hover and clearing resets it', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    const node = createSimpleElement({ id: 5 });
    act(() => result.current.setEditorHover(node));
    expect(result.current.hover).toEqual({
      source: 'editor',
      nodeKey: node.nodeKey,
      id: 5,
      ancestorIds: [],
    });
    act(() => result.current.setEditorHover(null));
    expect(result.current.hover).toBeNull();
  });

  it('setPreviewHover sets preview-source hover with ancestor ids', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    act(() => result.current.setPreviewHover(9, [1, 2, 3]));
    expect(result.current.hover).toEqual({
      source: 'preview',
      id: 9,
      ancestorIds: [1, 2, 3],
    });
  });

  it('setMissing toggles missing flag and clearHover resets it', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    act(() => result.current.setMissing(true));
    expect(result.current.missing).toBe(true);
    act(() => result.current.clearHover());
    expect(result.current.missing).toBe(false);
    expect(result.current.hover).toBeNull();
  });

  it('setEditorHover clears any missing flag', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    act(() => result.current.setMissing(true));
    const node = createSimpleElement({ id: 5 });
    act(() => result.current.setEditorHover(node));
    expect(result.current.missing).toBe(false);
  });

  it('setPreviewHover clears any missing flag', () => {
    const { result } = renderHook(() => useInspect(), { wrapper });
    act(() => result.current.setMissing(true));
    act(() => result.current.setPreviewHover(1, []));
    expect(result.current.missing).toBe(false);
  });
});
