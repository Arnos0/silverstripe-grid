import { type CSSProperties, Fragment, useEffect, useState } from 'react';
import type { PathSegment } from './ancestry';
import { useInspect } from './InspectContext';

const HALO_CLASS = 'inspect-halo';
const BREADCRUMB_CLASS = 'inspect-breadcrumb';

interface Resolution {
  target: HTMLElement;
  /** True when the halo lands directly on the hovered element's editor block. */
  isDirect: boolean;
}

/**
 * Locate the [data-node-id] element for an id AND verify it's actually
 * painted. Collapsed containers keep descendants in the DOM (only CSS hides
 * them), so `querySelector` alone would falsely claim they're visible. Use
 * the rendered rect as the source of truth: any element whose parent chain
 * applies `display:none` / `visibility:hidden` / collapses to zero height
 * returns a zero-area rect, which maps to "not visible".
 */
function findVisibleById(id: number): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-node-id="${id}"]`);
  if (el === null) return null;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return el;
}

function resolveHalo(id: number, ancestorIds: readonly number[]): Resolution | null {
  const direct = findVisibleById(id);
  if (direct !== null) return { target: direct, isDirect: true };

  // Walk inside-out: halo the closest VISIBLE ancestor. Because we filter on
  // rect, this survives both "descendant not rendered at all" and "descendant
  // rendered but CSS-hidden by a collapsed container".
  for (let i = ancestorIds.length - 1; i >= 0; i--) {
    const el = findVisibleById(ancestorIds[i]);
    if (el !== null) return { target: el, isDirect: false };
  }

  return null;
}

/**
 * For each path segment, figure out whether it's currently visible in the
 * editor DOM (rendered AND not hidden by an ancestor's collapsed state).
 * Returns an array in the same order as `path` so the breadcrumb can dim
 * segments whose containers collapse them out of view.
 */
function markVisibility(
  path: readonly PathSegment[],
): Array<PathSegment & { isVisible: boolean }> {
  return path.map((segment) => ({
    ...segment,
    isVisible: findVisibleById(segment.id) !== null,
  }));
}

/**
 * Position the breadcrumb relative to the halo target rect. Default: above
 * target with an 8px gap. If that would land above the viewport top, flip
 * below. Always clamp left/right to the viewport so the breadcrumb never
 * hangs off-screen.
 */
function positionBreadcrumb(rect: DOMRect, crumbWidth: number, crumbHeight: number): CSSProperties {
  const GAP = 8;
  const PADDING = 12;

  const wouldOverflowTop = rect.top - crumbHeight - GAP < 0;
  const top = wouldOverflowTop ? rect.bottom + GAP : rect.top - crumbHeight - GAP;

  const rawLeft = rect.left;
  const maxLeft = window.innerWidth - crumbWidth - PADDING;
  const left = Math.max(PADDING, Math.min(rawLeft, maxLeft));

  return {
    position: 'fixed',
    top,
    left,
    zIndex: 10_000,
  };
}

/**
 * Renders the editor-side overlay for a preview-source hover:
 *
 * 1. A haloed outline around the matching editor block (solid if the direct
 *    target is visible; dashed if we had to fall back to a visible ancestor
 *    because the real target lives inside a collapsed container).
 * 2. A floating breadcrumb showing the full `Section › Row › Column › Element`
 *    trail, with collapsed path segments dimmed so the user sees exactly
 *    which ancestors they'd need to expand to reach the element.
 *
 * Editor-source hovers are handled on the preview side — this component only
 * renders when the hover originated from the preview iframe.
 */
export function InspectOverlay(): React.JSX.Element | null {
  const { hover, missing } = useInspect();
  const [resolution, setResolution] = useState<Resolution | null>(null);

  useEffect(() => {
    if (hover === null || hover.source !== 'preview') {
      setResolution(null);
      return;
    }

    const found = resolveHalo(hover.id, hover.ancestorIds);
    setResolution(found);
    if (found !== null) {
      found.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [hover]);

  if (resolution === null || hover === null || hover.source !== 'preview') return null;

  const rect = resolution.target.getBoundingClientRect();

  const haloStyle: CSSProperties = {
    position: 'fixed',
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    pointerEvents: 'none',
    zIndex: 9_999,
  };

  // Halo state:
  //  - `missing`  — preview reported the id doesn't exist; editor-side shows
  //                 greyed/dashed indicator even though we found a proxy.
  //  - `indirect` — the real target is hidden under a collapsed ancestor.
  //  - default    — direct hit on the hovered element.
  const haloModifier = missing
    ? `${HALO_CLASS}--missing`
    : !resolution.isDirect
      ? `${HALO_CLASS}--indirect`
      : '';
  const haloClassName = haloModifier !== '' ? `${HALO_CLASS} ${haloModifier}` : HALO_CLASS;

  const visibilityPath = markVisibility(hover.path);
  // The last segment in the path is the hovered target.
  const lastIndex = visibilityPath.length - 1;

  return (
    <Fragment>
      <div className={haloClassName} data-testid="inspect-halo" style={haloStyle} />
      {visibilityPath.length > 0 && (
        <BreadcrumbCrumb
          segments={visibilityPath}
          lastIndex={lastIndex}
          targetRect={rect}
          missing={missing}
        />
      )}
    </Fragment>
  );
}

interface BreadcrumbProps {
  readonly segments: ReadonlyArray<PathSegment & { isVisible: boolean }>;
  readonly lastIndex: number;
  readonly targetRect: DOMRect;
  readonly missing: boolean;
}

/**
 * Separate component so we can measure its rendered size AFTER first paint
 * and correct the position on the second render. Avoids a flash of
 * mis-positioned content.
 */
function BreadcrumbCrumb({ segments, lastIndex, targetRect, missing }: BreadcrumbProps) {
  const [ref, setRef] = useState<HTMLDivElement | null>(null);
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (ref === null) return;
    const { width, height } = ref.getBoundingClientRect();
    setMeasured({ w: width, h: height });
  }, [ref]);

  const style = measured === null
    ? ({ position: 'fixed', top: targetRect.top - 100, left: targetRect.left, visibility: 'hidden', zIndex: 10_000 } as CSSProperties)
    : positionBreadcrumb(targetRect, measured.w, measured.h);

  const rootClass = missing
    ? `${BREADCRUMB_CLASS} ${BREADCRUMB_CLASS}--missing`
    : BREADCRUMB_CLASS;

  return (
    <div
      ref={setRef}
      className={rootClass}
      data-testid="inspect-breadcrumb"
      style={style}
      role="status"
      aria-live="polite"
    >
      {segments.map((segment, index) => {
        const isTarget = index === lastIndex;
        const classes = [
          `${BREADCRUMB_CLASS}__segment`,
          !segment.isVisible ? `${BREADCRUMB_CLASS}__segment--hidden` : '',
          isTarget ? `${BREADCRUMB_CLASS}__segment--target` : '',
        ]
          .filter((c) => c !== '')
          .join(' ');

        return (
          <Fragment key={`${segment.type}-${segment.id}`}>
            {index > 0 && (
              <span className={`${BREADCRUMB_CLASS}__separator`} aria-hidden="true">
                ›
              </span>
            )}
            <span
              className={classes}
              title={segment.isVisible ? segment.title : `${segment.title} (collapsed)`}
              data-segment-type={segment.type}
              data-segment-hidden={!segment.isVisible ? 'true' : undefined}
              data-segment-target={isTarget ? 'true' : undefined}
            >
              {segment.title || segment.type}
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}
