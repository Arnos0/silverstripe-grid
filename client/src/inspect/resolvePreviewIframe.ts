/**
 * Resolves the SilverStripe CMS preview iframe in the admin.
 *
 * The preview iframe is rendered by the `silverstripe/admin` preview panel and
 * always carries `name="cms-preview-iframe"`. This is the single contract
 * between the inspect-mode editor code and the CMS shell — any DOM traversal
 * that tries to be clever here will break across admin layouts.
 */
export function resolvePreviewIframe(): HTMLIFrameElement | null {
  return document.querySelector<HTMLIFrameElement>('iframe[name="cms-preview-iframe"]');
}
