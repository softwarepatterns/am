import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { AnalyticsContext, useAnalytics, useAnalyticsSafe } from "./useAnalytics.js";
import type { AnalyticsClient } from "../lib/analytics/ga-types.js";

const analytics: AnalyticsClient = {
  isEnabled: true,
  setUserContext: () => {},
  teardown: () => {},
  trackEvent: () => {},
  trackPageView: () => {},
};

function AnalyticsWrapper(props: { children: ReactNode }) {
  return (
    <AnalyticsContext.Provider value={analytics}>
      {props.children}
    </AnalyticsContext.Provider>
  );
}

describe("analytics hooks", () => {
  it("requires analytics context for strict access", () => {
    expect(() => renderHook(() => useAnalytics())).toThrow(
      "Analytics context is not available",
    );
  });

  it("returns analytics from context when available", () => {
    const { result } = renderHook(() => useAnalytics(), {
      wrapper: AnalyticsWrapper,
    });

    expect(result.current).toBe(analytics);
  });

  it("returns null for safe access outside context", () => {
    const { result } = renderHook(() => useAnalyticsSafe());

    expect(result.current).toBeNull();
  });
});
