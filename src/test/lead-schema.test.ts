import { describe, it, expect } from "vitest";
import { contactSchema, isValidPhone, toE164, suggestEmailFix } from "@/lib/lead-schema";

const valid = {
  firstName: "محمد",
  lastName: "العتيبي",
  email: "mohammed@gmail.com",
  countryCode: "+966",
  phone: "0501234567",
  consent: true,
};

describe("lead form validation", () => {
  it("accepts a correct Saudi lead", () => {
    expect(contactSchema.safeParse(valid).success).toBe(true);
  });

  it("requires both first and last name", () => {
    expect(contactSchema.safeParse({ ...valid, lastName: "" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, firstName: "" }).success).toBe(false);
  });

  it("rejects names with digits", () => {
    expect(contactSchema.safeParse({ ...valid, firstName: "Ali1" }).success).toBe(false);
  });

  it("rejects malformed emails and common typos", () => {
    expect(contactSchema.safeParse({ ...valid, email: "mohammed@gmail" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, email: "mohammed@gmial.com" }).success).toBe(false);
    expect(suggestEmailFix("a@gmial.com")).toBe("a@gmail.com");
  });

  it("accepts Saudi mobiles typed in any common format", () => {
    expect(isValidPhone("0501234567", "+966")).toBe(true);
    expect(isValidPhone("501234567", "+966")).toBe(true);
    expect(isValidPhone("+966 50 123 4567", "+966")).toBe(true);
    expect(isValidPhone("٠٥٠١٢٣٤٥٦٧", "+966")).toBe(true);
    expect(toE164("0501234567", "+966")).toBe("+966501234567");
  });

  it("only accepts the Saudi dial code", async () => {
    const { COUNTRIES } = await import("@/lib/lead-schema");
    expect(COUNTRIES.map((c) => c.iso)).toEqual(["SA"]);
    expect(contactSchema.safeParse({ ...valid, countryCode: "+971" }).success).toBe(false);
    expect(contactSchema.safeParse({ ...valid, countryCode: "+44" }).success).toBe(false);
  });

  it("rejects Saudi numbers that are not mobiles or wrong length", () => {
    expect(isValidPhone("0112345678", "+966")).toBe(false);
    expect(isValidPhone("05012345", "+966")).toBe(false);
  });

  it("requires consent", () => {
    expect(contactSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
  });
});

describe("Arabic messages", () => {
  it("shows Arabic validation messages", () => {
    const res = contactSchema.safeParse({ ...valid, firstName: "" });
    expect(res.success ? [] : res.error.issues.map((i) => i.message)).toContain(
      "الرجاء إدخال الاسم الأول",
    );
  });
});

describe("CRM payload", () => {
  it("matches the submit-leads JSON structure", async () => {
    const { leadSubmissionSchema, toCrmPayload } = await import("@/lib/lead-schema");
    const data = leadSubmissionSchema.parse({
      contact: {
        ...valid,
        firstName: "Mohammed",
        lastName: "Alharbi",
        email: "mohammed@example.com",
        phone: "0512345678",
      },
      answers: {
        is_saudi_citizen: "No",
        investment_amount: "SAR 5,000–9,999",
        investment_start_time: "Within the next 7 days",
        experience_level: "Beginner — I am ready to learn",
        wants_contact: "Yes, but I need more information first.",
      },
    });
    expect(toCrmPayload(data, "203.0.113.7")).toEqual({
      firstname: "Mohammed",
      lastname: "Alharbi",
      email: "mohammed@example.com",
      mobile: "+966512345678",
      country_code: "SA",
      ip_address: "203.0.113.7",
      website: "",
      questions: [
        { key: "is_saudi_citizen", value: "No" },
        { key: "investment_amount", value: "SAR 5,000–9,999" },
        { key: "investment_start_time", value: "Within the next 7 days" },
        { key: "experience_level", value: "Beginner — I am ready to learn" },
        { key: "wants_contact", value: "Yes, but I need more information first." },
      ],
    });
  });

  it("rejects answers that are not one of the canonical options", async () => {
    const { answerSchema } = await import("@/lib/lead-schema");
    expect(answerSchema.safeParse({ is_saudi_citizen: "maybe" }).success).toBe(false);
  });
});

describe("optional questions", () => {
  it("accepts a lead with no answers and sends an empty questions list", async () => {
    const { leadSubmissionSchema, toCrmPayload } = await import("@/lib/lead-schema");
    const data = leadSubmissionSchema.parse({ contact: valid, answers: {} });
    expect(toCrmPayload(data, "84.235.64.1").questions).toEqual([]);
  });

  it("sends only the answered questions, in quiz order", async () => {
    const { leadSubmissionSchema, toCrmPayload } = await import("@/lib/lead-schema");
    const data = leadSubmissionSchema.parse({
      contact: valid,
      answers: { wants_contact: "Yes, but I need more information first.", is_saudi_citizen: "No" },
    });
    expect(toCrmPayload(data, "84.235.64.1").questions).toEqual([
      { key: "is_saudi_citizen", value: "No" },
      { key: "wants_contact", value: "Yes, but I need more information first." },
    ]);
  });

  it("still rejects unknown questions and invalid values", async () => {
    const { answerSchema } = await import("@/lib/lead-schema");
    expect(answerSchema.safeParse({ favourite_colour: "blue" }).success).toBe(false);
    expect(answerSchema.safeParse({ investment_amount: "a lot" }).success).toBe(false);
  });
});

describe("removed markets", () => {
  it("rejects leads for any market other than Saudi Arabia", async () => {
    const { leadSubmissionSchema } = await import("@/lib/lead-schema");
    expect(
      leadSubmissionSchema.safeParse({ market: "gb", contact: valid, answers: {} }).success,
    ).toBe(false);
  });
});
