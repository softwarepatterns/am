import type { AuthenticationResult } from "@softwarepatterns/am";
import { Am } from "@softwarepatterns/am";

declare const result: AuthenticationResult;

const am = new Am();
am.createAuthSession(result.session);
