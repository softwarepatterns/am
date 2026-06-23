import { Am } from '@softwarepatterns/am';

const memoryStorage = new Map<string, string>();

const storage = {
  getItem(key: string) {
    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, value: string) {
    memoryStorage.set(key, value);
  },
  removeItem(key: string) {
    memoryStorage.delete(key);
  },
};

export const am = new Am({
  baseUrl: 'https://auth.example.com',
  fetchFn: fetch,
  storage,
});
