import { afterEach, describe, expect, it } from "vitest";
import { activate, clear, createInspector, deactivate, highlight } from "./inspector";

interface Posted {
  type: string;
  [key: string]: unknown;
}

function build(html: string): HTMLElement {
  document.body.innerHTML = html;
  return document.body;
}

function collectPosts(): { posts: Posted[]; restore: () => void } {
  const posts: Posted[] = [];
  const original = window.parent;
  Object.defineProperty(window, "parent", {
    configurable: true,
    value: { postMessage: (m: Posted) => posts.push(m) },
  });
  return {
    posts,
    restore: () => {
      Object.defineProperty(window, "parent", { configurable: true, value: original });
    },
  };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("createInspector", () => {
  it("does not bind mousemove until activate()", () => {
    build(`<div data-grid-element-id="1">x</div>`);
    const inspector = createInspector();
    const capture = collectPosts();
    document.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    expect(capture.posts).toHaveLength(0);
    capture.restore();
    inspector.destroy();
  });

  it("activate() wires hover detection and posts hover on grid-element entry", () => {
    build(`<div id="t" data-grid-element-id="7" data-grid-element-title="Hero">inner</div>`);
    const inspector = createInspector();
    const capture = collectPosts();
    activate(inspector);

    const target = document.getElementById("t")!;
    target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    inspector.flush(); // test-only helper to drain rAF throttle

    expect(capture.posts).toContainEqual({ type: "grid-inspect:hover", id: 7 });
    capture.restore();
    inspector.destroy();
  });

  it("highlight() adds target class and clear() removes it", () => {
    build(`<div id="t" data-grid-element-id="42">x</div>`);
    const el = document.getElementById("t")!;
    // jsdom returns an all-zero rect, which our missing-guard treats as detached.
    // Stub a non-zero rect so highlight() takes the happy path. jsdom also
    // doesn't implement scrollIntoView — stub it to a no-op.
    el.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    el.scrollIntoView = () => undefined;
    const inspector = createInspector();
    highlight(inspector, 42);
    expect(el.classList.contains("grid-inspect-target")).toBe(true);
    clear(inspector);
    expect(el.classList.contains("grid-inspect-target")).toBe(false);
    inspector.destroy();
  });

  it("highlight() posts missing when id is not in the DOM", () => {
    build(`<div>no grid elements</div>`);
    const inspector = createInspector();
    const capture = collectPosts();
    highlight(inspector, 99);
    expect(capture.posts).toContainEqual({ type: "grid-inspect:missing", id: 99 });
    capture.restore();
    inspector.destroy();
  });

  it("mouseleave on document element posts unhover and clears highlight", () => {
    build(`<div id="t" data-grid-element-id="9">x</div>`);
    const inspector = createInspector();
    const target = document.getElementById("t")!;
    target.getBoundingClientRect = () =>
      ({ top: 0, left: 0, right: 10, bottom: 10, width: 10, height: 10, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;

    activate(inspector);
    const capture = collectPosts();

    // Simulate a real user hover so currentHover is set before leaving.
    target.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    inspector.flush();
    expect(capture.posts).toContainEqual({ type: "grid-inspect:hover", id: 9 });
    expect(target.classList.contains("grid-inspect-target")).toBe(true);

    document.documentElement.dispatchEvent(new MouseEvent("mouseleave", { bubbles: false }));

    expect(target.classList.contains("grid-inspect-target")).toBe(false);
    expect(capture.posts).toContainEqual({ type: "grid-inspect:unhover" });
    capture.restore();
    inspector.destroy();
  });

  it("deactivate() removes listeners and clears highlight state", () => {
    build(`<div id="t" data-grid-element-id="1">x</div>`);
    const inspector = createInspector();
    activate(inspector);
    highlight(inspector, 1);
    deactivate(inspector);
    expect(document.getElementById("t")!.classList.contains("grid-inspect-target")).toBe(false);

    const capture = collectPosts();
    document.getElementById("t")!.dispatchEvent(new MouseEvent("mousemove", { bubbles: true }));
    inspector.flush();
    expect(capture.posts).toHaveLength(0);
    capture.restore();
    inspector.destroy();
  });
});
