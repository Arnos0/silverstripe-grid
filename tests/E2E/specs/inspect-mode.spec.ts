import { expect, test } from '@playwright/test';
import { startDrag } from '../helpers/drag';
import { loadFixture, resetFixtures } from '../helpers/fixtures';
import { enablePreviewMode } from '../helpers/preview';

test.describe('Inspect mode', () => {
  test.afterAll(async ({ request }) => {
    await resetFixtures(request);
  });

  test('admin locates preview-side elements, verifies editor halos, and reloads to confirm persistence', async ({ page }) => {
    // The CMS disables split mode when `contentWidth + previewWidth < 1340px`.
    // Playwright's default 1280px viewport sits below that threshold; widen
    // the viewport so the preview pane is actually visible for hovering.
    await page.setViewportSize({ width: 1920, height: 1080 });

    const fixture = await loadFixture(page.request, 'inspect-mode');
    await page.goto(`/admin/pages/edit/show/${fixture.pageId}`);
    await expect(page.getByTestId('grid-editor-loading')).toBeHidden({ timeout: 15_000 });
    await enablePreviewMode(page);

    const previewFrame = page.frameLocator('iframe[name="cms-preview-iframe"]');
    const toggle = page.getByTestId('inspect-toggle');
    const halo = page.getByTestId('inspect-halo');

    await test.step('enable inspect mode via the toggle', async () => {
      // Toggle starts disabled; aria-pressed must flip on click.
      await expect(toggle).toBeEnabled();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('hover preview Hero section → editor halo appears and preview breadcrumb shows its title', async () => {
      const heroInPreview = previewFrame
        .locator('[data-grid-element-title="Hero section"]')
        .first();
      await heroInPreview.hover();

      // Editor-side halo renders, preview-side breadcrumb names the target.
      await expect(halo).toBeVisible();
      await expect(previewFrame.locator('.grid-inspect-breadcrumb')).toContainText(
        'Hero section',
      );
      // Preview-side target class lands on the hovered section.
      await expect(heroInPreview).toHaveClass(/grid-inspect-target/);
    });

    await test.step('hover preview Hero paragraph → halo retargets and breadcrumb lists ancestors', async () => {
      const paragraphInPreview = previewFrame
        .locator('[data-grid-element-title="Hero paragraph"]')
        .first();
      await paragraphInPreview.hover();

      // Target class moves to the deeper element — previous hovered ancestor
      // no longer carries `grid-inspect-target` (inspector clears between hovers).
      await expect(paragraphInPreview).toHaveClass(/grid-inspect-target/);
      await expect(halo).toBeVisible();

      // Breadcrumb reflects the Section → Row → Column → Element trail.
      const breadcrumb = previewFrame.locator('.grid-inspect-breadcrumb');
      await expect(breadcrumb).toContainText('Hero section');
      await expect(breadcrumb).toContainText('Hero paragraph');
    });

    await test.step('reload the edit form → inspect mode persists via localStorage', async () => {
      await page.reload({ waitUntil: 'load' });
      await expect(page.getByTestId('grid-editor-loading')).toBeHidden({ timeout: 15_000 });

      // Toggle state rehydrated from localStorage, preview iframe must still
      // be present (enablePreviewMode persists the split-mode preference too).
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
      await expect(previewFrame.locator('body')).toBeAttached({ timeout: 15_000 });
    });

    await test.step('hover again after reload → preview/editor handshake still wires halo', async () => {
      // The InspectBridgeHost sends a deactivate probe on mount when hydrating
      // with enabled=true, which the preview echoes as `ready`. Wait for the
      // iframe content to exist before hovering so the handshake has a chance
      // to complete.
      await expect(previewFrame.locator('[data-grid-element-title]').first()).toBeAttached();

      const ctaInPreview = previewFrame
        .locator('[data-grid-element-title="Call to action"]')
        .first();
      await ctaInPreview.hover();

      await expect(halo).toBeVisible();
      await expect(ctaInPreview).toHaveClass(/grid-inspect-target/);
    });

    await test.step('disable inspect → halo and preview target clear', async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'false');

      // Halo unmounts (overlay returns null when hover is null or disabled),
      // preview clears its target class.
      await expect(halo).toBeHidden();
      await expect(
        previewFrame.locator('.grid-inspect-target'),
      ).toHaveCount(0);
    });
  });

  test('admin verifies spatial placement by hovering editor blocks, restructures via drag, and survives reload', async ({ page }) => {
    // Same viewport override: split mode requires content+preview > 1340px.
    await page.setViewportSize({ width: 1920, height: 1080 });

    const fixture = await loadFixture(page.request, 'inspect-mode');
    await page.goto(`/admin/pages/edit/show/${fixture.pageId}`);
    await expect(page.getByTestId('grid-editor-loading')).toBeHidden({ timeout: 15_000 });
    await enablePreviewMode(page);

    const previewFrame = page.frameLocator('iframe[name="cms-preview-iframe"]');
    const toggle = page.getByTestId('inspect-toggle');

    await test.step('enable inspect mode', async () => {
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    });

    await test.step('hover editor Hero section → preview highlights matching element', async () => {
      // Hover the section's header (not its body) — mouseenter bubbles up
      // to the section block's hover binding without also triggering the
      // deeper row/column/element bindings.
      const heroHeader = page
        .getByTestId('section-block')
        .filter({ hasText: 'Hero section' })
        .getByTestId('section-header');
      await heroHeader.hover();

      // The editor→preview hop is debounced by 200ms; the assertion's 2s
      // default poll window handles that without an explicit wait.
      await expect(
        previewFrame.locator('[data-grid-element-title="Hero section"].grid-inspect-target'),
      ).toHaveCount(1, { timeout: 2_000 });
    });

    await test.step('rapid sibling hover settles on the final target (debounce wins last)', async () => {
      // Use section-headers for the same "don't cascade into descendant
      // bindings" reason as the previous step.
      const heroHeader = page
        .getByTestId('section-block')
        .filter({ hasText: 'Hero section' })
        .getByTestId('section-header');
      const ctaHeader = page
        .getByTestId('section-block')
        .filter({ hasText: 'Call to action' })
        .getByTestId('section-header');

      // Rapid A→B→A→B hover sequence. Debounce collapses the intermediate
      // hovers; only the final hover should settle as the preview target.
      await heroHeader.hover();
      await ctaHeader.hover();
      await heroHeader.hover();
      await ctaHeader.hover();

      await expect(
        previewFrame.locator('[data-grid-element-title="Call to action"].grid-inspect-target'),
      ).toHaveCount(1, { timeout: 2_000 });
      // Hero should NOT retain its target class after the final settle.
      await expect(
        previewFrame.locator('[data-grid-element-title="Hero section"].grid-inspect-target'),
      ).toHaveCount(0);
    });

    await test.step('drag a column → inspect hover is suppressed while dragging', async () => {
      // `useInspectHoverBinding` disables mouseenter/leave when DragContext
      // reports an active drag — so hovering a sibling mid-drag must NOT
      // trigger a new preview target.
      const heroColumnHeader = page
        .getByTestId('column-block')
        .filter({ hasText: 'Hero column' })
        .getByTestId('column-header');
      const textColumnHeader = page
        .getByTestId('column-block')
        .filter({ hasText: 'Text column' })
        .getByTestId('column-header');

      // Seed the preview with the hero section highlighted, so we can assert
      // that mid-drag hovers don't overwrite it.
      // Hover the section's header (not its body) — mouseenter bubbles up
      // to the section block's hover binding without also triggering the
      // deeper row/column/element bindings.
      const heroHeader = page
        .getByTestId('section-block')
        .filter({ hasText: 'Hero section' })
        .getByTestId('section-header');
      await heroHeader.hover();
      await expect(
        previewFrame.locator('[data-grid-element-title="Hero section"].grid-inspect-target'),
      ).toHaveCount(1, { timeout: 2_000 });

      // Start a drag from the hero column's drag handle toward the text column.
      // The drag helper presses, moves past the 8px activation threshold, then
      // hovers over the target — all while holding the mouse down. Scope
      // to the column-header so we pick the column's own drag handle, not
      // one from a child element card.
      const dragHandle = heroColumnHeader.getByTestId('drag-handle');
      const dropTarget = textColumnHeader.getByTestId('drag-handle');
      const handle = await startDrag(page, dragHandle, dropTarget);

      // During the drag, the Text column should NOT have become the preview
      // target — hover binding is suppressed. The preview still shows Hero
      // section from the earlier editor-driven hover.
      await expect(
        previewFrame.locator('[data-grid-element-title="Text column"].grid-inspect-target'),
      ).toHaveCount(0);

      await handle.release();
    });

    await test.step('reload the edit form → inspect still active and hover still drives preview', async () => {
      await page.reload({ waitUntil: 'load' });
      await expect(page.getByTestId('grid-editor-loading')).toBeHidden({ timeout: 15_000 });
      await expect(toggle).toHaveAttribute('aria-pressed', 'true');

      // Wait for iframe content before hovering so the deactivate-probe
      // handshake has fired.
      await expect(previewFrame.locator('[data-grid-element-title]').first()).toBeAttached();

      // Move the cursor to a neutral spot first so the next hover emits a
      // fresh mouseenter. After a drag + reload the cursor may still be
      // hovering above a block, and without a leave→enter transition the
      // mouseenter handler never fires.
      await page.mouse.move(0, 0);

      // Hover the section's header (not its body) — mouseenter bubbles up
      // to the section block's hover binding without also triggering the
      // deeper row/column/element bindings.
      const heroHeader = page
        .getByTestId('section-block')
        .filter({ hasText: 'Hero section' })
        .getByTestId('section-header');
      await heroHeader.hover();

      await expect(
        previewFrame.locator('[data-grid-element-title="Hero section"].grid-inspect-target'),
      ).toHaveCount(1, { timeout: 2_000 });
    });
  });
});
