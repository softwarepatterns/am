import type { SessionProfile, SessionTokens } from "../types";
import type { Config } from "./config";
import { MINUTE_MS } from "./datetime";

export type SessionState = {
  /**
   * A hard navigation reload is required to apply the new session state. This is true when the
   * session state has changed in a way that requires a full page reload to take effect, such as
   * when the user logs out, when the session tokens have expired and cannot be refreshed, when the
   * session profile has changed in a way that requires a full page reload (such as a different account
   * membership being activated).
   */
  reloadRequired: boolean;
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
