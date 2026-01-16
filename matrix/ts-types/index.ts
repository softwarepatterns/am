import type {
  Authentication,
  SessionTokens,
  SessionProfile,
  ClientId,
  StorageLike,
  ProblemDetails,
} from "@softwarepatterns/am";
import { Am, AuthError, AuthSession } from "@softwarepatterns/am";

// Test: Types are importable and usable
const clientId: ClientId = "cid_test";

const mockStorage: StorageLike = {
  getItem: (_key: string) => null,
  setItem: (_key: string, _value: string) => {},
  removeItem: (_key: string) => {},
};

// Test: Am can be instantiated with typed config
const am = new Am({
  baseUrl: "https://example.com",
  storage: mockStorage,
});

// Test: Methods have correct signatures
async function _testSignatures() {
  // signIn returns Promise<AuthSession>
  const _session: Promise<AuthSession> = am.signIn({
    clientId,
    email: "test@example.com",
    password: "password",
  });

  // restoreSession returns AuthSession | null
  const _restored: AuthSession | null = am.restoreSession();
}

// Test: AuthError has correct shape
const problem: ProblemDetails = {
  type: "test",
  title: "Test",
  status: 400,
};
const _err = new AuthError(problem);

// Test: Authentication type structure
declare const auth: Authentication;
const _tokens: SessionTokens = auth.tokens;
const _profile: SessionProfile = auth.profile;

// Test: createSession accepts Authentication
am.createSession(auth);
