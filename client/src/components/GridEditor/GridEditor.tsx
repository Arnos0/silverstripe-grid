import { Fragment, useCallback, useMemo } from 'react';
import { DndContext, DragOverlay, MeasuringStrategy } from '@dnd-kit/core';
import { t } from '@/i18n';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useElementTree } from '@/hooks/useElementTree';
import { useDragAndDrop, DragContext } from '@/hooks/useDragAndDrop';
import { useReorderElement } from '@/hooks/useElementMutations';
import { CollapseContext, useCollapse, useCollapseState } from '@/hooks/useCollapseState';
import { ViewportProvider } from '@/hooks/ViewportContext';
import { GridEditorProvider } from '@/hooks/GridEditorContext';
import { ReadonlyProvider } from '@/hooks/ReadonlyContext';
import { isSectionNode } from '@/types/elements';
import type { SectionNode } from '@/types/elements';
import type { NodeRef } from '@/types/identity';
import ViewportSwitcher from '@/components/ViewportSwitcher/ViewportSwitcher';
import SectionBlock from '@/components/SectionBlock/SectionBlock';
import AddChildButton from '@/components/AddChildButton/AddChildButton';
import EmptyState from '@/components/EmptyState/EmptyState';
import DragOverlayContent from '@/components/DragOverlayContent/DragOverlayContent';

interface GridEditorProps {
  readonly pageId: number | null;
  readonly zone: string;
  readonly readonly?: boolean;
  readonly version?: number;
}

/**
 * Root component for the grid editor.
 *
 * Mounted by:
 * - The legacy entwine bridge (`client/src/bridge/entwine.ts`) on elements
 *   matching `[data-react-mount="grid-editor"]` in the main CMS edit view —
 *   always runs in editable mode.
 * - The React `GridEditorField` wrapper (`client/src/components/GridEditorField`)
 *   when `FormBuilder` serializes the history viewer's form schema — always
 *   runs in readonly mode with a specific page version.
 *
 * Block components (`SectionBlock`, `RowBlock`, `ColumnBlock`, `ElementCard`)
 * each dispatch to an editable or readonly variant via `useReadonly()`, so
 * the readonly tree never calls `useSortable` — we simply don't mount a
 * `DndContext` wrapper around it. The ViewportSwitcher renders in both
 * modes so admins can inspect responsive grid settings at every version.
 *
 * `pageId` is optional at the boundary because the entwine bridge can be
 * mounted before `data-schema` is parsed. We early-return an empty-state
 * sentinel here so every hook below this guard sees a guaranteed numeric
 * id — no `?? 0` / `?? 1` placeholders flowing into query keys or tree
 * fabrications.
 */
export default function GridEditor({ pageId, zone, readonly = false, version }: GridEditorProps) {
  if (pageId === null) {
    return (
      <div className="grid-editor" data-zone={zone} data-testid="grid-editor">
        <EmptyState
          message={t('WeDevelopGrid.GridEditor.NO_SECTIONS', 'No sections yet')}
          variant="centered"
        />
      </div>
    );
  }

  return <GridEditorBody pageId={pageId} zone={zone} readonly={readonly} version={version} />;
}

interface GridEditorBodyProps {
  readonly pageId: number;
  readonly zone: string;
  readonly readonly: boolean;
  readonly version: number | undefined;
}

function GridEditorBody({ pageId, zone, readonly, version }: GridEditorBodyProps) {
  const { data, isLoading, error } = useElementTree(pageId, zone, readonly ? version : undefined);

  const reorderMutation = useReorderElement(pageId, zone);

  const { dndContextProps, dragState, pendingTree } = useDragAndDrop({
    tree: data ?? { rootParent: { type: 'page', id: pageId }, nodes: [] },
    onReorder: (element: NodeRef, parent: NodeRef, after: NodeRef | null, clearPendingTree) => {
      if (data === undefined) return;
      reorderMutation.mutate({
        params: { element, parent, after },
        tree: data,
        clearPendingTree,
      });
    },
  });

  // Use pending tree during cross-container drags for visual feedback
  const effectiveData = pendingTree ?? data;

  const sections = effectiveData === undefined ? [] : effectiveData.nodes.filter(isSectionNode);

  const collapseState = useCollapseState(pageId);

  const sectionIds = useMemo(() => sections.map((s) => s.nodeKey), [sections]);

  const dragContextValue = useMemo(
    () => ({ activeType: dragState?.activeType ?? null, pendingActive: pendingTree !== null }),
    [dragState?.activeType, pendingTree],
  );

  const hasSections = sections.length > 0;
  const anyModified = sections.some((section) => section.status === 'modified');

  const sectionList = hasSections ? (
    sections.map((section) => <SectionBlock key={section.nodeKey} section={section} />)
  ) : readonly ? (
    <p className="ssgrid-empty-state" data-testid="grid-editor-empty">
      {t('WeDevelopGrid.GridEditor.NO_SECTIONS_READONLY', 'No sections in this version')}
    </p>
  ) : (
    <AddChildButton
      parentId={pageId}
      childType="section"
      childLabel="Section"
      variant="empty-state"
    />
  );

  // Editable list: the sections, with "+ Add section" in every gap and after
  // the last one (Figma "Frame 1" — the add-button slots double as the inter-
  // section gutter).
  const editableSectionList = hasSections ? (
    <>
      {sections.map((section, index) => (
        <Fragment key={section.nodeKey}>
          {index > 0 && (
            <AddChildButton
              parentId={pageId}
              childType="section"
              childLabel="Section"
              variant="between"
              insertAfterId={sections[index - 1].self.id}
            />
          )}
          <SectionBlock section={section} />
        </Fragment>
      ))}
      <AddChildButton parentId={pageId} childType="section" childLabel="Section" variant="append" />
    </>
  ) : (
    <AddChildButton
      parentId={pageId}
      childType="section"
      childLabel="Section"
      variant="empty-state"
    />
  );

  return (
    <div
      data-page-id={pageId}
      data-zone={zone}
      data-testid="grid-editor"
      data-state={readonly ? 'readonly' : undefined}
    >
      {isLoading && (
        <p className="ssgrid-editor__notice" data-testid="grid-editor-loading">
          {t('WeDevelopGrid.GridEditor.LOADING', 'Loading elements...')}
        </p>
      )}
      {error !== null && (
        <p className="ssgrid-editor__notice" data-tone="error" data-testid="grid-editor-error">
          {t('WeDevelopGrid.GridEditor.LOAD_ERROR', 'Failed to load elements: {message}', {
            message: error.message,
          })}
        </p>
      )}
      {data !== undefined && (
        <GridEditorProvider value={{ pageId, zone }}>
          <ViewportProvider>
            <ReadonlyProvider value={readonly}>
              <CollapseContext.Provider value={collapseState}>
                <div className="ssgrid-editor">
                  <ViewportSwitcher />
                  <GridAreaHeader sections={sections} readonly={readonly} />
                  <div
                    className="ssgrid-editor__canvas"
                    data-testid="grid-editor-canvas"
                    data-status={anyModified ? 'modified' : undefined}
                  >
                    {readonly ? (
                      sectionList
                    ) : (
                      <DndContext
                        {...dndContextProps}
                        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                      >
                        <DragContext.Provider value={dragContextValue}>
                          <SortableContext
                            items={sectionIds}
                            strategy={verticalListSortingStrategy}
                          >
                            {editableSectionList}
                          </SortableContext>
                        </DragContext.Provider>
                        <DragOverlay>
                          {dragState !== null && (
                            <DragOverlayContent
                              node={dragState.activeNode}
                              type={dragState.activeType}
                            />
                          )}
                        </DragOverlay>
                      </DndContext>
                    )}
                  </div>
                </div>
              </CollapseContext.Provider>
            </ReadonlyProvider>
          </ViewportProvider>
        </GridEditorProvider>
      )}
    </div>
  );
}

/**
 * The "Grid area" header strip from the Figma — a title plus a small toolbar of
 * area-level actions. `collapse all` is fully wired; `reset / open / clear` are
 * placeholders for actions the design mocked but the editor doesn't expose yet
 * (they render disabled rather than absent so the strip matches the design and
 * the wiring has an obvious home later).
 */
function GridAreaHeader({
  sections,
  readonly,
}: {
  readonly sections: SectionNode[];
  readonly readonly: boolean;
}) {
  const { isCollapsed, toggle } = useCollapse();

  const collapseAll = useCallback(() => {
    for (const section of sections) {
      if (!isCollapsed(section.nodeKey)) {
        toggle(section.nodeKey);
      }
    }
  }, [sections, isCollapsed, toggle]);

  const canCollapseAll = !readonly && sections.some((section) => !isCollapsed(section.nodeKey));

  return (
    <header className="ssgrid-editor__header">
      <h1 className="ssgrid-editor__title">
        {t('WeDevelopGrid.GridEditor.AREA_TITLE', 'Grid area')}
      </h1>
      <div className="ssgrid-editor__header-actions">
        <button
          type="button"
          className="ssgrid-icon-button"
          disabled
          title={t('WeDevelopGrid.GridEditor.ACTION_RESET', 'Reset changes')}
          aria-label={t('WeDevelopGrid.GridEditor.ACTION_RESET', 'Reset changes')}
        >
          <span className="ssgrid-icon-button__glyph font-icon-back-in-time" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ssgrid-icon-button"
          disabled={!canCollapseAll}
          onClick={collapseAll}
          title={t('WeDevelopGrid.GridEditor.ACTION_COLLAPSE_ALL', 'Collapse all sections')}
          aria-label={t('WeDevelopGrid.GridEditor.ACTION_COLLAPSE_ALL', 'Collapse all sections')}
        >
          <span className="ssgrid-icon-button__glyph font-icon-up-open-big" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ssgrid-icon-button"
          disabled
          title={t('WeDevelopGrid.GridEditor.ACTION_OPEN', 'Open page')}
          aria-label={t('WeDevelopGrid.GridEditor.ACTION_OPEN', 'Open page')}
        >
          <span className="ssgrid-icon-button__glyph font-icon-external-link" aria-hidden="true" />
        </button>
        <button
          type="button"
          className="ssgrid-icon-button"
          disabled
          title={t('WeDevelopGrid.GridEditor.ACTION_CLEAR', 'Remove all sections')}
          aria-label={t('WeDevelopGrid.GridEditor.ACTION_CLEAR', 'Remove all sections')}
        >
          <span className="ssgrid-icon-button__glyph font-icon-trash-bin" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
