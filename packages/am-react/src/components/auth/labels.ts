export type EmailInputLabels = {
  email: string;
  checkingAvailability: string;
};

export type PasswordInputLabels = {
  password: string;
  hidePassword: string;
  showPassword: string;
};

export type AuthErrorLabels = {
  networkError: string;
  requestFailed: string;
  invalidEmail: string;
  invalidPassword: string;
  badRequest: string;
  unauthorized: string;
  forbidden: string;
  conflict: string;
  tooManyRequests: string;
  serverError: string;
};

export type SignInBlockLabels = {
  title: string;
  magicLinkSent: string;
  useMagicLink: string;
  usePassword: string;
  accountInactive: string;
  passwordNotAvailable: string;
  magicLinkNotAvailable: string;
  signIn: string;
  sendMagicLink: string;
  noAccount: string;
  signUp: string;
  emailInput: EmailInputLabels;
  passwordInput: PasswordInputLabels;
  errors: AuthErrorLabels;
};

export type SignUpBlockLabels = {
  title: string;
  magicLinkSent: string;
  useMagicLink: string;
  usePassword: string;
  signUp: string;
  sendMagicLink: string;
  emailAlreadyRegistered: string;
  haveAccount: string;
  signIn: string;
  emailInput: EmailInputLabels;
  passwordInput: PasswordInputLabels;
  errors: AuthErrorLabels;
};
