import { useEffect, useRef } from 'react';
import type { TreeApiResponse } from '@/types/elements';
import { resolveAncestorIds } from './ancestry';
import { useInspect } from './InspectContext';
import { createMessageBridge } from './messageBridge';
import { resolvePreviewIframe } from './resolvePreviewIframe';

interface Props {
  readonly tree: TreeApiResponse;
}

/**
 * Debounce for the editor → preview highlight hop. Mouse hover events fire
 * per pixel of movement; without the gate the parent would spam the iframe
 * with highlight messages as the cursor crosses a block.
 */
const DEBOUNCE_MS = 200;

/**
 * Invisible wiring component that bridges the InspectContext with the preview
 * iframe. Mount it inside an `<InspectProvider>` and pass the current tree —
 * nothing renders; all output is postMessage + context updates.
 *
 * Responsibilities:
 * - Subscribe to inbound preview messages (ready, hover, unhover, missing)
 *   and translate them into context updates (resolving ancestors for hover).
 * - Reset the ready flag when the iframe reloads so a cached activate can
 *   be replayed once the next ready arrives.
 * - Send activate/deactivate in response to the `enabled` flag flipping;
 *   queue the activate if the preview hasn't yet announced ready.
 * - Debounce editor-side hover events to a single highlight message per
 *   settled target; emit clear only when transitioning OUT of an editor
 *   hover (never on initial mount or after a preview-source hover).
 */
export function InspectBridgeHost({ tree }: Props): null {
  const { enabled, hover, setPreviewHover, clearHover, setMissing } = useInspect();
  // Bridge is a pure value object with no internal state — safe to lazily
  // build once per mount.
  const bridgeRef = useRef(createMessageBridge(resolvePreviewIframe));
  const readyRef = useRef(false);
  const queuedActivateRef = useRef(false);

  // Inbound: translate preview messages into context updates.
  useEffect(() => {
    const bridge = bridgeRef.current;
    const unsubscribe = bridge.subscribe((message) => {
      switch (message.type) {
        case 'grid-inspect:ready': {
          readyRef.current = true;
          if (queuedActivateRef.current) {
            bridge.send({ type: 'grid-inspect:activate' });
            queuedActivateRef.current = false;
          }
          return;
        }
        case 'grid-inspect:hover': {
          const ancestors = resolveAncestorIds(tree, message.id);
          setPreviewHover(message.id, ancestors);
          return;
        }
        case 'grid-inspect:unhover': {
          clearHover();
          return;
        }
        case 'grid-inspect:missing': {
          setMissing(true);
          return;
        }
      }
    });
    return unsubscribe;
  }, [tree, setPreviewHover, clearHover, setMissing]);

  // Reset ready flag on iframe reload — the preview bundle re-announces
  // ready on every load, so any stale ready state from before the
  // navigation would otherwise cause queued activates to drop silently.
  useEffect(() => {
    const iframe = resolvePreviewIframe();
    if (iframe === null) return;
    const onLoad = (): void => {
      readyRef.current = false;
    };
    iframe.addEventListener('load', onLoad);
    return () => iframe.removeEventListener('load', onLoad);
  }, []);

  // Activate / deactivate handshake.
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (enabled) {
      if (readyRef.current) {
        bridge.send({ type: 'grid-inspect:activate' });
      } else {
        // Queued — flushed when the preview's ready arrives.
        queuedActivateRef.current = true;
      }
      return;
    }
    bridge.send({ type: 'grid-inspect:deactivate' });
    queuedActivateRef.current = false;
  }, [enabled]);

  // Editor hover → preview. `lastEditorHoverIdRef` tracks the last HIGHLIGHT
  // we actually sent, so `clear` only goes out when transitioning OUT of an
  // editor hover (not on initial mount, not after a preview-source hover
  // that's being cleared, and not for hovers that never completed their
  // debounce).
  const lastEditorHoverIdRef = useRef<number | null>(null);
  useEffect(() => {
    const bridge = bridgeRef.current;
    if (!enabled) {
      lastEditorHoverIdRef.current = null;
      return;
    }
    if (hover === null || hover.source !== 'editor') {
      if (lastEditorHoverIdRef.current !== null) {
        bridge.send({ type: 'grid-inspect:clear' });
        lastEditorHoverIdRef.current = null;
      }
      return;
    }
    const id = hover.id;
    const timer = window.setTimeout(() => {
      bridge.send({ type: 'grid-inspect:highlight', id });
      lastEditorHoverIdRef.current = id;
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [hover, enabled]);

  return null;
}
