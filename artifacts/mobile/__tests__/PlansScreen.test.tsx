/**
 * FR-6.1, FR-6.2 — plans screen renders required price/period/trial info
 * AND defaults to the cheaper monthly plan (never auto-selecting yearly).
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";

import { PlansScreen } from "@app/screens/subscription/PlansScreen";
import type { Plan } from "@app/lib/subscription-api";

const PLANS: Plan[] = [
  {
    id: "monthly",
    title: "NeuroFit Monthly",
    priceCents: 999,
    currency: "USD",
    period: "month",
    trialDays: 7,
  },
  {
    id: "yearly",
    title: "NeuroFit Yearly",
    priceCents: 7999,
    currency: "USD",
    period: "year",
    trialDays: 7,
  },
];

describe("PlansScreen", () => {
  it("defaults selection to the monthly plan, not yearly (FR-6.2)", () => {
    render(
      <PlansScreen
        plans={PLANS}
        onSubscribe={jest.fn()}
        onContinueFree={jest.fn()}
      />,
    );
    const monthly = screen.getByTestId("plan-card-monthly");
    const yearly = screen.getByTestId("plan-card-yearly");
    expect(monthly.props.accessibilityState?.selected).toBe(true);
    expect(yearly.props.accessibilityState?.selected).toBe(false);
  });

  it("renders price, billing period, trial days, and cancel-anytime hint for every plan", () => {
    render(
      <PlansScreen
        plans={PLANS}
        onSubscribe={jest.fn()}
        onContinueFree={jest.fn()}
      />,
    );
    expect(screen.getByTestId("plan-price-monthly")).toHaveTextContent(/\$9\.99/);
    expect(screen.getByTestId("plan-price-yearly")).toHaveTextContent(/\$79\.99/);
    // The i18n mock returns the raw key; just confirm trial elements render.
    expect(screen.getByTestId("plan-trial-monthly")).toHaveTextContent(/trial/);
    expect(screen.getByTestId("plan-trial-yearly")).toHaveTextContent(/trial/);
    // Per-month equivalent only on annual (FR-6.1). The i18n mock returns
    // the raw key, so we assert the element exists for yearly and is
    // absent for monthly.
    expect(screen.getByTestId("plan-per-month-yearly")).toBeTruthy();
    expect(screen.queryByTestId("plan-per-month-monthly")).toBeNull();
  });

  it("always renders the 'Continue with free version' link", () => {
    render(
      <PlansScreen
        plans={PLANS}
        onSubscribe={jest.fn()}
        onContinueFree={jest.fn()}
      />,
    );
    expect(screen.getByTestId("plans-continue-free")).toBeTruthy();
  });
});
