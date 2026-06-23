import type { SessionProfile, SessionTokens } from "../types";
import type { Config } from "./config";
import { MINUTE_MS } from "./datetime";

export type SessionState = {
  cleared: boolean;
  config: Config;
  refreshPromise: Promise<void> | null;
  profilePromise: Promise<void> | null;
  profile: SessionProfile;
  tokens: SessionTokens;
};

export const isSessionStateExpired = (state: SessionState): boolean => {
  const early = Math.min(
    Math.max(state.config.earlyRefreshMs, 0),
    5 * MINUTE_MS,
  );
  return Date.now() >= state.tokens.expiresAt - early;
};
