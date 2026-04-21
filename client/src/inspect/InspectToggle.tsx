import { useEffect, useState } from 'react';
import { t } from '@/i18n';
import { useInspect } from './InspectContext';
import { resolvePreviewIframe } from './resolvePreviewIframe';

/**
 * Button in the editor header that flips the inspect-mode enabled flag.
 *
 * The toggle is disabled when no preview iframe is on the page — inspect has
 * no target without a preview, so we surface the unavailability instead of
 * failing silently. The iframe may appear AFTER this component mounts
 * (admin users flip split-mode on/off after opening a page), so we poll on a
 * 1s interval to re-evaluate availability. The coarser `MutationObserver`
 * path on `InspectBridgeHost` already exists, but a local poll keeps the
 * toggle's state independent of that wiring.
 */
const AVAILABILITY_POLL_MS = 1000;

export function InspectToggle(): React.JSX.Element {
  const { enabled, setEnabled } = useInspect();
  const [available, setAvailable] = useState<boolean>(() => resolvePreviewIframe() !== null);

  useEffect(() => {
    const id = window.setInterval(() => {
      setAvailable(resolvePreviewIframe() !== null);
    }, AVAILABILITY_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const label = t('WeDevelopGrid.InspectToggle.LABEL', 'Inspect');
  const disabledTitle = t(
    'WeDevelopGrid.InspectToggle.DISABLED_TITLE',
    'Open split-mode preview to use inspect',
  );

  return (
    <button
      type="button"
      className={`inspect-toggle${enabled ? ' inspect-toggle--active' : ''}`}
      data-testid="inspect-toggle"
      aria-pressed={enabled}
      disabled={!available}
      title={available ? label : disabledTitle}
      onClick={() => setEnabled(!enabled)}
    >
      {label}
    </button>
  );
}
