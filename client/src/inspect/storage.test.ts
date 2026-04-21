import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readEnabled, STORAGE_KEY, writeEnabled } from './storage';

// jsdom's localStorage under vitest is a Proxy that doesn't expose a usable
// `setItem` / `clear`. Mirror the pattern from useCollapseState.test.tsx:
// swap in a plain Map-backed mock for these tests, restore afterwards.

interface MockStorage extends Storage {
  _store: Map<string, string>;
}

function createMockLocalStorage(): MockStorage {
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

const realLocalStorage = globalThis.localStorage;

function installMockLocalStorage(): MockStorage {
  const mock = createMockLocalStorage();
  Object.defineProperty(globalThis, 'localStorage', {
    value: mock,
    writable: true,
    configurable: true,
  });
  return mock;
}

describe('storage', () => {
  beforeEach(() => {
    installMockLocalStorage();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: realLocalStorage,
      writable: true,
      configurable: true,
    });
  });

  it('returns false when key missing', () => {
    expect(readEnabled()).toBe(false);
  });

  it("returns true when 'true' stored", () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    expect(readEnabled()).toBe(true);
  });

  it('returns false when value is not a boolean literal', () => {
    localStorage.setItem(STORAGE_KEY, 'yes');
    expect(readEnabled()).toBe(false);
  });

  it('writeEnabled persists the literal', () => {
    writeEnabled(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
    writeEnabled(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('readEnabled swallows thrown errors and returns false', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: () => {
          throw new Error('blocked');
        },
      },
      writable: true,
      configurable: true,
    });
    expect(readEnabled()).toBe(false);
  });

  it('writeEnabled swallows thrown errors', () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        setItem: () => {
          throw new Error('quota');
        },
      },
      writable: true,
      configurable: true,
    });
    expect(() => writeEnabled(true)).not.toThrow();
  });
});
