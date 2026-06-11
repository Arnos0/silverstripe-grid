<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Tests\Functional\Dev;

use PHPUnit\Framework\Attributes\CoversClass;
use SilverStripe\CMS\Model\SiteTree;
use SilverStripe\Dev\FunctionalTest;
use SilverStripe\Versioned\Versioned;
use SilverStripe\View\Parsers\URLSegmentFilter;
use WeDevelop\Grid\Dev\FixtureController;
use WeDevelop\Grid\Dev\FixtureLoader;

#[CoversClass(FixtureController::class)]
#[CoversClass(FixtureLoader::class)]
final class FixtureControllerTest extends FunctionalTest
{
    protected $usesDatabase = true;

    private const string BASE_URL = '/dev/grid-fixtures';

    protected function setUp(): void
    {
        parent::setUp();
        Versioned::set_stage(Versioned::DRAFT);
    }

    protected function tearDown(): void
    {
        // Clean up any E2E pages created during tests
        Versioned::withVersionedMode(static function (): void {
            Versioned::set_stage(Versioned::DRAFT);

            $pages = SiteTree::get()->filter(['URLSegment:StartsWith' => 'e2e-']);
            foreach ($pages as $page) {
                $page->doArchive();
            }
        });

        parent::tearDown();
    }

    // ─── Load endpoint ───────────────────────────────────────────

    public function testLoadReturnsSuccessWithValidFixture(): void
    {
        $response = $this->post(self::BASE_URL . '/load', ['fixture' => 'element-tree']);

        self::assertSame(200, $response->getStatusCode());

        $json = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($json['success']);
        self::assertSame('element-tree', $json['fixture']);
        self::assertArrayHasKey('data', $json);
        self::assertArrayHasKey('pageId', $json['data']);
        self::assertArrayHasKey('pageUrl', $json['data']);
        self::assertGreaterThan(0, $json['data']['pageId']);
    }

    public function testLoadReturns400ForMissingFixtureParam(): void
    {
        $response = $this->post(self::BASE_URL . '/load', []);

        self::assertSame(400, $response->getStatusCode());

        $json = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($json['success']);
        self::assertStringContainsString('fixture', $json['error']);
    }

    public function testLoadReturns400ForEmptyFixtureParam(): void
    {
        $response = $this->post(self::BASE_URL . '/load', ['fixture' => '']);

        self::assertSame(400, $response->getStatusCode());

        $json = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($json['success']);
    }

    public function testLoadReturns400ForUnknownFixture(): void
    {
        $response = $this->post(self::BASE_URL . '/load', ['fixture' => 'nonexistent-fixture']);

        self::assertSame(400, $response->getStatusCode());

        $json = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($json['success']);
        self::assertStringContainsString('Unknown fixture', $json['error']);
    }

    public function testLoadResponseHasJsonContentType(): void
    {
        $response = $this->post(self::BASE_URL . '/load', ['fixture' => 'element-tree']);

        self::assertSame('application/json', $response->getHeader('Content-Type'));
    }

    // ─── Reset endpoint ──────────────────────────────────────────

    public function testResetReturnsSuccess(): void
    {
        $response = $this->post(self::BASE_URL . '/reset?confirm=1', []);

        self::assertSame(200, $response->getStatusCode());

        $json = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertTrue($json['success']);
    }

    public function testResetRequiresConfirmQueryParam(): void
    {
        $response = $this->post(self::BASE_URL . '/reset', []);

        self::assertSame(400, $response->getStatusCode());

        $json = json_decode($response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        self::assertFalse($json['success']);
        self::assertStringContainsString('confirm', $json['error']);
    }

    public function testResetDoesNotArchiveNonFixturePageSharingPrefix(): void
    {
        // A plain SiteTree (neither Page nor MultiZonePage) that merely shares
        // the "e2e-" URLSegment prefix represents unrelated content on a shared
        // dev DB. reset() must leave it untouched: the ClassName constraint, not
        // the prefix alone, decides ownership.
        $unrelatedId = Versioned::withVersionedMode(static function (): int {
            Versioned::set_stage(Versioned::DRAFT);

            $page = SiteTree::create();
            $page->Title = 'Unrelated e2e-prefixed page';
            $page->URLSegment = URLSegmentFilter::create()->filter('e2e-unrelated');
            $page->ClassName = SiteTree::class;

            return (int) $page->write();
        });

        self::assertSame(
            SiteTree::class,
            SiteTree::get()->byID($unrelatedId)?->ClassName,
            'Test setup must produce a bare SiteTree, not a Page subclass',
        );

        FixtureLoader::create()->reset();

        self::assertNotNull(
            SiteTree::get()->byID($unrelatedId),
            'reset() must not archive a non-fixture SiteTree that only shares the e2e- prefix',
        );
    }

    public function testResetRemovesLoadedFixtures(): void
    {
        $this->post(self::BASE_URL . '/load', ['fixture' => 'element-tree']);

        // Verify E2E page exists
        $count = SiteTree::get()->filter(['URLSegment:StartsWith' => 'e2e-'])->count();
        self::assertGreaterThan(0, $count);

        $this->post(self::BASE_URL . '/reset?confirm=1', []);

        self::assertSame(
            0,
            SiteTree::get()->filter(['URLSegment:StartsWith' => 'e2e-'])->count(),
        );
    }

    // ─── Method restrictions ─────────────────────────────────────

    public function testGetRequestToLoadIsNotAllowed(): void
    {
        $response = $this->get(self::BASE_URL . '/load');

        // GET is not in url_handlers so DevelopmentAdmin/Controller returns 4xx
        self::assertGreaterThanOrEqual(400, $response->getStatusCode());
    }
}
