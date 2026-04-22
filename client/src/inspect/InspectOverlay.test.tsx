import { act, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSimpleElement } from '@/testing/factories';
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
import type { PathSegment } from './ancestry';
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

/** Shorthand for building a PathSegment — keeps tests terse. */
function pathSegment(overrides: Partial<PathSegment> & { id: number }): PathSegment {
  return {
    id: overrides.id,
    title: overrides.title ?? `Element ${overrides.id}`,
    type: overrides.type ?? 'element',
  };
}

describe('InspectOverlay', () => {
  beforeEach(() => {
    installMockLocalStorage();
    // Stub getBoundingClientRect so the halo has a deterministic rect.
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      top: 200,
      left: 100,
      width: 300,
      height: 60,
      right: 400,
      bottom: 260,
      x: 100,
      y: 200,
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
    expect(screen.queryByTestId('inspect-breadcrumb')).not.toBeInTheDocument();
  });

  it('renders nothing for editor-source hover (overlay is preview->editor only)', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    act(() => {
      apiRef.current?.setEditorHover(createSimpleElement({ id: 5 }));
    });
    expect(screen.queryByTestId('inspect-halo')).not.toBeInTheDocument();
    expect(screen.queryByTestId('inspect-breadcrumb')).not.toBeInTheDocument();
  });

  it('renders a solid halo for a direct hit (target is in the editor DOM)', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    act(() => {
      apiRef.current?.setPreviewHover(5, [], [pathSegment({ id: 5, title: 'Hero' })]);
    });
    const halo = screen.getByTestId('inspect-halo');
    expect(halo).toHaveClass('inspect-halo');
    expect(halo).not.toHaveClass('inspect-halo--indirect');
    expect(halo).not.toHaveClass('inspect-halo--missing');
    expect(halo).toHaveStyle({ top: '200px', left: '100px', width: '300px', height: '60px' });
  });

  it('renders a dashed indirect halo when the target is inside a collapsed ancestor', () => {
    // Only the outer section is rendered — 99 (the target) is not in the DOM.
    // ancestorIds is [outermost, ..., immediate parent] per contract.
    const { apiRef } = renderOverlay(<div data-node-id="1" />);
    act(() => {
      apiRef.current?.setPreviewHover(
        99,
        [1, 3],
        [
          pathSegment({ id: 1, title: 'Section 1', type: 'section' }),
          pathSegment({ id: 3, title: 'Row 1', type: 'row' }),
          pathSegment({ id: 99, title: 'Paragraph', type: 'element' }),
        ],
      );
    });
    const halo = screen.getByTestId('inspect-halo');
    expect(halo).toHaveClass('inspect-halo--indirect');
    expect(halo).not.toHaveClass('inspect-halo--missing');
  });

  it('returns null when neither the target nor any ancestor is in the DOM', () => {
    const { apiRef } = renderOverlay(<div />);
    act(() => {
      apiRef.current?.setPreviewHover(
        99,
        [1, 2, 3],
        [
          pathSegment({ id: 1 }),
          pathSegment({ id: 2 }),
          pathSegment({ id: 3 }),
          pathSegment({ id: 99 }),
        ],
      );
    });
    expect(screen.queryByTestId('inspect-halo')).not.toBeInTheDocument();
  });

  it('calls scrollIntoView on the halo target', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    const target = document.querySelector<HTMLElement>('[data-node-id="5"]');
    expect(target).not.toBeNull();
    act(() => {
      apiRef.current?.setPreviewHover(5, [], [pathSegment({ id: 5 })]);
    });
    expect(target?.scrollIntoView).toHaveBeenCalledWith({
      behavior: 'smooth',
      block: 'nearest',
    });
  });

  it('renders the missing variant when the context marks the target as missing', () => {
    const { apiRef } = renderOverlay(<div data-node-id="5" />);
    act(() => {
      apiRef.current?.setPreviewHover(5, [], [pathSegment({ id: 5 })]);
      apiRef.current?.setMissing(true);
    });
    const halo = screen.getByTestId('inspect-halo');
    expect(halo).toHaveClass('inspect-halo--missing');
  });

  describe('breadcrumb', () => {
    it('renders the full Section › Row › Column › Element trail', () => {
      const { apiRef } = renderOverlay(<div data-node-id="5" />);
      act(() => {
        apiRef.current?.setPreviewHover(
          5,
          [1, 2, 3],
          [
            pathSegment({ id: 1, title: 'Section 1', type: 'section' }),
            pathSegment({ id: 2, title: 'Row 1', type: 'row' }),
            pathSegment({ id: 3, title: 'Column 2', type: 'column' }),
            pathSegment({ id: 5, title: 'Content element 1', type: 'element' }),
          ],
        );
      });
      const breadcrumb = screen.getByTestId('inspect-breadcrumb');
      expect(breadcrumb).toHaveTextContent(
        /Section 1\s*›\s*Row 1\s*›\s*Column 2\s*›\s*Content element 1/,
      );
    });

    it('dims segments whose containers are collapsed (not in the editor DOM)', () => {
      // Only Section 1 is rendered — Row and Column aren't in the DOM because
      // Section 1 is "collapsed". The target's direct block is also missing.
      const { apiRef } = renderOverlay(<div data-node-id="1" />);
      act(() => {
        apiRef.current?.setPreviewHover(
          99,
          [1, 2, 3],
          [
            pathSegment({ id: 1, title: 'Section 1', type: 'section' }),
            pathSegment({ id: 2, title: 'Row 1', type: 'row' }),
            pathSegment({ id: 3, title: 'Column 2', type: 'column' }),
            pathSegment({ id: 99, title: 'Content element 1', type: 'element' }),
          ],
        );
      });
      const breadcrumb = screen.getByTestId('inspect-breadcrumb');
      // Section 1 is visible — no hidden attribute.
      expect(breadcrumb.querySelector('[data-segment-type="section"]')).not.toHaveAttribute(
        'data-segment-hidden',
      );
      // Row, Column, and the target are hidden (collapsed ancestors).
      expect(breadcrumb.querySelector('[data-segment-type="row"]')).toHaveAttribute(
        'data-segment-hidden',
        'true',
      );
      expect(breadcrumb.querySelector('[data-segment-type="column"]')).toHaveAttribute(
        'data-segment-hidden',
        'true',
      );
      expect(breadcrumb.querySelector('[data-segment-type="element"]')).toHaveAttribute(
        'data-segment-hidden',
        'true',
      );
    });

    it('marks the final segment as the target', () => {
      const { apiRef } = renderOverlay(<div data-node-id="5" />);
      act(() => {
        apiRef.current?.setPreviewHover(
          5,
          [1],
          [
            pathSegment({ id: 1, title: 'Section 1', type: 'section' }),
            pathSegment({ id: 5, title: 'Hero paragraph', type: 'element' }),
          ],
        );
      });
      const breadcrumb = screen.getByTestId('inspect-breadcrumb');
      const segments = breadcrumb.querySelectorAll('[data-segment-type]');
      expect(segments).toHaveLength(2);
      expect(segments[0]).not.toHaveAttribute('data-segment-target');
      expect(segments[1]).toHaveAttribute('data-segment-target', 'true');
    });

    it('renders no breadcrumb when path is empty even if ancestorIds resolve a halo', () => {
      // Defensive: an empty path (e.g. id not found in tree when setPreviewHover
      // was called) should not produce a bogus breadcrumb. The halo still
      // renders via ancestorIds fallback — path and ancestorIds are separate.
      const { apiRef } = renderOverlay(<div data-node-id="1" />);
      act(() => {
        apiRef.current?.setPreviewHover(99, [1], []);
      });
      expect(screen.getByTestId('inspect-halo')).toBeInTheDocument();
      expect(screen.queryByTestId('inspect-breadcrumb')).not.toBeInTheDocument();
    });
  });
});
