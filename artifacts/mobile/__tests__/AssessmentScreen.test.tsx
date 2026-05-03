/**
 * AssessmentScreen — onboarding behaviour.
 *
 * Two tests cover the prompt's contract:
 *   1. "Skip for now" invokes the skip callback (which the route wrapper
 *      uses to mark onboarded + replace to /(tabs)).
 *   2. Answering all 5 questions invokes onSubmit with the collected
 *      answers — the API call itself is asserted via a mocked
 *      onSubmit prop, which is exactly what the route wrapper wires up
 *      to api.post("/api/profile/assessment", { answers }).
 */
import React from "react";
import { fireEvent, render, waitFor } from "@testing-library/react-native";

import { AssessmentScreen } from "@app/screens/onboarding/AssessmentScreen";

describe("AssessmentScreen", () => {
  it("invokes onSkip when the skip button is pressed", () => {
    const onSkip = jest.fn();
    const onSubmit = jest.fn();
    const { getByLabelText } = render(
      <AssessmentScreen onSkip={onSkip} onSubmit={onSubmit} />,
    );

    fireEvent.press(getByLabelText("onboarding.assessment.skip"));

    expect(onSkip).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the collected answers after the last question", async () => {
    const onSubmit = jest.fn().mockResolvedValue(undefined);
    const onSkip = jest.fn();
    const { getByText } = render(
      <AssessmentScreen onSubmit={onSubmit} onSkip={onSkip} />,
    );

    // 5 questions, alternate yes/no so the recorded payload is varied.
    for (let i = 0; i < 5; i++) {
      const label =
        i % 2 === 0
          ? "onboarding.assessment.yes"
          : "onboarding.assessment.no";
      fireEvent.press(getByText(label));
    }

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    const submittedAnswers = onSubmit.mock.calls[0][0];
    expect(submittedAnswers).toHaveLength(5);
    expect(submittedAnswers[0]).toEqual({
      domain: "vocabulary",
      correct: true,
    });
    expect(submittedAnswers[4]).toEqual({ domain: "math", correct: true });
  });
});
