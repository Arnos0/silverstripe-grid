import { useMemo } from 'react';
import { DndContext, DragOverlay, MeasuringStrategy } from '@dnd-kit/core';
import { t } from '@/i18n';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useElementTree } from '@/hooks/useElementTree';
import { useDragAndDrop, DragContext } from '@/hooks/useDragAndDrop';
import { useReorderElement } from '@/hooks/useElementMutations';
import { CollapseContext, useCollapseState } from '@/hooks/useCollapseState';
import { ViewportProvider } from '@/hooks/ViewportContext';
import { GridEditorProvider } from '@/hooks/GridEditorContext';
import { ReadonlyProvider } from '@/hooks/ReadonlyContext';
import { isSectionNode } from '@/types/elements';
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
 * - The legacy entwine bridge (`client/src/bridge/entwine.ts`) on the
 *   `.grid-editor__container` element in the main CMS edit view — always
 *   runs in editable mode.
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
    () => ({ activeType: dragState?.activeType ?? null }),
    [dragState?.activeType],
  );

  const rootClassName = readonly ? 'grid-editor grid-editor--readonly' : 'grid-editor';
  const hasSections = sections.length > 0;

  const sectionList = hasSections ? (
    sections.map((section) => <SectionBlock key={section.nodeKey} section={section} />)
  ) : readonly ? (
    <p className="grid-editor__empty-state">
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

  return (
    <div
      className={rootClassName}
      data-page-id={pageId}
      data-zone={zone}
      data-testid="grid-editor"
      data-state={readonly ? 'readonly' : undefined}
    >
      {isLoading && (
        <p className="grid-editor__loading" data-testid="grid-editor-loading">
          {t('WeDevelopGrid.GridEditor.LOADING', 'Loading elements...')}
        </p>
      )}
      {error !== null && (
        <p className="grid-editor__error" data-testid="grid-editor-error">
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
                <ViewportSwitcher />
                {readonly ? (
                  sectionList
                ) : (
                  <DndContext
                    {...dndContextProps}
                    measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
                  >
                    <DragContext.Provider value={dragContextValue}>
                      <SortableContext items={sectionIds} strategy={verticalListSortingStrategy}>
                        {sectionList}
                        {hasSections && (
                          <AddChildButton
                            parentId={pageId}
                            childType="section"
                            childLabel="Section"
                            variant="append"
                          />
                        )}
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
              </CollapseContext.Provider>
            </ReadonlyProvider>
          </ViewportProvider>
        </GridEditorProvider>
      )}
    </div>
  );
}
