import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Loader2,
  Lock,
  Mail,
  Phone,
  ShieldCheck,
  User,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { createFormTimer, isTimedField, type TimedField } from "@/lib/form-timing";
import {
  COUNTRIES,
  makeContactSchema,
  phoneErrorMessage,
  suggestEmailFix,
  isValidPhone,
  QUIZ,
  type Answers,
  type QuizField,
  type QuizValue,
} from "@/lib/lead-schema";
import { MARKETS, type MarketId } from "@/lib/markets";
import { submitLead } from "@/lib/submit-lead";
import { trackPixel } from "@/lib/pixel";

type Question = {
  field: string;
  title: string;
  hint: string;
  options: { value: QuizValue; label: string; icon: string }[];
};

/** One [label, icon] pair per canonical option, so a missing translation is a type error. */
type LabelsFor<T> = { readonly [I in keyof T]: readonly [label: string, icon: string] };

/** Builds a question whose options are the market's canonical CRM values from QUIZ, in order. */
function question<M extends MarketId, K extends QuizField<M>>(
  market: M,
  field: K,
  title: string,
  hint: string,
  labels: LabelsFor<(typeof QUIZ)[M][K]>,
): Question {
  const values = QUIZ[market][field] as readonly string[];
  const options = values.map((value, i) => {
    const [label, icon] = (labels as readonly (readonly [string, string])[])[i]!;
    return { value, label, icon };
  });
  return { field, title, hint, options };
}

const t = {
  questions: [
    question("sa", "is_saudi_citizen", "هل أنت مواطن سعودي؟", "نخصص لك الخدمة حسب بلد إقامتك", [
      ["نعم، أنا مواطن سعودي", "🇸🇦"],
      ["لا", "🌍"],
    ]),
    question("sa", "investment_amount", "كم تخطط أن تستثمر؟", "اختر المبلغ الأقرب لك", [
      ["أقل من 5,000 ريال", "🟢"],
      ["5,000 – 9,999 ريال", "🔵"],
      ["10,000 – 49,999 ريال", "🟡"],
      ["50,000 ريال أو أكثر", "💎"],
    ]),
    question(
      "sa",
      "investment_start_time",
      "متى تخطط أن تبدأ الاستثمار؟",
      "لا يوجد التزام — فقط لنعرف توقيتك",
      [
        ["خلال الأيام السبعة القادمة", "⚡"],
        ["خلال الـ 30 يوماً القادمة", "📅"],
        ["خلال الأشهر الثلاثة القادمة", "🗓️"],
        ["أستكشف الخيارات فقط حالياً", "🧭"],
      ],
    ),
    question(
      "sa",
      "experience_level",
      "ما مستوى خبرتك في التداول؟",
      "لا توجد إجابة خاطئة — نخصص لك الأدوات حسب مستواك",
      [
        ["مبتدئ — مستعد للتعلّم", "🌱"],
        ["لدي بعض الخبرة", "📈"],
        ["متداول ذو خبرة", "⚡"],
        ["متداول محترف", "🏆"],
      ],
    ),
    question(
      "sa",
      "wants_contact",
      "هل تريد أن يتواصل معك مستشار؟",
      "مستشارونا يساعدونك في الخطوات التالية",
      [
        ["نعم، أنا مستعد لمناقشة الخطوات التالية", "✅"],
        ["نعم، لكنني أحتاج معلومات أكثر أولاً", "💬"],
      ],
    ),
  ],
  done: "تم بنجاح",
  lastStep: "الخطوة الأخيرة",
  questionOf: (n: number, t: number) => `السؤال ${n} من ${t}`,
  thanks: (name: string) => `شكراً ${name}، تم استلام طلبك!`,
  willCall: "سيتواصل معك أحد مستشارينا على الرقم",
  willCallEnd: "لمساعدتك في فتح حسابك وتفعيل أدوات الذكاء الاصطناعي.",
  nextSteps: ["ابقِ هاتفك قريباً منك", "جهّز هويتك الوطنية أو الإقامة", "ابدأ بإيداع 250$ فقط"],
  qualified: "أنت مؤهل للبدء",
  formTitle: "أين نرسل خطتك الشخصية؟",
  formSub: "أدخل بياناتك ليتواصل معك مستشار ويفعّل حسابك",
  firstName: "الاسم الأول",
  firstPh: "مثال: محمد",
  lastName: "اسم العائلة",
  lastPh: "مثال: العتيبي",
  email: "البريد الإلكتروني",
  didYouMean: "هل تقصد",
  phone: "رقم الجوال",
  countryCode: "رمز الدولة",
  consent:
    "أوافق على أن يتواصل معي مستشار عبر الهاتف أو البريد، وأدرك أن التداول ينطوي على مخاطر وقد أخسر جزءاً من رأس المال أو كله.",
  sending: "جاري الإرسال...",
  loadingSteps: ["جاري التحقق من بياناتك...", "جاري إنشاء حسابك...", "جاري تجهيز خطتك الشخصية..."],
  redirecting: "تم! جاري تحويلك إلى حسابك...",
  pleaseWait: "يرجى عدم إغلاق الصفحة",
  submit: "احصل على خطتي وابدأ بـ 250$",
  encrypted: "بياناتك مشفّرة",
  noShare: "لا نشارك بياناتك",
  back: "رجوع",
  skip: "تخطي",
  skipAll: "تخطي كل الأسئلة",
  optional: "اختياري",
  failSave: "تعذّر إرسال طلبك، حاول مرة أخرى",
  failCheck: "تحقق من بياناتك وحاول مرة أخرى",
};

type FieldKey = "firstName" | "lastName" | "email" | "phone" | "consent";
type Errors = Partial<Record<FieldKey | "form", string>>;

const MARKET = "sa" satisfies MarketId;
const COUNTRY_CODE = MARKETS.sa.defaultDial;
const country = COUNTRIES.find((c) => c.code === COUNTRY_CODE)!;
const schema = makeContactSchema("ar");

export function LeadQuiz() {
  const QUESTIONS = t.questions;
  const countryCode = COUNTRY_CODE;
  // RTL page: "forward" points left.
  const Forward = ArrowLeft;
  const Back = ArrowRight;

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<Answers>>({});
  const [website, setWebsite] = useState(""); // honeypot
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [touched, setTouched] = useState<Partial<Record<FieldKey, boolean>>>({});
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [sendProgress, setSendProgress] = useState(0);

  // While waiting for the CRM, ease the bar towards 95% so it keeps moving but never "finishes" early.
  useEffect(() => {
    if (!loading) {
      setSendProgress(0);
      return;
    }
    setSendProgress(8);
    const id = setInterval(() => setSendProgress((p) => p + (95 - p) * 0.06), 150);
    return () => clearInterval(id);
  }, [loading]);
  const [done, setDone] = useState(false);

  const total = QUESTIONS.length + 1;
  const isForm = step === QUESTIONS.length;
  const progress = done ? 100 : Math.round((step / total) * 100);
  const q = QUESTIONS[step];

  // Landing/answer/field/click times for the leads log (src/lib/form-timing.ts).
  const timer = useRef<ReturnType<typeof createFormTimer> | null>(null);
  const timed = () => (timer.current ??= createFormTimer());
  useEffect(() => {
    timed().formLoaded();
  }, []);
  useEffect(() => {
    if (isForm) timed().contactFormShown();
  }, [isForm]);

  /** Leave this question unanswered (clearing any earlier answer) and move on. */
  const skip = (field: string) => {
    if (isTimedField(field)) timed().skip(field);
    setAnswers(({ [field]: _skipped, ...rest }) => rest);
    setStep((s) => Math.min(s + 1, QUESTIONS.length));
  };

  const choose = (field: string, value: QuizValue) => {
    if (isTimedField(field)) timed().input(field);
    setAnswers((a) => ({ ...a, [field]: value }));
    setTimeout(() => setStep((s) => Math.min(s + 1, QUESTIONS.length)), 220);
  };

  const validate = (): Errors => {
    const res = schema.safeParse({ firstName, lastName, email, countryCode, phone, consent });
    const e: Errors = {};
    if (!res.success) {
      for (const issue of res.error.issues) {
        const k = issue.path[0] as keyof Errors;
        if (!e[k]) e[k] = issue.message;
      }
    }
    // The schema's cross-field phone check only runs once other fields pass; check it here too.
    if (!e.phone && phone.trim() && !isValidPhone(phone, countryCode)) {
      e.phone = phoneErrorMessage("ar", countryCode);
    }
    return e;
  };

  const liveErrors = validate();
  const fieldError = (k: FieldKey) => (touched[k] ? liveErrors[k] : undefined) ?? errors[k];
  const emailFix = suggestEmailFix(email);
  const phoneOk = phone.length > 0 && isValidPhone(phone, countryCode);

  const onSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    // Every click counts, including ones that fail validation.
    const timing = timed().submitClick();
    setTouched({ firstName: true, lastName: true, email: true, phone: true, consent: true });
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    // Questions are optional: unanswered ones are simply left out of the lead.
    setLoading(true);
    try {
      const res = await submitLead({
        market: MARKET,
        contact: { firstName, lastName, email, countryCode, phone, consent },
        answers: answers as Answers,
        website,
        timing,
      });
      if (res.ok) trackPixel("Lead");
      if (res.ok && res.autologinUrl) {
        // Keep the loading overlay up (at 100%) while the browser navigates away.
        setRedirecting(true);
        const url = res.autologinUrl;
        setTimeout(() => window.location.assign(url), 400);
        return;
      }
      if (res.ok) setDone(true);
      else setErrors({ form: t.failSave });
    } catch {
      setErrors({ form: t.failCheck });
    }
    setLoading(false);
  };

  const nameField = (
    id: "firstName" | "lastName",
    value: string,
    setter: (v: string) => void,
    label: string,
    ph: string,
    auto: string,
  ) => (
    <Field
      id={id}
      label={label}
      icon={<User className="h-4 w-4" />}
      error={fieldError(id)}
      valid={touched[id] && !liveErrors[id]}
    >
      <input
        id={id}
        autoComplete={auto}
        value={value}
        maxLength={50}
        onFocus={() => timed().focus(id)}
        onChange={(e) => {
          timed().input(id);
          setter(e.target.value);
        }}
        onBlur={() => {
          timed().blur(id);
          setTouched((x) => ({ ...x, [id]: true }));
        }}
        placeholder={ph}
        className="h-full w-full min-w-0 bg-transparent outline-none placeholder:text-muted-foreground/60"
      />
    </Field>
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-card p-6 shadow-card backdrop-blur-xl sm:p-10">
      <div className="pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 -bottom-24 h-64 w-64 rounded-full bg-gold/15 blur-3xl" />

      <div className="relative mb-8">
        <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {done
              ? t.done
              : isForm
                ? t.lastStep
                : `${t.questionOf(step + 1, QUESTIONS.length)} · ${t.optional}`}
          </span>
          <span className="font-bold text-primary">{progress}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gradient-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {loading && (
        <SubmitOverlay
          progress={redirecting ? 100 : sendProgress}
          message={
            redirecting
              ? t.redirecting
              : t.loadingSteps[Math.min(Math.floor(sendProgress / 33), t.loadingSteps.length - 1)]!
          }
          hint={t.pleaseWait}
        />
      )}

      <div className="relative min-h-[420px]">
        {done ? (
          <div className="flex flex-col items-center py-10 text-center animate-in fade-in zoom-in-95 duration-500">
            <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 animate-pulse-ring">
              <CheckCircle2 className="h-11 w-11 text-primary" />
            </div>
            <h3 className="text-2xl font-bold sm:text-3xl">{t.thanks(firstName.trim())}</h3>
            <p className="mt-3 max-w-md text-muted-foreground">
              {t.willCall}{" "}
              <span dir="ltr" className="font-semibold text-foreground">
                {countryCode} {phone}
              </span>{" "}
              {t.willCallEnd}
            </p>
            <div className="mt-8 grid w-full max-w-md gap-3 text-start text-sm">
              {t.nextSteps.map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3"
                >
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                  {s}
                </div>
              ))}
            </div>
          </div>
        ) : isForm ? (
          <form onSubmit={onSubmit} noValidate className="animate-in fade-in duration-300">
            <div className="mb-6 text-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Check className="h-3.5 w-3.5" /> {t.qualified}
              </span>
              <h3 className="mt-4 text-2xl font-bold sm:text-3xl">{t.formTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{t.formSub}</p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                {nameField(
                  "firstName",
                  firstName,
                  setFirstName,
                  t.firstName,
                  t.firstPh,
                  "given-name",
                )}
                {nameField("lastName", lastName, setLastName, t.lastName, t.lastPh, "family-name")}
              </div>

              <Field
                id="email"
                label={t.email}
                icon={<Mail className="h-4 w-4" />}
                error={fieldError("email")}
                valid={touched.email && !liveErrors.email}
              >
                <input
                  id="email"
                  type="email"
                  dir="ltr"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  maxLength={255}
                  onFocus={() => timed().focus("email")}
                  onChange={(e) => {
                    timed().input("email");
                    setEmail(e.target.value);
                  }}
                  onBlur={() => {
                    timed().blur("email");
                    setTouched((x) => ({ ...x, email: true }));
                  }}
                  placeholder="name@example.com"
                  className="h-full w-full bg-transparent text-right outline-none placeholder:text-muted-foreground/60"
                />
              </Field>
              {emailFix && (
                <button
                  type="button"
                  onClick={() => {
                    timed().input("email");
                    setEmail(emailFix);
                  }}
                  className="-mt-2 text-xs text-gold underline underline-offset-4"
                >
                  {t.didYouMean} <span dir="ltr">{emailFix}</span>?
                </button>
              )}

              <div>
                <label htmlFor="phone" className="mb-1.5 block text-sm font-medium">
                  {t.phone}
                </label>
                <div className="flex gap-2" dir="ltr">
                  <span
                    aria-label={t.countryCode}
                    className="flex h-12 items-center rounded-xl border border-input bg-muted/50 px-3 text-sm"
                  >
                    {country.flag} {country.code}
                  </span>
                  <div
                    className={cn(
                      "flex h-12 flex-1 items-center gap-2 rounded-xl border bg-muted/50 px-3 transition-colors focus-within:border-primary",
                      touched.phone && liveErrors.phone
                        ? "border-destructive"
                        : phoneOk
                          ? "border-primary/60"
                          : "border-input",
                    )}
                  >
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <input
                      id="phone"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel-national"
                      value={phone}
                      maxLength={20}
                      onFocus={() => timed().focus("phone")}
                      onChange={(e) => {
                        timed().input("phone");
                        setPhone(e.target.value.replace(/[^\d\u0660-\u0669\s+\-]/g, ""));
                      }}
                      onBlur={() => {
                        timed().blur("phone");
                        setTouched((x) => ({ ...x, phone: true }));
                      }}
                      placeholder={country.example}
                      className="h-full w-full bg-transparent outline-none placeholder:text-muted-foreground/60"
                    />
                    {phoneOk && <CheckCircle2 className="h-4 w-4 text-primary" />}
                  </div>
                </div>
                {fieldError("phone") && <ErrorText>{fieldError("phone")}</ErrorText>}
              </div>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => {
                    timed().input("consent");
                    setConsent(e.target.checked);
                    setTouched((x) => ({ ...x, consent: true }));
                  }}
                  className="mt-0.5 h-4 w-4 accent-primary"
                />
                <span>{t.consent}</span>
              </label>
              {fieldError("consent") && <ErrorText>{fieldError("consent")}</ErrorText>}

              {/* Honeypot: invisible to people, bots tend to fill it. */}
              <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
                <label htmlFor="website">Website</label>
                <input
                  id="website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {errors.form && (
                <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
                  {errors.form}
                </div>
              )}

              <Button type="submit" variant="hero" size="xl" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> {t.sending}
                  </>
                ) : (
                  <>
                    {t.submit} <Forward />
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5" /> {t.encrypted}
                </span>
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> {t.noShare}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="mt-6 flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Back className="h-4 w-4" /> {t.back}
            </button>
          </form>
        ) : q ? (
          <div key={step} className="animate-in fade-in duration-300">
            <h3 className="text-center text-2xl font-bold sm:text-3xl">{q.title}</h3>
            <p className="mt-2 text-center text-sm text-muted-foreground">{q.hint}</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {q.options.map((o) => {
                const selected = answers[q.field] === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => choose(q.field, o.value)}
                    className={cn(
                      "group flex items-center gap-4 rounded-2xl border p-4 text-start transition-all hover:-translate-y-0.5 hover:border-primary/70 hover:bg-primary/5",
                      selected
                        ? "border-primary bg-primary/10 shadow-glow"
                        : "border-border bg-muted/30",
                    )}
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background/60 text-2xl">
                      {o.icon}
                    </span>
                    <span className="flex-1 font-semibold">{o.label}</span>
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full border transition-colors",
                        selected
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border",
                      )}
                    >
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
              {step > 0 ? (
                <button
                  type="button"
                  onClick={() => setStep((s) => s - 1)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                >
                  <Back className="h-4 w-4" /> {t.back}
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => {
                    timed().skipAllClick();
                    setStep(QUESTIONS.length);
                  }}
                  className="text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                >
                  {t.skipAll}
                </button>
                <button
                  type="button"
                  onClick={() => skip(q.field)}
                  className="flex items-center gap-1 font-semibold text-primary hover:text-primary/80"
                >
                  {t.skip} <Forward className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  icon,
  error,
  valid,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  error?: string | undefined;
  valid?: boolean | undefined;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium">
        {label}
      </label>
      <div
        className={cn(
          "flex h-12 items-center gap-2 rounded-xl border bg-muted/50 px-3 transition-colors focus-within:border-primary",
          error ? "border-destructive" : valid ? "border-primary/60" : "border-input",
        )}
      >
        <span className="text-muted-foreground">{icon}</span>
        {children}
        {valid && !error && <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />}
      </div>
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}

function SubmitOverlay({
  progress,
  message,
  hint,
}: {
  progress: number;
  message: string;
  hint: string;
}) {
  const pct = Math.round(progress);
  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-background/85 p-8 text-center backdrop-blur-md animate-in fade-in duration-300"
    >
      <div className="relative mb-6 flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        <div className="absolute inset-0 animate-spin rounded-full border-4 border-transparent border-t-primary border-r-primary/60" />
        <span className="text-sm font-bold text-primary tabular-nums">{pct}%</span>
      </div>
      <p key={message} className="text-lg font-semibold animate-in fade-in duration-300">
        {message}
      </p>
      <div
        className="mt-5 h-2 w-full max-w-xs overflow-hidden rounded-full bg-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div
          className="h-full rounded-full bg-gradient-primary transition-all duration-300 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 flex items-center gap-1 text-xs text-destructive" role="alert">
      <AlertCircle className="h-3.5 w-3.5" /> {children}
    </p>
  );
}
