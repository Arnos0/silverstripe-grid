<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Tests\Functional\Dev;

use PHPUnit\Framework\Attributes\CoversClass;
use ReflectionClass;
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
        // Clean up any E2E pages created during tests. This filters on the
        // "e2e-" prefix ALONE — deliberately broader than FixtureLoader::reset(),
        // which also constrains ClassName — because testResetDoesNotArchiveNonFixturePageSharingPrefix()
        // creates a bare SiteTree that reset() (correctly) refuses to touch, and
        // tearDown must still remove it. Do not narrow this to match reset().
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

    public function testFixturePageClassesCoversEveryFixturePageType(): void
    {
        // reset() matches ClassName exactly (SilverStripe's ClassName filter is
        // non-polymorphic), so any SiteTree page type used as a top-level key in
        // a fixture MUST be listed in FixtureLoader::FIXTURE_PAGE_CLASSES — or
        // reset() silently leaves those pages behind, polluting a shared dev DB.
        // This guard fails loudly the moment a fixture introduces a new page type
        // that the constant does not cover.
        $declared = (new ReflectionClass(FixtureLoader::class))->getConstant('FIXTURE_PAGE_CLASSES');
        self::assertIsArray($declared, 'FIXTURE_PAGE_CLASSES must be an array constant');

        $fixtureDir = dirname(__DIR__, 2) . '/E2E/Fixture';
        $files = glob($fixtureDir . '/*.yml');
        self::assertNotFalse($files, sprintf('Could not list fixtures in %s', $fixtureDir));
        self::assertNotEmpty($files, sprintf('Expected at least one fixture in %s', $fixtureDir));

        /** @var array<class-string<SiteTree>, string> $pageTypesInFixtures Page class => first fixture file using it */
        $pageTypesInFixtures = [];
        foreach ($files as $file) {
            $contents = file_get_contents($file);
            self::assertIsString($contents, sprintf('Could not read fixture %s', $file));

            // Top-level YAML keys (column 0, ending in a colon) are class names.
            preg_match_all('/^([A-Za-z\\\\][A-Za-z0-9_\\\\]*):[ \t]*$/m', $contents, $matches);

            foreach ($matches[1] as $class) {
                if (is_a($class, SiteTree::class, true)) {
                    $pageTypesInFixtures[$class] ??= basename($file);
                }
            }
        }

        self::assertNotEmpty(
            $pageTypesInFixtures,
            'Expected the E2E fixtures to create at least one SiteTree page type',
        );

        foreach ($pageTypesInFixtures as $class => $file) {
            self::assertContains(
                $class,
                $declared,
                sprintf(
                    'Fixture "%s" creates page type %s, which is missing from '
                    . 'FixtureLoader::FIXTURE_PAGE_CLASSES. reset() matches ClassName exactly, '
                    . 'so it would silently leave these pages behind. Add %s to the constant.',
                    $file,
                    $class,
                    $class,
                ),
            );
        }
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
