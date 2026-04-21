import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { installMockLocalStorage } from '@/testing/mockLocalStorage';
import { InspectProvider } from './InspectContext';
import { InspectToggle } from './InspectToggle';

vi.mock('./resolvePreviewIframe', () => ({
  resolvePreviewIframe: vi.fn(() => document.createElement('iframe')),
}));

const realLocalStorage = globalThis.localStorage;

function setup(): ReturnType<typeof render> {
  const tree: ReactNode = (
    <InspectProvider>
      <InspectToggle />
    </InspectProvider>
  );
  return render(tree);
}

describe('InspectToggle', () => {
  beforeEach(() => {
    installMockLocalStorage();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(globalThis, 'localStorage', {
      value: realLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('renders a pressable button with inactive state by default', () => {
    setup();
    const button = screen.getByTestId('inspect-toggle');
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).toHaveTextContent('Inspect');
  });

  it('toggles on click', () => {
    setup();
    const button = screen.getByTestId('inspect-toggle');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'true');
    expect(button).toHaveClass('inspect-toggle--active');
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-pressed', 'false');
    expect(button).not.toHaveClass('inspect-toggle--active');
  });

  it('is disabled when the preview iframe is not resolvable at mount', async () => {
    const mod = await import('./resolvePreviewIframe');
    vi.mocked(mod.resolvePreviewIframe).mockReturnValueOnce(null);
    setup();
    expect(screen.getByTestId('inspect-toggle')).toBeDisabled();
  });

  it('uses the disabled-state title when no iframe is present', async () => {
    const mod = await import('./resolvePreviewIframe');
    vi.mocked(mod.resolvePreviewIframe).mockReturnValueOnce(null);
    setup();
    expect(screen.getByTestId('inspect-toggle')).toHaveAttribute(
      'title',
      'Open split-mode preview to use inspect',
    );
  });

  it('uses the active-state title when the iframe is present', () => {
    setup();
    expect(screen.getByTestId('inspect-toggle')).toHaveAttribute('title', 'Inspect');
  });

  it('polls resolvePreviewIframe and enables itself when the iframe arrives', async () => {
    const mod = await import('./resolvePreviewIframe');
    // First call at mount returns null, subsequent calls (from the interval) return an iframe
    vi.mocked(mod.resolvePreviewIframe).mockReturnValueOnce(null);
    setup();
    expect(screen.getByTestId('inspect-toggle')).toBeDisabled();

    vi.mocked(mod.resolvePreviewIframe).mockReturnValue(document.createElement('iframe'));
    await vi.advanceTimersByTimeAsync(1000);
    expect(screen.getByTestId('inspect-toggle')).not.toBeDisabled();
  });
});
