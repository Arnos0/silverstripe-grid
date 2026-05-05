import { useCallback, useEffect, useRef } from 'react';
import type { AllowedTypeInfo } from '@/types/elements';
import { t } from '@/i18n';

interface ElementTypePickerProps {
  readonly allowedTypes: Record<string, AllowedTypeInfo>;
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onSelect: (className: string) => void;
}

export default function ElementTypePicker({
  allowedTypes,
  isOpen,
  onClose,
  onSelect,
}: ElementTypePickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (isOpen && !dialog.open) {
      dialog.showModal();
    } else if (!isOpen && dialog.open) {
      dialog.close();
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const handleTileClick = useCallback(
    (className: string) => {
      onSelect(className);
      onClose();
    },
    [onSelect, onClose],
  );

  const entries = Object.entries(allowedTypes);

  return (
    <dialog ref={dialogRef} data-testid="element-type-picker" onClose={handleClose}>
      <div>
        <h3>{t('WeDevelopGrid.ElementTypePicker.TITLE', 'Add content element')}</h3>
        <button
          type="button"
          data-testid="element-type-picker-close"
          onClick={handleClose}
          aria-label={t('WeDevelopGrid.ElementTypePicker.CLOSE_LABEL', 'Close')}
        >
          &times;
        </button>
      </div>
      <div>
        {entries.length > 0 ? (
          <div>
            {entries.map(([className, info]) => (
              <button
                key={className}
                type="button"
                data-testid="element-type-tile"
                onClick={() => handleTileClick(className)}
              >
                <span className={info.icon} data-testid="element-type-icon" />
                <span>{info.label}</span>
                {info.description !== '' && <span>{info.description}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p>
            {t(
              'WeDevelopGrid.ElementTypePicker.EMPTY_MESSAGE',
              'No content element types available',
            )}
          </p>
        )}
      </div>
    </dialog>
  );
}
