import { useViewportContext } from '@/hooks/ViewportContext';
import { useReadonly } from '@/hooks/ReadonlyContext';
import { useResetOverridesAction } from '@/hooks/useResetOverridesAction';
import { getViewports } from '@/utils/gridAdapter';
import { t } from '@/i18n';
import ConfirmDialog from '@/components/ConfirmDialog/ConfirmDialog';
import {
  getViewportIcon,
  getViewportRangeLabel,
} from './viewportPresentation';

export default function ViewportSwitcher() {
  const readonly = useReadonly();
  const viewports = getViewports();
  const { activeViewport, setActiveViewport } = useViewportContext();
  const reset = useResetOverridesAction();

  return (
    <>
      <div
        role="toolbar"
        aria-label={t('WeDevelopGrid.ViewportSwitcher.GROUP_LABEL', 'Viewport size')}
        data-testid="viewport-switcher"
      >
        {viewports.map((viewport) => {
          const isActive = viewport.key === activeViewport;
          const range = getViewportRangeLabel(viewport, viewports);

          return (
            <button
              key={viewport.key}
              type="button"
              data-testid={`viewport-button-${viewport.key}`}
              aria-pressed={isActive}
              aria-disabled={isActive || undefined}
              onClick={() => {
                if (!isActive) {
                  setActiveViewport(viewport.key);
                }
              }}
            >
              <i className={getViewportIcon(viewport.minWidth)} aria-hidden="true" />
              <span data-role="label">{viewport.label}</span>
              {range !== null && <span data-role="range">{range}</span>}
            </button>
          );
        })}
      </div>
      {!readonly && reset.showReset && (
        <button type="button" data-testid="reset-overrides-button" onClick={reset.onResetClick}>
          {reset.label}
        </button>
      )}
      {!readonly && (
        <ConfirmDialog
          isOpen={reset.isDialogOpen}
          title={reset.dialogTitle}
          message={reset.dialogMessage}
          confirmLabel={t('WeDevelopGrid.ViewportSwitcher.RESET_CONFIRM_LABEL', 'Reset')}
          onConfirm={reset.onConfirm}
          onCancel={reset.onCancel}
          destructive
        />
      )}
    </>
  );
}
