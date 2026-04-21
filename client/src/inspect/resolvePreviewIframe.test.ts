import { afterEach, describe, expect, it } from 'vitest';
import { resolvePreviewIframe } from './resolvePreviewIframe';

afterEach(() => {
  document.body.innerHTML = '';
});

describe('resolvePreviewIframe', () => {
  it('returns the iframe with name=cms-preview-iframe', () => {
    document.body.innerHTML = `
      <iframe name="other"></iframe>
      <iframe name="cms-preview-iframe" data-testid="preview"></iframe>
    `;
    const result = resolvePreviewIframe();
    expect(result).not.toBeNull();
    expect(result?.getAttribute('data-testid')).toBe('preview');
  });

  it('returns null when no preview iframe present', () => {
    expect(resolvePreviewIframe()).toBeNull();
  });

  it('ignores non-matching iframe names', () => {
    document.body.innerHTML = `<iframe name="other"></iframe>`;
    expect(resolvePreviewIframe()).toBeNull();
  });
});
