import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ElementNode } from '@/types/elements';
import type { NodeKey } from '@/types/identity';
import { readEnabled, STORAGE_KEY, writeEnabled } from './storage';

/**
 * Hover state shared between the editor tree and the preview inspector.
 *
 * - `source: 'editor'` means the user is hovering a block in the editor
 *   column; the preview should highlight the matching element.
 * - `source: 'preview'` means the user is hovering an element in the preview
 *   iframe; the editor should highlight the matching block (and ancestors).
 */
export type InspectHover =
  | null
  | { source: 'editor'; nodeKey: NodeKey; id: number; ancestorIds: number[] }
  | { source: 'preview'; id: number; ancestorIds: number[] };

export interface InspectApi {
  enabled: boolean;
  hover: InspectHover;
  missing: boolean;
  setEnabled(next: boolean): void;
  setEditorHover(node: ElementNode | null): void;
  setPreviewHover(id: number, ancestorIds: number[]): void;
  clearHover(): void;
  setMissing(value: boolean): void;
}

const Ctx = createContext<InspectApi | null>(null);

/**
 * Module-scoped pub-sub.
 *
 * Two separate `<InspectProvider>` instances on the same page (e.g. when the
 * editor is mounted alongside another CMS panel) need to stay in sync even
 * though React state is local. Writing to storage also fires broadcast so
 * every provider on the page reflects the change immediately — the native
 * `storage` event only fires on OTHER tabs, never the one that wrote.
 */
const subscribers = new Set<(next: boolean) => void>();
function broadcast(next: boolean): void {
  for (const fn of subscribers) fn(next);
}

export function InspectProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled());
  const [hover, setHover] = useState<InspectHover>(null);
  const [missing, setMissingState] = useState<boolean>(false);

  useEffect(() => {
    const onBroadcast = (next: boolean): void => setEnabledState(next);
    subscribers.add(onBroadcast);

    const onStorage = (event: StorageEvent): void => {
      if (event.key !== STORAGE_KEY) return;
      setEnabledState(readEnabled());
    };
    window.addEventListener('storage', onStorage);

    return () => {
      subscribers.delete(onBroadcast);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setEnabled = useCallback((next: boolean): void => {
    writeEnabled(next);
    setEnabledState(next);
    broadcast(next);
  }, []);

  const setEditorHover = useCallback((node: ElementNode | null): void => {
    if (node === null) {
      setHover(null);
      setMissingState(false);
      return;
    }
    // Ancestors resolved by the tree-aware host wrapper (InspectBridgeHost)
    // — the context itself stays tree-agnostic so it can be shared by code
    // that doesn't have a tree in scope.
    setHover({ source: 'editor', nodeKey: node.nodeKey, id: node.id, ancestorIds: [] });
    setMissingState(false);
  }, []);

  const setPreviewHover = useCallback((id: number, ancestorIds: number[]): void => {
    setHover({ source: 'preview', id, ancestorIds });
    setMissingState(false);
  }, []);

  const clearHover = useCallback((): void => {
    setHover(null);
    setMissingState(false);
  }, []);

  const setMissing = useCallback((value: boolean): void => {
    setMissingState(value);
  }, []);

  const value = useMemo<InspectApi>(
    () => ({
      enabled,
      hover,
      missing,
      setEnabled,
      setEditorHover,
      setPreviewHover,
      clearHover,
      setMissing,
    }),
    [enabled, hover, missing, setEnabled, setEditorHover, setPreviewHover, clearHover, setMissing],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useInspect(): InspectApi {
  const ctx = useContext(Ctx);
  if (ctx === null) {
    throw new Error('useInspect must be used within <InspectProvider>');
  }
  return ctx;
}
