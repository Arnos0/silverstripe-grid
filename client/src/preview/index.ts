import './styles.css';
import { activate, clear, createInspector, deactivate, highlight } from './inspector';
import { postToParent, subscribeToParent } from './messageBridge';

if (typeof window !== 'undefined' && window !== window.top) {
  boot();
}

// Exported for direct unit testing. The real runtime gate is above — in tests,
// `window === window.top`, so calling `boot()` by hand is the only way to
// exercise the handshake.
export function boot(): void {
  const inspector = createInspector();

  const unsubscribe = subscribeToParent(window.location.origin, (message) => {
    // Echo `ready` on every inbound message from the parent. The iframe's
    // boot-time `ready` can arrive before the editor's InspectBridgeHost has
    // wired its subscribe listener (preview.js runs during parse, while the
    // parent's `useEffect` subscribe is deferred to the commit phase). When
    // that happens, the editor's `readyRef` stays `false` indefinitely, so a
    // later toggle-on queues `activate` but never flushes. Piggy-backing a
    // `ready` response on every control message closes that race without a
    // dedicated handshake: the editor's first outbound (`deactivate` on
    // mount, or `activate` on toggle) triggers a fresh `ready` the parent
    // receives on its now-live subscription.
    postToParent({ type: 'grid-inspect:ready' });

    switch (message.type) {
      case 'grid-inspect:activate':
        activate(inspector);
        return;
      case 'grid-inspect:deactivate':
        deactivate(inspector);
        return;
      case 'grid-inspect:highlight':
        highlight(inspector, message.id);
        return;
      case 'grid-inspect:clear':
        clear(inspector);
        return;
    }
  });

  postToParent({ type: 'grid-inspect:ready' });

  window.addEventListener('unload', () => {
    unsubscribe();
    inspector.destroy();
  });
}
