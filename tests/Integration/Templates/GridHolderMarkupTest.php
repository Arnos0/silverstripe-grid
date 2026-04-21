<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Tests\Integration\Templates;

use SilverStripe\Core\Injector\Injector;
use SilverStripe\Dev\SapphireTest;
use SilverStripe\Versioned\Versioned;
use SilverStripe\View\SSViewer;
use WeDevelop\Grid\Model\Column;
use WeDevelop\Grid\Model\Row;
use WeDevelop\Grid\Model\Section;

final class GridHolderMarkupTest extends SapphireTest
{
    protected $usesDatabase = true;

    protected function setUp(): void
    {
        parent::setUp();
        Versioned::set_stage(Versioned::DRAFT);
    }

    public function testSectionHolderEmitsDataGridElementId(): void
    {
        $section = Section::create();
        $section->Title = 'Hero';
        $section->write();

        $html = $section->forTemplate();

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $section->ID),
            (string) $html,
        );
        $this->assertStringContainsString(
            'data-grid-element-title="Hero"',
            (string) $html,
        );
    }

    public function testRowHolderEmitsDataGridElementId(): void
    {
        $section = Section::create();
        $section->Title = 'Hero';
        $section->write();
        // Section::onAfterWrite auto-scaffolds a Row (and a Column).
        /** @var Row $row */
        $row = $section->getChildren()->first();
        $row->Title = 'First row';
        $row->write();

        $html = $row->forTemplate();

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $row->ID),
            (string) $html,
        );
        $this->assertStringContainsString(
            'data-grid-element-title="First row"',
            (string) $html,
        );
    }

    public function testColumnHolderEmitsDataGridElementId(): void
    {
        $section = Section::create();
        $section->write();
        /** @var Row $row */
        $row = $section->getChildren()->first();
        /** @var Column $column */
        $column = $row->getChildren()->first();
        $column->Title = 'Left column';
        $column->write();

        $html = $column->forTemplate();

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $column->ID),
            (string) $html,
        );
        $this->assertStringContainsString(
            'data-grid-element-title="Left column"',
            (string) $html,
        );
    }

    public function testGridElementHolderWrapsContentWithDataAttributes(): void
    {
        // Render a bare GridElement via the shared holder template.
        $template = SSViewer::create(['type' => 'Includes', 'WeDevelop/Grid/Model/GridElement_holder']);
        $section = Section::create();
        $section->Title = 'Wrapped';
        $section->write();

        $html = (string) $template->process($section);

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $section->ID),
            $html,
        );
        $this->assertStringContainsString('style="display:contents"', $html);
    }
}
