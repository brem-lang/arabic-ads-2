import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LeadQuiz } from "@/components/landing/LeadQuiz";

describe("LeadQuiz optional questions", () => {
  it("marks questions optional and skips one at a time", () => {
    render(<LeadQuiz />);
    expect(screen.getByText("السؤال 1 من 5 · اختياري")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^تخطي$/ }));
    expect(screen.getByText("السؤال 2 من 5 · اختياري")).toBeInTheDocument();
  });

  it("jumps straight to the contact form with Skip all", () => {
    render(<LeadQuiz />);
    fireEvent.click(screen.getByRole("button", { name: "تخطي كل الأسئلة" }));
    expect(screen.getByText("أين نرسل خطتك الشخصية؟")).toBeInTheDocument();
    // Saudi dial code only: shown as a fixed prefix, not a choice.
    expect(screen.getByLabelText("رمز الدولة")).toHaveTextContent("+966");
  });
});
