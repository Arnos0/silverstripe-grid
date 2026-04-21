import { beforeEach, describe, expect, it } from "vitest";
import { buildBreadcrumb, positionBreadcrumb, removeBreadcrumb } from "./breadcrumb";

describe("buildBreadcrumb", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("creates a single breadcrumb element appended to body", () => {
    const labels = ["Section: Hero", "Row", "Column", "Paragraph"];
    const node = buildBreadcrumb(labels);
    expect(node.parentElement).toBe(document.body);
    expect(node.classList.contains("grid-inspect-breadcrumb")).toBe(true);
    expect(node.textContent).toContain("Section: Hero");
    expect(node.textContent).toContain("Paragraph");
  });

  it("reuses the existing breadcrumb on subsequent calls", () => {
    const first = buildBreadcrumb(["a"]);
    const second = buildBreadcrumb(["b"]);
    expect(second).toBe(first);
    expect(second.textContent).toContain("b");
    expect(second.textContent).not.toContain("a");
  });
});

describe("positionBreadcrumb", () => {
  it("positions above target by default", () => {
    const node = buildBreadcrumb(["label"]);
    node.getBoundingClientRect = () => ({
      width: 120,
      height: 24,
      top: 0,
      left: 0,
      right: 120,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    positionBreadcrumb(node, {
      top: 200,
      left: 300,
      bottom: 240,
      right: 420,
      width: 120,
      height: 40,
    });
    expect(node.style.top).toBe("168px"); // 200 - 32
    expect(node.style.left).toBe("300px");
  });

  it("flips below when above would overflow viewport", () => {
    const node = buildBreadcrumb(["label"]);
    node.getBoundingClientRect = () => ({
      width: 120,
      height: 24,
      top: 0,
      left: 0,
      right: 120,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    positionBreadcrumb(node, {
      top: 10,
      left: 0,
      bottom: 50,
      right: 120,
      width: 120,
      height: 40,
    });
    expect(node.style.top).toBe("58px"); // 50 + 8
  });

  it("clamps left to viewport padding", () => {
    const node = buildBreadcrumb(["label"]);
    node.getBoundingClientRect = () => ({
      width: 120,
      height: 24,
      top: 0,
      left: 0,
      right: 120,
      bottom: 24,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });
    positionBreadcrumb(node, {
      top: 200,
      left: -50,
      bottom: 240,
      right: 70,
      width: 120,
      height: 40,
    });
    expect(node.style.left).toBe("8px");
  });
});

describe("removeBreadcrumb", () => {
  it("removes breadcrumb from DOM", () => {
    const node = buildBreadcrumb(["x"]);
    expect(node.parentElement).not.toBeNull();
    removeBreadcrumb();
    expect(document.querySelector(".grid-inspect-breadcrumb")).toBeNull();
  });

  it("is idempotent", () => {
    removeBreadcrumb();
    removeBreadcrumb();
    expect(document.querySelector(".grid-inspect-breadcrumb")).toBeNull();
  });
});
