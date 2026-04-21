import { screen, waitFor } from '@testing-library/react';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createColumnNode,
  createRowNode,
  createSectionNode,
  createSimpleElement,
  createTreeApiResponse,
  resetIdCounter,
} from '@/testing/factories';
import { mockFetchSuccess } from '@/testing/mockFetch';
import { renderWithProviders } from '@/testing/renderWithProviders';
import GridEditor from '@/components/GridEditor/GridEditor';

// GridEditor already owns the InspectProvider/BridgeHost/Overlay stack — we
// test the preview -> editor direction end-to-end by dispatching the same
// MessageEvent the real preview bundle would post.
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: undefined,
    isDragging: false,
    isOver: false,
  }),
  SortableContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  verticalListSortingStrategy: {},
  horizontalListSortingStrategy: {},
}));

vi.mock('@dnd-kit/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/core')>();
  return {
    ...actual,
    DndContext: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    DragOverlay: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    MeasuringStrategy: { Always: 'always' },
  };
});

vi.mock('@/hooks/useDragAndDrop', () => ({
  useDragContext: () => ({ activeType: null }),
  DragContext: {
    Provider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  },
  useDragAndDrop: () => ({
    dndContextProps: {},
    dragState: null,
    pendingTree: null,
  }),
}));

function dispatchPreviewMessage(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data }));
}

describe('preview -> editor integration (GridEditor + InspectOverlay)', () => {
  beforeEach(() => {
    resetIdCounter();
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
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows a halo on the editor block whose data-node-id matches the hovered preview element id', async () => {
    const element = createSimpleElement({ id: 13, parent: { type: 'column', id: 12 } });
    const column = createColumnNode({
      id: 12,
      parent: { type: 'row', id: 11 },
      children: [element],
    });
    const row = createRowNode({ id: 11, parent: { type: 'section', id: 10 }, children: [column] });
    const section = createSectionNode({
      id: 10,
      parent: { type: 'page', id: 1 },
      children: [row],
    });
    const tree = createTreeApiResponse({
      rootParent: { type: 'page', id: 1 },
      sections: [section],
    });

    mockFetchSuccess(tree);

    renderWithProviders(<GridEditor pageId={1} zone="main" />);

    // Wait for the tree to load and the element-card to appear in the DOM —
    // this also guarantees InspectBridgeHost and InspectOverlay have mounted.
    await waitFor(() => expect(screen.getByTestId('element-card')).toBeInTheDocument());

    // Fire the exact same message shape the preview bundle posts on hover.
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:hover', id: 13 }));

    // The halo should appear, sized from the target's getBoundingClientRect.
    const halo = await screen.findByTestId('inspect-halo');
    expect(halo).toHaveClass('inspect-halo');
  });
});
