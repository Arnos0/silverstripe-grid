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
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
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

// Controllable resolver: tests can swap the returned iframe to simulate the
// preview pane mounting after the editor (the real CMS lifecycle).
let currentIframe: HTMLIFrameElement | null = iframeStub;

vi.mock('./resolvePreviewIframe', () => ({
  resolvePreviewIframe: () => currentIframe,
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

const realLocalStorage = globalThis.localStorage;

beforeEach(() => {
  installMockLocalStorage();
  postMessage.mockClear();
  loadListeners.clear();
  currentIframe = iframeStub;
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

  it('wires the load listener when the iframe arrives in the DOM after mount', async () => {
    // Simulate the production CMS lifecycle: editor mounts before the preview
    // iframe is attached. The MutationObserver must pick the iframe up when
    // it later appears and wire the `load` listener to it so readyRef is
    // reset and queued activates flush on the next preview ready.
    currentIframe = null;

    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);

    // Preview not here yet — toggling on queues the activate (no iframe to
    // send through).
    act(() => captured.api?.setEnabled(true));
    expect(postMessage).not.toHaveBeenCalled();

    // Late-mount the iframe. Appending a real element to document.body
    // triggers the MutationObserver; the wire() callback re-resolves
    // resolvePreviewIframe which now returns our stub.
    currentIframe = iframeStub;
    const marker = document.createElement('div');
    await act(async () => {
      document.body.appendChild(marker);
      // MutationObserver callbacks are queued as microtasks; flushing the
      // microtask queue lets the observer run before we assert.
      await Promise.resolve();
    });

    // Fire a load event on the late-arrived iframe. The listener should
    // now be wired, so readyRef resets (no visible side-effect yet — we'll
    // prove it through the ready → activate flush).
    act(() => {
      for (const listener of loadListeners) listener(new Event('load'));
    });

    // The queued activate should still be pending (readyRef is false), so
    // the next ready message flushes it.
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );

    document.body.removeChild(marker);
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

  it('sends a deactivate probe when mounting with enabled=true but no ready yet', () => {
    // Regression: on reload with inspect previously enabled, the editor
    // re-mounts with `enabled=true` directly. If the preview iframe already
    // booted and emitted its `ready` before our subscribe attached, that
    // ready is lost and `readyRef` stays false forever — leaving the queued
    // activate to never flush. The fix: send a `deactivate` probe in the
    // queuing branch so the preview echoes `ready` in response, which then
    // flips `readyRef` and flushes the queued activate.
    const captured: HarnessCaptured = { api: null };
    // Pre-seed localStorage so the provider hydrates with enabled=true.
    localStorage.setItem('grid:inspect-mode', 'true');
    render(<Harness tree={buildTree()} captured={captured} />);

    // The deactivate probe is the only outbound message at this point; the
    // activate is queued (readyRef=false) and waiting for ready.
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:deactivate' },
      window.location.origin,
    );
    expect(postMessage).not.toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );

    // Simulate the preview echoing ready in response to the deactivate probe.
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });

  it('flushes a queued activate when a `ready` arrives as a reply to an outbound control message', () => {
    // Regression test for the editor↔preview race: the iframe boots and
    // posts its initial `ready` before InspectBridgeHost has wired its
    // subscribe effect, so that ready is lost. The fix lives on the preview
    // side — it echoes `ready` on every inbound control message. This test
    // simulates that echo behaviour and asserts the editor recovers.
    const captured: HarnessCaptured = { api: null };
    render(<Harness tree={buildTree()} captured={captured} />);
    // User toggles on before any `ready` has been received. Activate is
    // queued but cannot dispatch — readyRef is still false.
    act(() => captured.api?.setEnabled(true));
    expect(postMessage).not.toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );

    // The preview receives the editor's deactivate (from the initial
    // `enabled=false` effect on mount) and echoes `ready` in response.
    // With the subscribe now live, that ready unsticks the queue.
    act(() => dispatchPreviewMessage({ type: 'grid-inspect:ready' }));

    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });
});
