import { createContext, useContext } from 'react';
import type { AnalyticsClient } from '../lib/analytics/ga-types.js';

export const AnalyticsContext = createContext<AnalyticsClient | null>(null);

export function useAnalytics(): AnalyticsClient {
  const analytics = useContext(AnalyticsContext);
  if (!analytics) {
    throw new Error('Analytics context is not available');
  }

  return analytics;
}

export function useAnalyticsSafe(): AnalyticsClient | null {
  return useContext(AnalyticsContext);
}
