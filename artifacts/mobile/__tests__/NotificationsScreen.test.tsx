/**
 * FR-8.4 — Marketing notifications must default to OFF.
 */
import React from "react";
import { render, screen } from "@testing-library/react-native";

import { NotificationsScreen } from "@app/screens/settings/NotificationsScreen";
import {
  DEFAULT_SETTINGS,
  useSettingsStore,
} from "@app/lib/settings-store";

describe("NotificationsScreen", () => {
  beforeEach(() => {
    useSettingsStore.setState({ ...DEFAULT_SETTINGS, hydrated: true });
  });

  it("Marketing toggle starts OFF (FR-8.4)", () => {
    render(<NotificationsScreen />);
    const sw = screen.getByTestId("notifications-marketing");
    expect(sw.props.value).toBe(false);
  });

  it("Master toggle starts ON so the user can opt out, not opt in", () => {
    render(<NotificationsScreen />);
    const sw = screen.getByTestId("notifications-master");
    expect(sw.props.value).toBe(true);
  });
});
