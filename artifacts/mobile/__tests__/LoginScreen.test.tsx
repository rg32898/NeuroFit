/**
 * LoginScreen — friendly error rendering when auth fails.
 *
 * The screen accepts an `onSubmit` prop and is the place where ApiError
 * codes get mapped to user-facing copy. We assert that:
 *   - INVALID_CREDENTIALS surfaces the friendly translated message
 *     (rather than the raw "Invalid email or password" backend message).
 */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { ApiError } from "@app/lib/api";
import { LoginScreen } from "@app/screens/onboarding/LoginScreen";

describe("LoginScreen", () => {
  it(
    "shows a friendly error when credentials are invalid",
    async () => {
      const onSubmit = jest.fn().mockRejectedValue(
        new ApiError(401, {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password",
        }),
      );
      const onCreateAccount = jest.fn();

      const { getByText } = render(
        <LoginScreen
          onSubmit={onSubmit}
          onCreateAccount={onCreateAccount}
        />,
      );

      fireEvent.press(getByText("onboarding.login.submit"));

      await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1), {
        timeout: 5000,
      });
      // Friendly mapped copy appears; raw backend message must NOT.
      await waitFor(
        () =>
          expect(
            getByText("onboarding.login.errors.invalidCredentials"),
          ).toBeTruthy(),
        { timeout: 5000 },
      );
    },
    15000,
  );
});
