// Hand-rolled validators — keeps the preview bundle free of Zod.
// The shared schema surface is small enough that drift is covered by
// paired tests on editor + preview.

export type InboundMessage =
  | { type: "grid-inspect:activate" }
  | { type: "grid-inspect:deactivate" }
  | { type: "grid-inspect:highlight"; id: number }
  | { type: "grid-inspect:clear" };

export type OutboundMessage =
  | { type: "grid-inspect:ready" }
  | { type: "grid-inspect:hover"; id: number }
  | { type: "grid-inspect:unhover" }
  | { type: "grid-inspect:missing"; id: number };

export function isInboundMessage(value: unknown): value is InboundMessage {
  if (value === null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  switch (record.type) {
    case "grid-inspect:activate":
    case "grid-inspect:deactivate":
    case "grid-inspect:clear":
      return true;
    case "grid-inspect:highlight":
      return typeof record.id === "number" && Number.isFinite(record.id);
    default:
      return false;
  }
}

export function postToParent(message: OutboundMessage): void {
  window.parent.postMessage(message, window.location.origin);
}

export function subscribeToParent(
  origin: string,
  handler: (message: InboundMessage) => void,
): () => void {
  const listener = (event: MessageEvent): void => {
    if (event.origin !== origin) return;
    if (!isInboundMessage(event.data)) return;
    handler(event.data);
  };
  window.addEventListener("message", listener);
  return () => window.removeEventListener("message", listener);
}
