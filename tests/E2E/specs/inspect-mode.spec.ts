import { expect, test } from '@playwright/test';
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
});
