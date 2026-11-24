import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeadQuiz } from "@/components/landing/LeadQuiz";
import { QUIZ } from "@/lib/lead-schema";

afterEach(() => vi.useRealTimers());

describe("LeadQuiz questions", () => {
  it("has no skip buttons", () => {
    render(<LeadQuiz />);
    expect(screen.getByText("السؤال 1 من 5")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /تخطي/ })).not.toBeInTheDocument();
  });

  it("reaches the contact form only by answering every question", () => {
    vi.useFakeTimers();
    render(<LeadQuiz />);
    const count = Object.keys(QUIZ.sa).length;
    for (let i = 0; i < count; i++) {
      // The first option of each question.
      const option = screen
        .getAllByRole("button")
        .find((b) => b.className.includes("rounded-2xl"))!;
      fireEvent.click(option);
      act(() => vi.advanceTimersByTime(300));
    }
    expect(screen.getByText("أين نرسل خطتك الشخصية؟")).toBeInTheDocument();
    // Saudi dial code only: shown as a fixed prefix, not a choice.
    expect(screen.getByLabelText("رمز الدولة")).toHaveTextContent("+966");
  });
});
