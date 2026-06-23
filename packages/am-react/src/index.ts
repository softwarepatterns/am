export { AuthProvider, useAuth, useRequiredAuth } from "./components/auth/AuthProvider.js";
export type {
  AuthContextValue,
  AuthIdentityChange,
  AuthProviderProps,
} from "./components/auth/AuthProvider.js";
export { EmailInput } from "./components/auth/EmailInput.js";
export type { EmailInputProps } from "./components/auth/EmailInput.js";
export { PasswordInput } from "./components/auth/PasswordInput.js";
export type { PasswordInputProps } from "./components/auth/PasswordInput.js";
export { SignInBlock } from "./components/auth/SignInBlock.js";
export type { SignInBlockProps } from "./components/auth/SignInBlock.js";
export { SignUpBlock } from "./components/auth/SignUpBlock.js";
export type { SignUpBlockProps } from "./components/auth/SignUpBlock.js";
export {
  canSubmitEmailPassword,
  canSubmitMagicLink,
  toFieldErrors,
} from "./components/auth/common.js";
export type {
  AuthErrorLabels,
  EmailInputLabels,
  PasswordInputLabels,
  SignInBlockLabels,
  SignUpBlockLabels,
} from "./components/auth/labels.js";
export { AnalyticsContext, useAnalytics, useAnalyticsSafe } from "./hooks/useAnalytics.js";
export {
  hasMethod,
  pickInitialMode,
  toEmailState,
  useEmailCheck,
} from "./hooks/useEmailCheck.js";
export type { EmailState, LoginMode } from "./hooks/useEmailCheck.js";
export {
  authIdentityFromProfile,
  authIdentityKey,
  readAuthIdentityKeySafe,
  readAuthIdentitySafe,
  readProfileActiveAccountIdSafe,
  readProfileActiveMembershipAccountNameSafe,
  readProfileActiveMembershipRoleSafe,
  readProfileActiveMembershipSafe,
  readProfileMembershipAccountNameSafe,
  readProfileMembershipByAccountIdSafe,
  readProfileMembershipRoleSafe,
} from "./lib/auth/auth-identity.js";
export type { AuthIdentity } from "./lib/auth/auth-identity.js";
export {
  redirectForUnauthenticated,
  reloadForAuthChange,
} from "./lib/auth/auth-navigation.js";
export {
  clearPendingAuthRedirectPath,
  consumePendingAuthRedirectPathSafe,
  isSafeAuthRedirectPath,
  readPendingAuthRedirectPathSafe,
  toAuthRedirectPathSafe,
  writePendingAuthRedirectPath,
} from "./lib/auth/auth-redirect-target.js";
export type { AuthRedirectPath } from "./lib/auth/auth-redirect-target.js";
export { switchAccounts } from "./lib/auth/switch-accounts.js";
export type { SwitchAccountsSession } from "./lib/auth/switch-accounts.js";
export { isLikelyEmail, normalizeEmail } from "./lib/emails.js";
