import type { StorageLike } from "../types";

export type StorageConfig = StorageLike | "localStorage" | null | undefined;

function getBrowserLocalStorage(): StorageLike | null {
  try {
    if (typeof window === "undefined") return null;
    if (!window.localStorage) return null;
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function getStorageLike(
  storageConfig: StorageConfig,
): StorageLike | null {
  if (!storageConfig) return null;
  if (storageConfig === "localStorage") return getBrowserLocalStorage();
  return null;
}

export function readStorage<T>(
  storage: StorageLike | null,
  key: string,
): T | null {
  if (!storage) return null;
  return safeParse<T>(storage.getItem(key));
}

export function writeStorage<T>(
  storage: StorageLike | null,
  key: string,
  value: T,
): void {
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function clearStorage(storage: StorageLike | null, key: string): void {
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {}
}
