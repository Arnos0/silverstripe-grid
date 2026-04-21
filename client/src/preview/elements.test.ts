import { beforeEach, describe, expect, it } from 'vitest';
import { getAncestors, getElementId, getElementTitle, hitTest } from './elements';

function build(html: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

beforeEach(() => {
  // Reset the DOM between tests — duplicate IDs across tests break
  // id-based querySelector in jsdom when prior roots remain attached.
  document.body.innerHTML = '';
});

describe('hitTest', () => {
  it('returns the innermost element with data-grid-element-id', () => {
    const root = build(`
      <div data-grid-element-id="1">
        <div data-grid-element-id="2">
          <p id="leaf">text</p>
        </div>
      </div>
    `);
    const leaf = root.querySelector<HTMLElement>('#leaf')!;
    expect(hitTest(leaf)?.getAttribute('data-grid-element-id')).toBe('2');
  });

  it('returns null when no grid ancestor exists', () => {
    const root = build(`<p id="leaf">text</p>`);
    const leaf = root.querySelector<HTMLElement>('#leaf')!;
    expect(hitTest(leaf)).toBeNull();
  });

  it('returns the element itself if it has the attribute', () => {
    const root = build(`<p id="leaf" data-grid-element-id="5">text</p>`);
    const leaf = root.querySelector<HTMLElement>('#leaf')!;
    expect(hitTest(leaf)?.getAttribute('data-grid-element-id')).toBe('5');
  });
});

describe('getAncestors', () => {
  it('returns ancestor IDs outside-in excluding self', () => {
    const root = build(`
      <div data-grid-element-id="1">
        <div data-grid-element-id="2">
          <div data-grid-element-id="3"><p id="leaf">text</p></div>
        </div>
      </div>
    `);
    const target = root.querySelector<HTMLElement>('[data-grid-element-id="3"]')!;
    expect(getAncestors(target)).toEqual([1, 2]);
  });

  it('returns empty array when element has no grid ancestors', () => {
    const root = build(`<div data-grid-element-id="1"><p id="leaf">t</p></div>`);
    const target = root.querySelector<HTMLElement>('[data-grid-element-id="1"]')!;
    expect(getAncestors(target)).toEqual([]);
  });
});

describe('getElementId / getElementTitle', () => {
  it('parses numeric id from data-grid-element-id', () => {
    const root = build(`<div data-grid-element-id="42" data-grid-element-title="Hero">x</div>`);
    const el = root.querySelector<HTMLElement>('[data-grid-element-id]')!;
    expect(getElementId(el)).toBe(42);
    expect(getElementTitle(el)).toBe('Hero');
  });

  it('returns null for non-numeric ids', () => {
    const root = build(`<div data-grid-element-id="abc">x</div>`);
    const el = root.querySelector<HTMLElement>('[data-grid-element-id]')!;
    expect(getElementId(el)).toBeNull();
  });

  it('returns null when title is absent', () => {
    const root = build(`<div data-grid-element-id="1">x</div>`);
    const el = root.querySelector<HTMLElement>('[data-grid-element-id]')!;
    expect(getElementTitle(el)).toBeNull();
  });

  it('returns null when title is an empty string', () => {
    const root = build(`<div data-grid-element-id="1" data-grid-element-title="">x</div>`);
    const el = root.querySelector<HTMLElement>('[data-grid-element-id]')!;
    expect(getElementTitle(el)).toBeNull();
  });
});
