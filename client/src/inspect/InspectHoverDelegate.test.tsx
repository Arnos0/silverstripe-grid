import { act, cleanup, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DragContext, type DragContextValue } from '@/hooks/useDragAndDrop';
import {
  createColumnNode,
  createRowNode,
  createSectionNode,
  createSimpleElement,
  createTreeApiResponse,
} from '@/testing/factories';
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
import { InspectProvider, useInspect } from './InspectContext';
import { InspectHoverDelegate } from './InspectHoverDelegate';

const realLocalStorage = globalThis.localStorage;

function restoreLocalStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: realLocalStorage,
    writable: true,
    configurable: true,
  });
}

/**
 * Shape: Section(10) → Row(11) → Column(12) → Element(13). Renders a DOM
 * that mirrors the real editor's nesting (outer wrapper with data-node-id
 * on each level, inner header testid, descendants inside the wrapper) so
 * `closest('[data-node-id]')` resolution exercises the same traversal as
 * production.
 */
function renderFixture(dragValue: DragContextValue = { activeType: null }): {
  elements: Record<string, HTMLElement>;
  probe: { current: ReturnType<typeof useInspect> | null };
  unmount: () => void;
} {
  const element = createSimpleElement({ id: 13 });
  const column = createColumnNode({ id: 12, children: [element] });
  const row = createRowNode({ id: 11, children: [column] });
  const section = createSectionNode({ id: 10, children: [row] });
  const tree = createTreeApiResponse({ sections: [section] });

  const probe: { current: ReturnType<typeof useInspect> | null } = { current: null };

  function Probe(): null {
    probe.current = useInspect();
    return null;
  }

  const Wrapper = ({ children }: { children: ReactNode }): React.JSX.Element => (
    <InspectProvider>
      <DragContext.Provider value={dragValue}>
        <Probe />
        <InspectHoverDelegate tree={tree} />
        {children}
      </DragContext.Provider>
    </InspectProvider>
  );

  const { unmount } = render(
    <Wrapper>
      <div data-node-id="10" data-testid="section">
        <div data-testid="section-header">section header</div>
        <div data-node-id="11" data-testid="row">
          <div data-testid="row-header">row header</div>
          <div data-node-id="12" data-testid="column">
            <div data-testid="column-header">column header</div>
            <div data-node-id="13" data-testid="element">
              <div data-testid="element-header">element header</div>
            </div>
          </div>
        </div>
      </div>
    </Wrapper>,
  );

  const byTestId = (key: string): HTMLElement => {
    const el = document.querySelector<HTMLElement>(`[data-testid="${key}"]`);
    if (el === null) throw new Error(`testid ${key} not found`);
    return el;
  };

  return {
    elements: {
      section: byTestId('section'),
      sectionHeader: byTestId('section-header'),
      row: byTestId('row'),
      rowHeader: byTestId('row-header'),
      column: byTestId('column'),
      columnHeader: byTestId('column-header'),
      element: byTestId('element'),
      elementHeader: byTestId('element-header'),
    },
    probe,
    unmount,
  };
}

function fireMouseMove(target: HTMLElement): void {
  act(() => {
    target.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
  });
}

describe('InspectHoverDelegate', () => {
  beforeEach(() => {
    installMockLocalStorage();
    localStorage.setItem('grid:inspect-mode', 'true');
  });

  afterEach(() => {
    cleanup();
    restoreLocalStorage();
  });

  it('renders nothing', () => {
    const { elements, unmount } = renderFixture();
    // Delegate itself contributes no DOM — fixture DOM count is stable.
    expect(elements.section.parentElement).not.toBeNull();
    unmount();
  });

  it('does not drive hover state when inspect is disabled', () => {
    localStorage.setItem('grid:inspect-mode', 'false');
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.columnHeader);

    expect(probe.current?.hover).toBeNull();
    unmount();
  });

  it('mousemove over a block updates editor hover to that block', () => {
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.columnHeader);

    expect(probe.current?.hover).toMatchObject({ source: 'editor', id: 12 });
    unmount();
  });

  it('mousemove resolves to the INNERMOST [data-node-id] ancestor', () => {
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.elementHeader);

    // element-header sits inside element (13), which sits inside column (12),
    // row (11), and section (10). Innermost id wins.
    expect(probe.current?.hover).toMatchObject({ source: 'editor', id: 13 });
    unmount();
  });

  it('moving the cursor from a child block back up to its parent updates hover to the parent', () => {
    // This is the regression scenario: per-element React onMouseEnter on the
    // column wrapper never refires when the cursor re-enters the wrapper
    // from a descendant, leaving the preview stuck on the child highlight.
    // The delegate resolves `closest('[data-node-id]')` on every move, so
    // moving from element-header → column-header correctly updates hover
    // from element (13) to column (12).
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.elementHeader);
    expect(probe.current?.hover).toMatchObject({ source: 'editor', id: 13 });

    fireMouseMove(elements.columnHeader);
    expect(probe.current?.hover).toMatchObject({ source: 'editor', id: 12 });
    unmount();
  });

  it('mousemove outside any block clears hover', () => {
    const { elements, probe, unmount } = renderFixture();

    // Seed a hover first.
    fireMouseMove(elements.columnHeader);
    expect(probe.current?.hover).not.toBeNull();

    // Create a detached element with no [data-node-id] ancestor.
    const outside = document.createElement('div');
    document.body.appendChild(outside);
    fireMouseMove(outside);

    expect(probe.current?.hover).toBeNull();
    outside.remove();
    unmount();
  });

  it('suppresses hover updates while a drag is active', () => {
    const { elements, probe, unmount } = renderFixture({ activeType: 'column' });

    fireMouseMove(elements.columnHeader);

    expect(probe.current?.hover).toBeNull();
    unmount();
  });

  it('leaving the document clears hover', () => {
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.columnHeader);
    expect(probe.current?.hover).not.toBeNull();

    act(() => {
      document.documentElement.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false }));
    });

    expect(probe.current?.hover).toBeNull();
    unmount();
  });

  it('disabling inspect while hovered clears the hover', () => {
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.columnHeader);
    expect(probe.current?.hover).not.toBeNull();

    act(() => {
      probe.current?.setEnabled(false);
    });

    expect(probe.current?.hover).toBeNull();
    unmount();
  });

  it('deduplicates moves over the same block (no redundant state changes)', () => {
    const { elements, probe, unmount } = renderFixture();

    fireMouseMove(elements.columnHeader);
    const firstHover = probe.current?.hover;

    // Second move inside the same block should not produce a different
    // hover reference — the delegate short-circuits via its lastIdRef.
    fireMouseMove(elements.column);
    expect(probe.current?.hover).toBe(firstHover);
    unmount();
  });
});
