import { MINUTE_MS } from "./datetime";
import { defaultFetchFn, type FetchFn } from "./fetch";
import type { StorageConfig } from "./storage";

export type Config = {
  baseUrl: string;
  earlyRefreshMs: number;
  fetchFn: FetchFn;
  profileStorageKey: string;
  storage: StorageConfig;
  tokensStorageKey: string;
};

/**
 * @private
 */
const defaultConfig: Config = {
  fetchFn: defaultFetchFn(),
  baseUrl: "https://api.accountmaker.com",
  earlyRefreshMs: MINUTE_MS,
  storage: null,
  tokensStorageKey: "am_tokens",
  profileStorageKey: "am_profile",
};

export const createConfig = (config?: Partial<Config>): Config => {
  return {
    ...defaultConfig,
    ...config,
  };
};
