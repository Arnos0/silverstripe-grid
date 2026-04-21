import { afterEach, describe, expect, it } from 'vitest';
import { boot } from './index';

interface Posted {
  type: string;
  [key: string]: unknown;
}

/**
 * Install a stub `window.parent` whose `postMessage` collects outbound calls.
 * The preview uses `window.parent.postMessage` for every outbound message, so
 * this is sufficient to capture every handshake step.
 */
function stubParent(): { posts: Posted[]; restore: () => void } {
  const posts: Posted[] = [];
  const originalDescriptor = Object.getOwnPropertyDescriptor(window, 'parent');
  Object.defineProperty(window, 'parent', {
    configurable: true,
    value: { postMessage: (m: Posted) => posts.push(m) },
  });
  return {
    posts,
    restore: () => {
      if (originalDescriptor !== undefined) {
        Object.defineProperty(window, 'parent', originalDescriptor);
      }
    },
  };
}

function dispatchFromParent(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { origin: window.location.origin, data }));
}

describe('preview boot handshake', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('posts `ready` on boot', () => {
    const stub = stubParent();
    boot();
    expect(stub.posts).toContainEqual({ type: 'grid-inspect:ready' });
    stub.restore();
  });

  it('re-posts `ready` whenever the parent sends a control message', () => {
    // Regression guard for the preview→editor handshake race: preview.js
    // runs during the iframe's HTML parse and posts ready before the editor's
    // React-based subscribe effect has wired its listener. Without this
    // re-announce, the editor's `readyRef` stays `false` forever and any
    // later toggle-on leaves `activate` stuck in the queue.
    const stub = stubParent();
    boot();
    // Drop the boot-time ready so assertions only see responses.
    stub.posts.length = 0;

    dispatchFromParent({ type: 'grid-inspect:deactivate' });
    expect(stub.posts).toContainEqual({ type: 'grid-inspect:ready' });

    stub.posts.length = 0;
    dispatchFromParent({ type: 'grid-inspect:activate' });
    expect(stub.posts).toContainEqual({ type: 'grid-inspect:ready' });

    stub.posts.length = 0;
    dispatchFromParent({ type: 'grid-inspect:highlight', id: 5 });
    expect(stub.posts).toContainEqual({ type: 'grid-inspect:ready' });

    stub.posts.length = 0;
    dispatchFromParent({ type: 'grid-inspect:clear' });
    expect(stub.posts).toContainEqual({ type: 'grid-inspect:ready' });

    stub.restore();
  });

  it('ignores malformed or cross-origin messages (no ready echo, no handler run)', () => {
    const stub = stubParent();
    boot();
    stub.posts.length = 0;

    // Wrong origin — discarded by subscribeToParent's filter.
    window.dispatchEvent(
      new MessageEvent('message', {
        origin: 'https://evil.example',
        data: { type: 'grid-inspect:activate' },
      }),
    );
    // Malformed — fails isInboundMessage.
    dispatchFromParent({ type: 'grid-inspect:nope' });

    expect(stub.posts).toEqual([]);
    stub.restore();
  });
});
