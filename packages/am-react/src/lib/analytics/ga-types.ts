export type AnalyticsParamValue = string | number | boolean;

export type AnalyticsEventParams = Record<string, AnalyticsParamValue>;

export type PageViewPayload = {
  path: string;
  title?: string;
  location?: string;
};

export type UserContextPayload = {
  userId?: string;
  accountId?: string;
};

export interface AnalyticsClient {
  readonly isEnabled: boolean;
  trackPageView(payload: PageViewPayload): void;
  trackEvent(eventName: string, params?: AnalyticsEventParams): void;
  setUserContext(payload: UserContextPayload): void;
  teardown(): void;
}

export type GaClientConfig = {
  measurementId?: string;
  appName: string;
  appVersion?: string;
  enabled: boolean;
  debugMode?: boolean;
};
