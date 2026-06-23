import type { SessionTokens, StorageLike } from "../types";
import { readStorage, clearStorage, writeStorage } from "./storage";

export const toSessionTokens = (tokens: any): SessionTokens => {
  const expiresIn = typeof tokens.expiresIn === "number" ? tokens.expiresIn : 0;
  return {
    ...tokens,
    expiresAt: Date.now() + expiresIn * 1000,
  };
};

export function isSessionTokens(x: any): x is SessionTokens {
  return (
    !!x &&
    typeof x.accessToken === "string" &&
    typeof x.refreshToken === "string" &&
    typeof x.expiresAt === "number" &&
    typeof x.expiresIn === "number" &&
    x.tokenType === "Bearer"
  );
}

export function writeTokensIfNewer(
  storage: StorageLike | null,
  key: string,
  next: SessionTokens,
) {
  if (!storage) return;

  const curRaw = readStorage<unknown>(storage, key);
  const cur = isSessionTokens(curRaw) ? curRaw : null;

  if (curRaw !== null && !cur) clearStorage(storage, key);
  if (cur && cur.expiresAt >= next.expiresAt) return;

  writeStorage(storage, key, next);
}

export function readSessionTokens(
  storage: StorageLike | null,
  key: string,
): SessionTokens | null {
  const tokensRaw = readStorage<unknown>(storage, key);
  return isSessionTokens(tokensRaw) ? tokensRaw : null;
}
