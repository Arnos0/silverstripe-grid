import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  type InboundMessage,
  isInboundMessage,
  type OutboundMessage,
  postToParent,
  subscribeToParent,
} from './messageBridge';

describe('isInboundMessage', () => {
  it.each([
    ['activate', { type: 'grid-inspect:activate' }, true],
    ['deactivate', { type: 'grid-inspect:deactivate' }, true],
    ['highlight with id', { type: 'grid-inspect:highlight', id: 5 }, true],
    ['highlight missing id', { type: 'grid-inspect:highlight' }, false],
    ['highlight non-numeric id', { type: 'grid-inspect:highlight', id: '5' }, false],
    ['clear', { type: 'grid-inspect:clear' }, true],
    ['unknown type', { type: 'grid-inspect:wat' }, false],
    ['unprefixed', { type: 'highlight' }, false],
    ['non-object', 'activate', false],
    ['null', null, false],
  ])('%s → %s', (_label, input, expected) => {
    expect(isInboundMessage(input)).toBe(expected);
  });
});

describe('postToParent', () => {
  // Preserve the original parent and restore it afterwards — jsdom
  // defineProperty overrides can leak across tests otherwise.
  const originalParentDescriptor = Object.getOwnPropertyDescriptor(window, 'parent');

  afterEach(() => {
    if (originalParentDescriptor !== undefined) {
      Object.defineProperty(window, 'parent', originalParentDescriptor);
    }
  });

  it('posts to window.parent with the page origin', () => {
    const postMessage = vi.fn();
    Object.defineProperty(window, 'parent', {
      configurable: true,
      value: { postMessage },
    });
    const originalOrigin = window.location.origin;

    const msg: OutboundMessage = { type: 'grid-inspect:hover', id: 3 };
    postToParent(msg);

    expect(postMessage).toHaveBeenCalledWith(msg, originalOrigin);
  });
});

describe('subscribeToParent', () => {
  const origin = 'http://localhost';
  let handlerCalls: InboundMessage[];

  beforeEach(() => {
    handlerCalls = [];
  });

  it('invokes handler for same-origin valid messages and ignores others', () => {
    const unsubscribe = subscribeToParent(origin, (msg) => handlerCalls.push(msg));

    // valid: same origin, valid type
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        data: { type: 'grid-inspect:activate' },
      }),
    );
    // rejected: wrong origin
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'http://evil.example',
        data: { type: 'grid-inspect:activate' },
      }),
    );
    // rejected: malformed payload
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        data: { type: 'grid-inspect:highlight' },
      }),
    );

    expect(handlerCalls).toEqual([{ type: 'grid-inspect:activate' }]);
    unsubscribe();
  });

  it('unsubscribe removes the listener', () => {
    const unsubscribe = subscribeToParent(origin, (msg) => handlerCalls.push(msg));
    unsubscribe();
    window.dispatchEvent(
      new MessageEvent('message', {
        origin,
        data: { type: 'grid-inspect:activate' },
      }),
    );
    expect(handlerCalls).toEqual([]);
  });
});
