import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import {
  createColumnNode,
  createRowNode,
  createSectionNode,
  createSimpleElement,
  createTreeApiResponse,
} from '@/testing/factories';
import type { TreeApiResponse } from '@/types/elements';
import { InspectProvider, useInspect } from './InspectContext';
import { InspectBridgeHost } from './InspectBridgeHost';

// Controllable iframe stub. `resolvePreviewIframe` is mocked so tests don't
// touch real DOM — the returned object records postMessage calls and can
// dispatch its own `load` events.

const postMessage = vi.fn<(msg: unknown, origin: string) => void>();
const loadListeners = new Set<(event: Event) => void>();
const iframeStub: HTMLIFrameElement = {
  contentWindow: { postMessage } as unknown as Window,
  addEventListener: vi.fn((event: string, fn: (event: Event) => void) => {
    if (event === 'load') loadListeners.add(fn);
  }),
  removeEventListener: vi.fn((event: string, fn: (event: Event) => void) => {
    if (event === 'load') loadListeners.delete(fn);
  }),
} as unknown as HTMLIFrameElement;

vi.mock('./resolvePreviewIframe', () => ({
  resolvePreviewIframe: () => iframeStub,
}));

// The bridge subscribes via `window.addEventListener('message', ...)`. To
// simulate messages coming from the preview we dispatch same-origin
// MessageEvents; jsdom's window.location.origin is the origin used.

function dispatchPreviewMessage(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data }));
}

// Minimal harness that exposes the InspectApi to the test while mounting
// InspectBridgeHost under the same provider so they share state.

interface HarnessCaptured {
  api: ReturnType<typeof useInspect> | null;
}

function ApiCapture({ captured }: { captured: HarnessCaptured }): null {
  captured.api = useInspect();
  return null;
}

function Harness({
  tree,
  captured,
  children,
}: {
  tree: TreeApiResponse;
  captured: HarnessCaptured;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <InspectProvider>
      <ApiCapture captured={captured} />
      <InspectBridgeHost tree={tree} />
      {children}
    </InspectProvider>
  );
}

function buildTree(): TreeApiResponse {
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

interface MockStorage extends Storage {
  _store: Map<string, string>;
}

function createMockLocalStorage(): MockStorage {
  const store = new Map<string, string>();
  return {
    _store: store,
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
  };
}
const realLocalStorage = globalThis.localStorage;

function installMockLocalStorage(): MockStorage {
  const mock = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });
  return mock;
}

beforeEach(() => {
  installMockLocalStorage();
  postMessage.mockClear();
  loadListeners.clear();
});

afterEach(() => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: realLocalStorage,
    writable: true,
    configurable: true,
  });
  vi.useRealTimers();
});

describe('InspectBridgeHost', () => {
  it('does not send activate on mount when preview is not ready', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => captured.api?.setEnabled(true));
    // Queued — no activate until ready arrives.
    expect(postMessage).not.toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });

  it('flushes a queued activate when ready arrives', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => captured.api?.setEnabled(true));
    postMessage.mockClear();

    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });

  it('sends activate immediately when already ready', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    // Preview reports ready before editor toggles on.
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    postMessage.mockClear();

    act(() => captured.api?.setEnabled(true));

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });

  it('sends deactivate on true → false transition', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    act(() => captured.api?.setEnabled(true));
    postMessage.mockClear();

    act(() => captured.api?.setEnabled(false));

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:deactivate' },
      window.location.origin,
    );
  });

  it('debounces editor hover by 200ms before sending highlight', () => {
    vi.useFakeTimers();
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    act(() => captured.api?.setEnabled(true));
    postMessage.mockClear();

    const node = createSimpleElement({ id: 13, parent: { type: 'column', id: 12 } });
    act(() => captured.api?.setEditorHover(node));

    // Not fired yet
    expect(postMessage).not.toHaveBeenCalled();

    // Advance short of 200ms: still not fired
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(postMessage).not.toHaveBeenCalled();

    // Complete the debounce
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:highlight', id: 13 },
      window.location.origin,
    );
  });

  it('cancels a pending highlight when hover changes before debounce fires', () => {
    vi.useFakeTimers();
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    act(() => captured.api?.setEnabled(true));
    postMessage.mockClear();

    act(() =>
      captured.api?.setEditorHover(
        createSimpleElement({ id: 13, parent: { type: 'column', id: 12 } }),
      ),
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    // Change hover before the first timer fires
    act(() =>
      captured.api?.setEditorHover(
        createSimpleElement({ id: 99, parent: { type: 'column', id: 12 } }),
      ),
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });

    // Only the latest highlight should have been sent
    const highlights = postMessage.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type: string }).type === 'grid-inspect:highlight',
    );
    expect(highlights).toEqual([
      [{ type: 'grid-inspect:highlight', id: 99 }, window.location.origin],
    ]);
  });

  it('does NOT send clear on initial mount with no prior editor hover', () => {
    vi.useFakeTimers();
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    act(() => captured.api?.setEnabled(true));

    const clearCalls = postMessage.mock.calls.filter(
      ([msg]) =>
        typeof msg === 'object' &&
        msg !== null &&
        (msg as { type: string }).type === 'grid-inspect:clear',
    );
    expect(clearCalls).toEqual([]);
  });

  it('sends clear when an editor hover transitions back to null', () => {
    vi.useFakeTimers();
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    act(() => captured.api?.setEnabled(true));

    // First, complete an editor-hover highlight so lastEditorHoverIdRef is set.
    const node = createSimpleElement({ id: 13, parent: { type: 'column', id: 12 } });
    act(() => captured.api?.setEditorHover(node));
    act(() => {
      vi.advanceTimersByTime(200);
    });
    postMessage.mockClear();

    // Now clear — should dispatch clear immediately.
    act(() => captured.api?.setEditorHover(null));
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:clear' },
      window.location.origin,
    );
  });

  it('invokes setPreviewHover with resolved ancestor ids on preview hover', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:hover', id: 13 }));

    expect(captured.api?.hover).toEqual({
      source: 'preview',
      id: 13,
      ancestorIds: [10, 11, 12],
    });
  });

  it('invokes clearHover on preview unhover', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:hover', id: 13 }));
    expect(captured.api?.hover).not.toBeNull();

    act(() => dispatchPreviewMessage({ type: 'grid-inspect:unhover' }));
    expect(captured.api?.hover).toBeNull();
  });

  it('sets missing flag on preview missing message', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:missing', id: 77 }));
    expect(captured.api?.missing).toBe(true);
  });

  it('resets ready flag when the iframe emits load', () => {
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    // Arrive at ready + activated state
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    act(() => captured.api?.setEnabled(true));
    postMessage.mockClear();

    // Iframe reloads: readyRef resets internally.
    act(() => {
      for (const listener of loadListeners) listener(new Event('load'));
    });

    // Toggling off/on should now queue (no ready yet) — activate should NOT
    // be dispatched until a new ready message arrives.
    act(() => captured.api?.setEnabled(false));
    postMessage.mockClear();
    act(() => captured.api?.setEnabled(true));
    expect(postMessage).not.toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );

    // New ready → flushes the queued activate.
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });

  it('renders nothing', () => {
    // InspectBridgeHost is a wiring component — it should not inject DOM.
    const captured: HarnessCaptured = { api: null };
    const { container } = render(
      <Harness tree={buildTree()} captured={captured}>
        <span data-testid="sibling">sibling</span>
      </Harness>,
    );
    // Only the <span> we pass as a child survives.
    expect(container.textContent).toBe('sibling');
  });
});
