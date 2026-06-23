import type { SessionProfile, StorageLike } from "../types";
import { readStorage, clearStorage, writeStorage } from "./storage";

export const toSessionProfile = (profile: any): SessionProfile => {
  const credentials = profile.credentials ?? profile.emailCredentials;
  const activeMembership = profile.activeMembership ?? null;

  return {
    ...profile,
    credentials,
    activeMembership,
    lastUpdatedAt: Date.now(),
  };
};

export function isSessionProfile(x: any): x is SessionProfile {
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.applicationId === "string" &&
    typeof x.status === "string" &&
    typeof x.lastUpdatedAt === "number" &&
    (typeof x.identity === "object" || x.identity === null)
  );
}

export function writeProfileIfNewer(
  storage: StorageLike | null,
  key: string,
  next: SessionProfile,
) {
  if (!storage) return;

  const curRaw = readStorage<unknown>(storage, key);
  const cur = isSessionProfile(curRaw) ? curRaw : null;

  if (curRaw !== null && !cur) clearStorage(storage, key);
  if (cur && cur.lastUpdatedAt >= next.lastUpdatedAt) return;

  writeStorage(storage, key, next);
}

export function readSessionProfile(
  storage: StorageLike | null,
  key: string,
): SessionProfile | null {
  const profileRaw = readStorage<unknown>(storage, key);
  return isSessionProfile(profileRaw) ? profileRaw : null;
}
