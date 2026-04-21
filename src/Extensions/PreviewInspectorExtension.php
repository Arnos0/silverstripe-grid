<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Extensions;

use SilverStripe\CMS\Controllers\ContentController;
use SilverStripe\Core\Extension;
use SilverStripe\Versioned\Versioned;
use SilverStripe\View\Requirements;

/**
 * Loads the preview-inspector JS/CSS on CMS-preview renders only.
 *
 * The preview controller bridges grid editor hover events with their rendered
 * counterpart. It must never ship to public visitors — this extension gates
 * the Requirements call on a preview-context detection.
 *
 * @extends Extension<ContentController>
 */
class PreviewInspectorExtension extends Extension
{
    private const string PREVIEW_JS = 'wedevelopnl/silverstripe-grid:client/dist/js/preview.js';

    private const string PREVIEW_CSS = 'wedevelopnl/silverstripe-grid:client/dist/styles/preview.css';

    public function onAfterInit(): void
    {
        if (!$this->isCmsPreviewContext()) {
            return;
        }

        Requirements::javascript(self::PREVIEW_JS);
        Requirements::css(self::PREVIEW_CSS);
    }

    private function isCmsPreviewContext(): bool
    {
        $request = $this->getOwner()->getRequest();

        // SilverStripe's CMS preview iframe appends CMSPreview=1 to the src.
        // Fallback: any explicit draft-stage request is CMS-originated.
        return $request->getVar('CMSPreview') === '1'
            || $request->getVar('stage') === Versioned::DRAFT;
    }
}
