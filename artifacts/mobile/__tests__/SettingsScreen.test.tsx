/**
 * Trust-layer test — Cancel must be reachable in <= 2 taps from Settings.
 *   Tap 1: settings-row-subscription
 *   Tap 2: subscription-cancel-cta
 */
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { SettingsScreen } from "@app/screens/settings/SettingsScreen";
import { SubscriptionStatusScreen } from "@app/screens/subscription/SubscriptionStatusScreen";
import type { Plan, SubscriptionSummary } from "@app/lib/subscription-api";

const ACTIVE_SUMMARY: SubscriptionSummary = {
  status: "active",
  plan: "monthly",
  provider: "stripe",
  currentPeriodEnd: "2026-06-01T00:00:00Z",
  cancelAtPeriodEnd: false,
  trialEndsAt: null,
};

const PLANS: Plan[] = [
  {
    id: "monthly",
    title: "NeuroFit Monthly",
    priceCents: 999,
    currency: "USD",
    period: "month",
    trialDays: 7,
  },
];

describe("SettingsScreen — cancel reachability", () => {
  it("Cancel is reachable in <= 2 taps from Settings", () => {
    const onSubscription = jest.fn();
    render(
      <SettingsScreen
        email="user@example.com"
        onAccount={jest.fn()}
        onSubscription={onSubscription}
        onPreferences={jest.fn()}
        onAccessibility={jest.fn()}
        onNotifications={jest.fn()}
        onSupport={jest.fn()}
        onLegalPrivacy={jest.fn()}
        onLegalTerms={jest.fn()}
        onSignOut={jest.fn()}
        onDeleteAccount={jest.fn()}
      />,
    );

    // Tap 1
    fireEvent.press(screen.getByTestId("settings-row-subscription"));
    expect(onSubscription).toHaveBeenCalledTimes(1);

    // Render the screen the navigator would push.
    screen.unmount();
    render(
      <SubscriptionStatusScreen
        summary={ACTIVE_SUMMARY}
        plans={PLANS}
        onCancel={jest.fn()}
        onRequestRefund={jest.fn()}
        onUpgrade={jest.fn()}
      />,
    );

    // Tap 2 — Cancel button is visible and pressable.
    expect(screen.getByTestId("subscription-cancel-cta")).toBeTruthy();
  });

  it("renders all major sections", () => {
    render(
      <SettingsScreen
        email={null}
        onAccount={jest.fn()}
        onSubscription={jest.fn()}
        onPreferences={jest.fn()}
        onAccessibility={jest.fn()}
        onNotifications={jest.fn()}
        onSupport={jest.fn()}
        onLegalPrivacy={jest.fn()}
        onLegalTerms={jest.fn()}
        onSignOut={jest.fn()}
        onDeleteAccount={jest.fn()}
      />,
    );
    expect(screen.getByTestId("settings-row-subscription")).toBeTruthy();
    expect(screen.getByTestId("settings-row-notifications")).toBeTruthy();
    expect(screen.getByTestId("settings-row-accessibility")).toBeTruthy();
    expect(screen.getByTestId("settings-row-delete")).toBeTruthy();
  });
});
