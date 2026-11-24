import { z } from "zod";
import { timingSchema } from "./form-timing";
import { MARKETS, type Lang, type MarketId } from "./markets";

export type { Lang, MarketId } from "./markets";

/** Dial codes with their local mobile-number rules (MARKETS.sa.dialCodes). */
export const COUNTRIES = [
  {
    code: "+966",
    iso: "SA",
    label: "السعودية",
    flag: "🇸🇦",
    pattern: /^5\d{8}$/,
    example: "5XXXXXXXX",
  },
] as const;

export type CountryCode = (typeof COUNTRIES)[number]["code"];

/** Convert Arabic-Indic / Persian digits to Latin and strip spaces, dashes, brackets. */
export function normalizeDigits(value: string): string {
  return value
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-().]/g, "");
}

const dropTrunkZero = (n: string) => (n.startsWith("0") ? n.slice(1) : n);

/** Turn a locally typed number (e.g. 0501234567, 966501234567) into its local part. */
export function toLocalNumber(raw: string, countryCode: string): string {
  let n = normalizeDigits(raw);
  const cc = countryCode.replace("+", "");
  const pattern = COUNTRIES.find((c) => c.code === countryCode)?.pattern;
  let international = false;
  if (n.startsWith("+")) [n, international] = [n.slice(1), true];
  else if (n.startsWith("00")) [n, international] = [n.slice(2), true];
  if (n.startsWith(cc)) {
    // Without "+" a leading country code is ambiguous (a local number could start with the
    // same digits), so only strip it when the number isn't valid as typed but is without it.
    const rest = dropTrunkZero(n.slice(cc.length));
    const validAsTyped = pattern?.test(dropTrunkZero(n)) ?? false;
    if (international || (!validAsTyped && (pattern?.test(rest) ?? n.length > cc.length + 6))) {
      n = n.slice(cc.length);
    }
  }
  return dropTrunkZero(n);
}

export function isValidPhone(raw: string, countryCode: string): boolean {
  const country = COUNTRIES.find((c) => c.code === countryCode);
  if (!country) return false;
  return country.pattern.test(toLocalNumber(raw, countryCode));
}

const COMMON_DOMAIN_TYPOS: Record<string, string> = {
  "gmial.com": "gmail.com",
  "gmal.com": "gmail.com",
  "gmail.co": "gmail.com",
  "gamil.com": "gmail.com",
  "gmail.con": "gmail.com",
  "hotmial.com": "hotmail.com",
  "hotmail.co": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "yaho.com": "yahoo.com",
  "yahoo.co": "yahoo.com",
  "outlok.com": "outlook.com",
  "icloud.co": "icloud.com",
};

export function suggestEmailFix(email: string): string | null {
  const [user, domain] = email.trim().toLowerCase().split("@");
  if (!user || !domain) return null;
  const fix = COMMON_DOMAIN_TYPOS[domain];
  return fix ? `${user}@${fix}` : null;
}

const MESSAGES = {
  ar: {
    firstEmpty: "الرجاء إدخال الاسم الأول",
    lastEmpty: "الرجاء إدخال اسم العائلة",
    nameShort: "حرفان على الأقل",
    nameLong: "الاسم طويل جداً",
    nameChars: "الحروف فقط بدون أرقام أو رموز",
    emailEmpty: "الرجاء إدخال البريد الإلكتروني",
    emailLong: "البريد الإلكتروني طويل جداً",
    emailFormat: "صيغة البريد الإلكتروني غير صحيحة",
    emailTypo: "يبدو أن هناك خطأ إملائي في البريد",
    country: "اختر رمز الدولة",
    phoneEmpty: "الرجاء إدخال رقم الجوال",
    phoneInvalid: "رقم الجوال غير صحيح — مثال:",
    consent: "يجب الموافقة على التواصل وشروط المخاطر",
  },
} as const satisfies Record<Lang, Record<string, string>>;

export function phoneErrorMessage(lang: Lang, countryCode: string): string {
  const ex = COUNTRIES.find((c) => c.code === countryCode)?.example ?? "";
  return `${MESSAGES[lang].phoneInvalid} ${ex}`;
}

// A single name part: Arabic or Latin letters (accents included), optional
// inner space/hyphen/apostrophe.
const LETTERS = "[\\p{Script=Arabic}\\p{Script=Latin}\\p{M}]+";
const NAME_PART_RE = new RegExp(`^${LETTERS}(?:[\\s'-]${LETTERS})*$`, "u");
// Strict email: user@domain.tld with a 2+ letter TLD.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

/** Contact form rules; `market` limits the phone dial codes to the ones that market accepts. */
export function makeContactSchema(lang: Lang = "ar", market: MarketId = "sa") {
  const m = MESSAGES[lang];
  const codes = MARKETS[market].dialCodes as unknown as [CountryCode, ...CountryCode[]];
  const namePart = (empty: string) =>
    z
      .string()
      .trim()
      .min(1, { message: empty })
      .min(2, { message: m.nameShort })
      .max(50, { message: m.nameLong })
      .transform((v) => v.replace(/\s+/g, " "))
      .refine((v) => NAME_PART_RE.test(v), { message: m.nameChars });

  return z
    .object({
      firstName: namePart(m.firstEmpty),
      lastName: namePart(m.lastEmpty),
      email: z
        .string()
        .trim()
        .toLowerCase()
        .min(1, { message: m.emailEmpty })
        .max(255, { message: m.emailLong })
        .refine((v) => EMAIL_RE.test(v), { message: m.emailFormat })
        .refine((v) => !suggestEmailFix(v), { message: m.emailTypo }),
      countryCode: z.enum(codes, { errorMap: () => ({ message: m.country }) }),
      phone: z.string().trim().min(1, { message: m.phoneEmpty }).max(20),
      consent: z.literal(true, { errorMap: () => ({ message: m.consent }) }),
    })
    .superRefine((val, ctx) => {
      if (val.phone && !isValidPhone(val.phone, val.countryCode)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phone"],
          message: phoneErrorMessage(lang, val.countryCode),
        });
      }
    });
}

export const contactSchema = makeContactSchema("ar", "sa");

export type ContactInput = z.input<typeof contactSchema>;

/**
 * Each market's quiz: question keys, in order, and their canonical answer values. These exact
 * English strings are what the CRM receives whatever language the visitor sees; the UI maps
 * each value to a translated label. Every question is optional: visitors may skip any of them.
 */
export const QUIZ = {
  sa: {
    is_saudi_citizen: ["Yes, I am a Saudi citizen.", "No"],
    investment_amount: [
      "Less than SAR 5,000",
      "SAR 5,000–9,999",
      "SAR 10,000–49,999",
      "SAR 50,000 or more",
    ],
    investment_start_time: [
      "Within the next 7 days",
      "Within the next 30 days",
      "Within the next 3 months",
      "I am just exploring for now",
    ],
    experience_level: [
      "Beginner — I am ready to learn",
      "I have some experience",
      "I am an experienced trader",
      "I am a professional trader",
    ],
    wants_contact: [
      "Yes, I am ready to discuss the next steps.",
      "Yes, but I need more information first.",
    ],
  },
} as const satisfies Record<MarketId, Record<string, readonly [string, ...string[]]>>;

export type QuizField<M extends MarketId = MarketId> = keyof (typeof QUIZ)[M] & string;
export type QuizValue = string;
export type Answers = Record<string, string>;

export function quizFields(market: MarketId): string[] {
  return Object.keys(QUIZ[market]);
}

export function makeAnswerSchema(market: MarketId) {
  const quiz = QUIZ[market] as Record<string, readonly [string, ...string[]]>;
  const shape = Object.fromEntries(
    Object.entries(quiz).map(([key, values]) => [
      key,
      z.enum(values as [string, ...string[]]).optional(),
    ]),
  );
  // Unknown keys are still rejected; a skipped question is simply absent.
  return z.object(shape).strict();
}

export const answerSchema = makeAnswerSchema("sa");

const marketSchema = z.enum(Object.keys(MARKETS) as [MarketId, ...MarketId[]]);

/** A full lead: contact rules and quiz answers both depend on the market the visitor came from. */
export const leadSubmissionSchema = z
  .object({
    market: marketSchema.default("sa"),
    contact: z.unknown(),
    answers: z.unknown(),
    /** Honeypot: hidden from people, usually filled by bots. Forwarded as-is to the CRM. */
    website: z.string().max(200).optional().default(""),
    /** Landing/field/click times, forwarded only to the leads log. Bad data is dropped, never rejects the lead. */
    timing: timingSchema.optional().catch(undefined),
  })
  .transform((val, ctx) => {
    const contact = makeContactSchema("ar", val.market).safeParse(val.contact);
    const answers = makeAnswerSchema(val.market).safeParse(val.answers);
    for (const [path, res] of [
      ["contact", contact],
      ["answers", answers],
    ] as const) {
      if (!res.success) {
        for (const issue of res.error.issues)
          ctx.addIssue({ ...issue, path: [path, ...issue.path] });
      }
    }
    if (!contact.success || !answers.success) return z.NEVER;
    return {
      market: val.market,
      contact: contact.data,
      answers: answers.data as Answers,
      website: val.website,
      timing: val.timing,
    };
  });

export type LeadSubmission = z.output<typeof leadSubmissionSchema>;

export function toE164(phone: string, countryCode: string): string {
  return `${countryCode}${toLocalNumber(phone, countryCode)}`;
}

export function countryIso(countryCode: string): string {
  return COUNTRIES.find((c) => c.code === countryCode)?.iso ?? "";
}

/** The JSON body the CRM's submit-leads endpoint expects. */
export function toCrmPayload(
  { market, contact, answers, website }: LeadSubmission,
  ipAddress: string,
) {
  return {
    firstname: contact.firstName,
    lastname: contact.lastName,
    email: contact.email,
    mobile: toE164(contact.phone, contact.countryCode),
    country_code: countryIso(contact.countryCode),
    ip_address: ipAddress,
    website,
    // Skipped questions are left out, so `questions` may be shorter than the quiz (or empty).
    questions: quizFields(market)
      .filter((key) => answers[key] !== undefined)
      .map((key) => ({ key, value: answers[key]! })),
  };
}
