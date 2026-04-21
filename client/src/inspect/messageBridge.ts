import { type InboundFromPreview, inboundMessageSchema, type OutboundToPreview } from './schemas';

export type { InboundFromPreview, OutboundToPreview };

export interface MessageBridge {
  send(message: OutboundToPreview): void;
  subscribe(handler: (message: InboundFromPreview) => void): () => void;
}

/**
 * Create a bridge that posts typed messages to the preview iframe and
 * subscribes to typed messages coming back.
 *
 * The iframe is resolved lazily via `resolveIframe` so that sends issued
 * before the iframe renders, or after it's been detached and re-attached,
 * always target the current element instead of a cached reference.
 *
 * Inbound messages are filtered by `window.location.origin` and parsed by
 * the Zod schema — handlers never see malformed or cross-origin payloads.
 */
export function createMessageBridge(resolveIframe: () => HTMLIFrameElement | null): MessageBridge {
  return {
    send(message) {
      const iframe = resolveIframe();
      iframe?.contentWindow?.postMessage(message, window.location.origin);
    },
    subscribe(handler) {
      const listener = (event: MessageEvent): void => {
        if (event.origin !== window.location.origin) return;
        const result = inboundMessageSchema.safeParse(event.data);
        if (!result.success) return;
        handler(result.data);
      };
      window.addEventListener('message', listener);
      return () => window.removeEventListener('message', listener);
    },
  };
}
