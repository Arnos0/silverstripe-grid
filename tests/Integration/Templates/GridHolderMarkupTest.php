<?php

declare(strict_types=1);

namespace WeDevelop\Grid\Tests\Integration\Templates;

use SilverStripe\Dev\SapphireTest;
use SilverStripe\Versioned\Versioned;
use SilverStripe\View\SSViewer;
use WeDevelop\Grid\Model\Column;
use WeDevelop\Grid\Model\ContentElement;
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

    public function testContentElementForTemplateEmitsDataGridElementId(): void
    {
        // Content elements extend GridElement and render via the shared
        // GridElement_holder.ss template (no ContentElement_holder.ss exists),
        // which wraps the inner $Element output in a <div data-grid-element-id>.
        $content = ContentElement::create();
        $content->Title = 'Hello content';
        $content->HTML = '<p>Body text</p>';
        $content->write();

        $html = (string) $content->forTemplate();

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $content->ID),
            $html,
        );
        $this->assertStringContainsString(
            'data-grid-element-title="Hello content"',
            $html,
        );
    }

    public function testContentElementHolderIsNotDisplayContents(): void
    {
        // Regression: a `display:contents` wrapper has no layout box, so its
        // getBoundingClientRect() is zero and Preview Inspect Mode cannot
        // outline it. The wrapper must remain a real box.
        $content = ContentElement::create();
        $content->Title = 'Inspectable';
        $content->HTML = '<p>Body</p>';
        $content->write();

        $html = (string) $content->forTemplate();

        $this->assertStringNotContainsString('display:contents', $html);
    }

    public function testColumnLoopRendersContentElementWithWrapper(): void
    {
        // Simulates the real rendering flow: a Column template loops over its
        // $Elements and emits $Me for each. Each child must be wrapped by the
        // GridElement_holder for Preview Inspect Mode to see it.
        $section = Section::create();
        $section->write();
        /** @var Row $row */
        $row = $section->getChildren()->first();
        /** @var Column $column */
        $column = $row->getChildren()->first();

        $content = ContentElement::create();
        $content->Title = 'Inline content';
        $content->HTML = '<p>Inner</p>';
        $content->ParentID = $column->ID;
        $content->ParentClass = $column::class;
        $content->write();

        $html = (string) $column->forTemplate();

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $content->ID),
            $html,
        );
    }

    public function testGridElementHolderWrapsContentWithDataAttributes(): void
    {
        // Render a bare GridElement via the shared holder template.
        $template = SSViewer::create(['WeDevelop/Grid/Model/GridElement_holder']);
        $section = Section::create();
        $section->Title = 'Wrapped';
        $section->write();

        $html = (string) $template->process($section);

        $this->assertStringContainsString(
            sprintf('data-grid-element-id="%d"', $section->ID),
            $html,
        );
        $this->assertStringContainsString(
            'data-grid-element-title="Wrapped"',
            $html,
        );
    }
}
