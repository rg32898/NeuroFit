/**
 * Route-level tests for `app/onboarding/assessment.tsx`. These cover the
 * wiring the architect review flagged as missing:
 *
 *   - Skipping calls `markOnboarded` and routes to `/(tabs)`.
 *   - Authed submission calls `api.post("/api/profile/assessment", { answers })`
 *     and routes to `/(tabs)`.
 *   - Guest submission queues a pending event instead of POSTing.
 *
 * jest hoists `jest.mock()` factories above all imports, so any vars they
 * reference must be prefixed with `mock` (jest's allowlist) or be defined
 * inside the factory.
 */
import React from "react";

const mockReplace = jest.fn();
const mockApiPost = jest.fn();
const mockMarkOnboarded = jest.fn();
const mockAppendPendingEvent = jest.fn();
const mockUserRef: { current: { id: string; email: string } | null } = {
  current: null,
};
const mockCapturedProps: {
  current: {
    onSkip: () => void | Promise<void>;
    onSubmit: (a: unknown) => void | Promise<void>;
  } | null;
} = { current: null };

jest.mock("expo-router", () => ({
  __esModule: true,
  router: { push: jest.fn(), replace: mockReplace, back: jest.fn() },
}));

jest.mock("@app/lib/api", () => ({
  __esModule: true,
  api: { post: mockApiPost },
  ApiError: class extends Error {
    status = 0;
    code = "";
  },
}));

jest.mock("@app/lib/guest", () => ({
  __esModule: true,
  appendPendingEvent: mockAppendPendingEvent,
}));

jest.mock("@app/lib/auth-store", () => ({
  __esModule: true,
  useAuthStore: (selector: (s: unknown) => unknown) =>
    selector({
      user: mockUserRef.current,
      markOnboarded: mockMarkOnboarded,
    }),
}));

jest.mock("@app/screens/onboarding/AssessmentScreen", () => ({
  __esModule: true,
  AssessmentScreen: (props: {
    onSkip: () => void | Promise<void>;
    onSubmit: (a: unknown) => void | Promise<void>;
  }) => {
    mockCapturedProps.current = props;
    return null;
  },
}));

import { render } from "@testing-library/react-native";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AssessmentRoute = require("../app/onboarding/assessment").default;

describe("app/onboarding/assessment route", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    mockApiPost.mockReset();
    mockMarkOnboarded.mockReset().mockResolvedValue(undefined);
    mockAppendPendingEvent.mockReset().mockResolvedValue({
      id: "x",
      method: "POST",
      path: "",
      body: {},
      createdAt: 0,
    });
    mockCapturedProps.current = null;
    mockUserRef.current = null;
  });

  it("skip → markOnboarded + router.replace('/(tabs)')", async () => {
    render(<AssessmentRoute />);
    expect(mockCapturedProps.current).not.toBeNull();
    await mockCapturedProps.current!.onSkip();

    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockAppendPendingEvent).not.toHaveBeenCalled();
  });

  it("authed submit → api.post(/api/profile/assessment, {answers}) + replace", async () => {
    mockUserRef.current = { id: "u_1", email: "a@b.co" };
    mockApiPost.mockResolvedValue({});

    render(<AssessmentRoute />);
    const answers = [
      { domain: "vocabulary", correct: true },
      { domain: "math", correct: false },
    ];
    await mockCapturedProps.current!.onSubmit(answers);

    expect(mockApiPost).toHaveBeenCalledWith("/api/profile/assessment", {
      answers,
    });
    expect(mockAppendPendingEvent).not.toHaveBeenCalled();
    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });

  it("guest submit → queues pending event instead of POSTing", async () => {
    mockUserRef.current = null;

    render(<AssessmentRoute />);
    const answers = [{ domain: "vocabulary", correct: true }];
    await mockCapturedProps.current!.onSubmit(answers);

    expect(mockApiPost).not.toHaveBeenCalled();
    expect(mockAppendPendingEvent).toHaveBeenCalledWith({
      method: "POST",
      path: "/api/profile/assessment",
      body: { answers },
    });
    expect(mockMarkOnboarded).toHaveBeenCalledTimes(1);
    expect(mockReplace).toHaveBeenCalledWith("/(tabs)");
  });
});
