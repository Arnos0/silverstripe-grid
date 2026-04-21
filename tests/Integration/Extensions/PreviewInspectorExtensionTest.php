<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Tests\Integration\Extensions;

use SilverStripe\Control\Controller;
use SilverStripe\Control\HTTPRequest;
use SilverStripe\Core\Manifest\ModuleResourceLoader;
use SilverStripe\Dev\SapphireTest;
use SilverStripe\View\Requirements;
use WeDevelop\Grid\Extensions\PreviewInspectorExtension;

final class PreviewInspectorExtensionTest extends SapphireTest
{
    protected $usesDatabase = false;

    private const PREVIEW_JS = 'wedevelopnl/silverstripe-grid:client/dist/js/preview.js';
    private const PREVIEW_CSS = 'wedevelopnl/silverstripe-grid:client/dist/styles/preview.css';

    protected function setUp(): void
    {
        parent::setUp();
        Requirements::clear();
    }

    protected function tearDown(): void
    {
        Requirements::clear();
        parent::tearDown();
    }

    public function testRequiresPreviewAssetsOnCmsPreviewRequest(): void
    {
        $controller = new Controller();
        $controller->setRequest(new HTTPRequest('GET', '/page', ['CMSPreview' => '1']));

        $extension = new PreviewInspectorExtension();
        $extension->setOwner($controller);
        $extension->onAfterInit();

        $backend = Requirements::backend();
        $this->assertArrayHasKey($this->resolve(self::PREVIEW_JS), $backend->getJavascript());
        $this->assertArrayHasKey($this->resolve(self::PREVIEW_CSS), $backend->getCSS());
    }

    public function testDoesNotRequirePreviewAssetsOnPublicRequest(): void
    {
        $controller = new Controller();
        $controller->setRequest(new HTTPRequest('GET', '/page'));

        $extension = new PreviewInspectorExtension();
        $extension->setOwner($controller);
        $extension->onAfterInit();

        $backend = Requirements::backend();
        $this->assertArrayNotHasKey($this->resolve(self::PREVIEW_JS), $backend->getJavascript());
        $this->assertArrayNotHasKey($this->resolve(self::PREVIEW_CSS), $backend->getCSS());
    }

    /**
     * Requirements::javascript/css resolve module-prefixed paths
     * (vendor/package:resource) via ModuleResourceLoader before storage, so we
     * compare against the resolved key, not the raw resource identifier.
     */
    private function resolve(string $moduleResource): string
    {
        $resolved = ModuleResourceLoader::singleton()->resolvePath($moduleResource);
        return is_string($resolved) ? $resolved : $moduleResource;
    }
}
