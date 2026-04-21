import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
import { InspectProvider, useInspect } from './InspectContext';
import { InspectOverlay } from './InspectOverlay';

const realLocalStorage = globalThis.localStorage;

function Harness({
  children,
  apiRef,
}: {
  children: ReactNode;
  apiRef: { current: ReturnType<typeof useInspect> | null };
}): React.JSX.Element {
  const api = useInspect();
  apiRef.current = api;
  return <>{children}</>;
}

function renderOverlay(targetMarkup: ReactNode): {
  apiRef: { current: ReturnType<typeof useInspect> | null };
} {
  const apiRef: { current: ReturnType<typeof useInspect> | null } = { current: null };
  render(
    <InspectProvider>
      <Harness apiRef={apiRef}>
        {targetMarkup}
        <InspectOverlay />
      </Harness>
    </InspectProvider>,
  );
  return { apiRef };
}

describe('InspectOverlay', () => {
  beforeEach(() => {
    installMockLocalStorage();
    // Stub getBoundingClientRect so the halo has a deterministic rect.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 10,
      left: 20,
      width: 100,
      height: 50,
      right: 120,
      bottom: 60,
      x: 20,
      y: 10,
      toJSON: () => ({}),
    });
    // Silence "not implemented" warnings from jsdom's scrollIntoView.
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
      value: realLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('renders nothing when hover is null', () => {
    renderOverlay(<div />);
    expect(screen.queryByTestId('inspect-halo')).not.toBeInTheDocument();
  });

  it('renders nothing for editor-source hover (overlay is preview→editor only)', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    act(() => {
      // Directly set editor-source hover via the setter.
      apiRef.current?.setEditorHover({
        id: 5,
        nodeKey: 'element-5',
        self: { type: 'element', id: 5 },
      } as Parameters<NonNullable<typeof apiRef.current>['setEditorHover']>[0]);
    });
    expect(screen.queryByTestId('inspect-halo')).not.toBeInTheDocument();
  });

  it('renders a halo with the rect of the matching [data-node-id] element', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    act(() => {
      apiRef.current?.setPreviewHover(5, []);
    });
    const halo = screen.getByTestId('inspect-halo');
    expect(halo).toHaveClass('inspect-halo');
    expect(halo).not.toHaveClass('inspect-halo--missing');
    // Positioned from getBoundingClientRect mock above.
    expect(halo).toHaveStyle({ top: '10px', left: '20px', width: '100px', height: '50px' });
  });

  it('falls back to the innermost ancestor when the direct target is missing', () => {
    // Only the outer section is present in the DOM. The inner column/element IDs
    // (3, 7) don't exist — the overlay must walk ancestorIds inside-out and
    // halo the nearest one that does: ancestorIds[last] = immediate parent.
    const { apiRef } = renderOverlay(<div data-node-id="1" />);
    act(() => {
      // ancestor order is [outermost, ..., immediate parent] per
      // InspectContext's contract (see resolveAncestorIds).
      apiRef.current?.setPreviewHover(99, [1, 3]);
    });
    // ancestorIds reversed = [3, 1]. `3` doesn't exist; falls through to `1`.
    expect(screen.getByTestId('inspect-halo')).toBeInTheDocument();
  });

  it('returns null when neither the target nor any ancestor is in the DOM', () => {
    const { apiRef } = renderOverlay(<div />);
    act(() => {
      apiRef.current?.setPreviewHover(99, [1, 2, 3]);
    });
    expect(screen.queryByTestId('inspect-halo')).not.toBeInTheDocument();
  });

  it('calls scrollIntoView on the target when the halo is shown', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    const target = document.querySelector<HTMLElement>('[data-node-id="5"]');
    expect(target).not.toBeNull();
    act(() => {
      apiRef.current?.setPreviewHover(5, []);
    });
    expect(target?.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });
  });

  it('renders the missing variant when the context marks the target as missing', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    act(() => {
      apiRef.current?.setPreviewHover(5, []);
      apiRef.current?.setMissing(true);
    });
    const halo = screen.getByTestId('inspect-halo');
    expect(halo).toHaveClass('inspect-halo');
    expect(halo).toHaveClass('inspect-halo--missing');
  });
});
