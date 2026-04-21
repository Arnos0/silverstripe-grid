/**
 * Map-backed `localStorage` mock for tests.
 *
 * jsdom's default `localStorage` is a Proxy that doesn't expose usable
 * `setItem`/`clear` semantics across property redefinition, so tests that
 * exercise storage hydration, writes, and cross-instance sync need a plain
 * object with deterministic reads and writes.
 */
export interface MockStorage extends Storage {
  readonly _store: Map<string, string>;
}

export function createMockLocalStorage(): MockStorage {
  const store = new Map<string, string>();
  return {
    _store: store,
    get length() {
      return store.size;
    },
    clear: () => {
      store.clear();
    },
    getItem: (key: string): string | null => store.get(key) ?? null,
    setItem: (key: string, value: string): void => {
      store.set(key, value);
    },
    removeItem: (key: string): void => {
      store.delete(key);
    },
    key: (index: number): string | null => [...store.keys()][index] ?? null,
  };
}

/**
 * Swap `globalThis.localStorage` for a fresh `MockStorage`. Callers are
 * responsible for restoring the real value (captured before the swap) in
 * `afterEach` — this helper deliberately does not manage teardown so tests
 * can compose it with other global setup.
 */
export function installMockLocalStorage(): MockStorage {
  const mock = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });
  return mock;
}
