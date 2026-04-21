import { activate, clear, createInspector, deactivate, highlight } from "./inspector";
import { postToParent, subscribeToParent } from "./messageBridge";

if (typeof window !== "undefined" && window !== window.top) {
  boot();
}

function boot(): void {
  const inspector = createInspector();

  const unsubscribe = subscribeToParent(window.location.origin, (message) => {
    switch (message.type) {
      case "grid-inspect:activate":
        activate(inspector);
        return;
      case "grid-inspect:deactivate":
        deactivate(inspector);
        return;
      case "grid-inspect:highlight":
        highlight(inspector, message.id);
        return;
      case "grid-inspect:clear":
        clear(inspector);
        return;
    }
  });

  postToParent({ type: "grid-inspect:ready" });

  window.addEventListener("unload", () => {
    unsubscribe();
    inspector.destroy();
  });
}
