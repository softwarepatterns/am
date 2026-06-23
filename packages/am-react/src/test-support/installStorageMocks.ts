type StorageName = 'localStorage' | 'sessionStorage';

type StorageShape = Pick<
  Storage,
  'clear' | 'getItem' | 'key' | 'removeItem' | 'setItem'
> & {
  length: number;
};

function hasStorageMethod(value: unknown, key: keyof StorageShape): boolean {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  return typeof (value as Record<string, unknown>)[key] === 'function';
}

function isStorageLike(value: unknown): value is Storage {
  if (
    !hasStorageMethod(value, 'clear') ||
    !hasStorageMethod(value, 'getItem') ||
    !hasStorageMethod(value, 'key') ||
    !hasStorageMethod(value, 'removeItem') ||
    !hasStorageMethod(value, 'setItem')
  ) {
    return false;
  }

  return typeof (value as Record<string, unknown>).length === 'number';
}

function createMemoryStorage(): Storage {
  const entries = new Map<string, string>();

  return {
    get length() {
      return entries.size;
    },
    clear() {
      entries.clear();
    },
    getItem(key) {
      return entries.get(String(key)) ?? null;
    },
    key(index) {
      return Array.from(entries.keys())[index] ?? null;
    },
    removeItem(key) {
      entries.delete(String(key));
    },
    setItem(key, value) {
      entries.set(String(key), String(value));
    },
  };
}

function readStorage(name: StorageName): unknown {
  if (name === 'localStorage') {
    return globalThis.localStorage;
  }

  return globalThis.sessionStorage;
}

function defineStorage(name: StorageName, storage: Storage): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value: storage,
  });

  if (typeof window !== 'undefined') {
    Object.defineProperty(window, name, {
      configurable: true,
      value: storage,
    });
  }
}

function installStorage(name: StorageName): void {
  const currentStorage = readStorage(name);

  if (isStorageLike(currentStorage)) {
    return;
  }

  defineStorage(name, createMemoryStorage());
}

export function installStorageMocks(): void {
  installStorage('localStorage');
  installStorage('sessionStorage');
}
