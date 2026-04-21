import { z } from 'zod';

/**
 * Messages the editor sends TO the preview iframe.
 *
 * Kept in lockstep with the hand-rolled validator in
 * `client/src/preview/messageBridge.ts` — the preview bundle cannot depend
 * on Zod for size reasons, so drift here must be caught by paired tests.
 */
export const outboundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('grid-inspect:activate') }),
  z.object({ type: z.literal('grid-inspect:deactivate') }),
  z.object({ type: z.literal('grid-inspect:highlight'), id: z.number().finite() }),
  z.object({ type: z.literal('grid-inspect:clear') }),
]);

/**
 * Messages the editor receives FROM the preview iframe.
 *
 * Validated at the subscription boundary so downstream consumers only see
 * well-formed payloads regardless of what an attacker or buggy extension
 * posts into the window.
 */
export const inboundMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('grid-inspect:ready') }),
  z.object({ type: z.literal('grid-inspect:hover'), id: z.number().finite() }),
  z.object({ type: z.literal('grid-inspect:unhover') }),
  z.object({ type: z.literal('grid-inspect:missing'), id: z.number().finite() }),
]);

export type OutboundToPreview = z.infer<typeof outboundMessageSchema>;
export type InboundFromPreview = z.infer<typeof inboundMessageSchema>;
