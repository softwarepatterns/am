import type { AnalyticsClient, AnalyticsEventParams } from "./ga-types.js";

export function trackSafeEvent(params: {
  analytics: AnalyticsClient | null | undefined;
  eventName: string;
  eventParams?: AnalyticsEventParams;
}): void {
  const { analytics, eventName, eventParams } = params;
  if (!analytics?.isEnabled) {
    return;
  }

  try {
    analytics.trackEvent(eventName, eventParams);
  } catch (error) {
    console.warn("Analytics event skipped", {
      eventName,
      error,
    });
  }
}
