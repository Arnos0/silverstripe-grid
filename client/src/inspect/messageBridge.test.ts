import { describe, expect, it, vi } from 'vitest';
import { createMessageBridge, type InboundFromPreview } from './messageBridge';

describe('createMessageBridge', () => {
  it('sends outbound messages to the iframe with the page origin', () => {
    const postMessage = vi.fn();
    const iframe = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;
    const bridge = createMessageBridge(() => iframe);
    bridge.send({ type: 'grid-inspect:activate' });
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:activate' },
      window.location.origin,
    );
  });

  it('sends highlight with id', () => {
    const postMessage = vi.fn();
    const iframe = { contentWindow: { postMessage } } as unknown as HTMLIFrameElement;
    const bridge = createMessageBridge(() => iframe);
    bridge.send({ type: 'grid-inspect:highlight', id: 42 });
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'grid-inspect:highlight', id: 42 },
      window.location.origin,
    );
  });

  it('is a no-op when iframe is missing', () => {
    const bridge = createMessageBridge(() => null);
    expect(() => bridge.send({ type: 'grid-inspect:clear' })).not.toThrow();
  });

  it('is a no-op when iframe has no contentWindow', () => {
    const iframe = { contentWindow: null } as unknown as HTMLIFrameElement;
    const bridge = createMessageBridge(() => iframe);
    expect(() => bridge.send({ type: 'grid-inspect:clear' })).not.toThrow();
  });

  it('subscribes to preview messages with origin filter and schema validation', () => {
    const iframe = { contentWindow: window } as unknown as HTMLIFrameElement;
    const bridge = createMessageBridge(() => iframe);
    const received: InboundFromPreview[] = [];
    const unsubscribe = bridge.subscribe((m) => received.push(m));

    // valid
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'grid-inspect:hover', id: 5 },
      }),
    );
    // wrong origin
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://evil',
        data: { type: 'grid-inspect:hover', id: 5 },
      }),
    );
    // malformed — missing id
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'grid-inspect:hover' },
      }),
    );

    expect(received).toEqual([{ type: 'grid-inspect:hover', id: 5 }]);
    unsubscribe();
  });

  it('delivers ready / unhover / missing messages', () => {
    const iframe = { contentWindow: window } as unknown as HTMLIFrameElement;
    const bridge = createMessageBridge(() => iframe);
    const received: InboundFromPreview[] = [];
    const unsubscribe = bridge.subscribe((m) => received.push(m));

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'grid-inspect:ready' },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'grid-inspect:unhover' },
      }),
    );
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'grid-inspect:missing', id: 7 },
      }),
    );

    expect(received).toEqual([
      { type: 'grid-inspect:ready' },
      { type: 'grid-inspect:unhover' },
      { type: 'grid-inspect:missing', id: 7 },
    ]);
    unsubscribe();
  });

  it('unsubscribe removes the listener', () => {
    const iframe = { contentWindow: window } as unknown as HTMLIFrameElement;
    const bridge = createMessageBridge(() => iframe);
    const received: InboundFromPreview[] = [];
    const unsubscribe = bridge.subscribe((m) => received.push(m));
    unsubscribe();

    window.dispatchEvent(
      new MessageEvent('message', {
        origin: window.location.origin,
        data: { type: 'grid-inspect:ready' },
      }),
    );
    expect(received).toEqual([]);
  });
});
