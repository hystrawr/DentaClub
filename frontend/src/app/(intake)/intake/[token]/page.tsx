"use client";

import { CheckCircle2 } from "lucide-react";
import { notFound } from "next/navigation";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { IntakeForm } from "@/components/intake/IntakeForm";
import { ApiError, ValidationError } from "@/lib/api/client";
import { isAlreadyCompleted, useIntakePacket, useSubmitIntake } from "@/lib/api/intake";
import { decodeIntakeToken } from "@/lib/utils/intake-token";
import { buildSteps, prefillFrom, sectionsFromPacket, stepFields, stepOfField, visibleSections } from "@/lib/utils/intake-steps";

/**
 * The patient's consent & intake form — `/intake/{token}`.
 *
 * Ported from DentalOS `app/(intake)/[token]/page.tsx`. Sections are grouped into
 * steps by what they *are* (`lib/utils/intake-steps.ts`), answers are pre-filled
 * from what the clinic holds, and the whole packet posts in one call at the end.
 * When the server refuses it, the 422 names fields as `responses.<key>`, which is
 * enough to put the patient back on the step holding the field they missed.
 *
 * Differences from DentalOS: no patient login (the link is the credential), and
 * the route lives under `/intake/` rather than at the site root — DentalOS's
 * root-level `[token]` route matched every one-segment path in the app.
 */
export default function IntakeFormPage({ params }: PageProps<"/intake/[token]">) {
  const { token: rawToken } = use(params);

  // The segment arrives percent-encoded, and the API cannot decrypt a token with
  // `%3D` where its padding should be. Anything not shaped like a token is a
  // wrong address rather than a dead link.
  const token = decodeIntakeToken(rawToken);
  if (!token) notFound();

  return <IntakeWizard token={token} />;
}

function IntakeWizard({ token }: { token: string }) {
  const { data: packet, isLoading, error } = useIntakePacket(token);
  const submit = useSubmitIntake(token);

  const [step, setStep] = useState(0);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [prefilled, setPrefilled] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);

  /* ── Shape ─────────────────────────────────────────────────── */

  // The server sends the sections it validates against (with `show_if` already
  // evaluated); fall back to deriving them from the packet as DentalOS does.
  const sections = useMemo(
    () => visibleSections(packet?.sections ?? sectionsFromPacket(packet), packet?.payor_type),
    [packet],
  );
  const steps = useMemo(() => buildSteps(sections), [sections]);
  const fieldStep = useMemo(() => stepOfField(steps), [steps]);

  // Seed once, when the packet lands — never again, or a re-seed would overwrite
  // an answer the patient had already corrected. (Adjusted during render rather
  // than in an effect, so the first painted form is already filled in.)
  if (packet && !prefilled) {
    setPrefilled(true);
    setValues((current) => ({ ...prefillFrom(sections, packet.patient_data), ...current }));
  }

  // Announce the new step. Skipped on first paint, where stealing focus would
  // only move a keyboard user past the clinic's name for no reason.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [step]);

  /* ── Server-side field errors ──────────────────────────────── */

  /** `responses.allergies` → `allergies`. */
  const serverErrors = useMemo(() => {
    if (!(submit.error instanceof ValidationError)) return undefined;
    const mapped: Record<string, string> = {};
    for (const [key, messages] of Object.entries(submit.error.errors)) {
      const field = key.startsWith("responses.") ? key.slice("responses.".length) : key;
      if (messages[0]) mapped[field] = messages[0];
    }
    return mapped;
  }, [submit.error]);

  /* ── States ────────────────────────────────────────────────── */

  if (isLoading) return <Loading />;

  // 401 is the answer for a used link as well as a bad one, so they are told
  // apart by the message: "you have already done this" vs "this is not valid".
  if (isAlreadyCompleted(error) || submitted) return <Done />;

  if (error || !packet) return <LinkNotFound message={error instanceof ApiError ? error.message : undefined} />;

  if (steps.length === 0) {
    return (
      <Card>
        <h1 className="text-base font-bold mb-1" style={{ color: "var(--color-foreground)" }}>
          Nothing to fill in yet
        </h1>
        <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
          There are no forms on this link. Please check with the front desk.
        </p>
      </Card>
    );
  }

  const current = steps[Math.min(step, steps.length - 1)]!;
  const isLast = step >= steps.length - 1;
  const fields = stepFields(current);

  /* ── Advance ───────────────────────────────────────────────── */

  async function handleStepSubmit() {
    if (!isLast) {
      setStep((s) => s + 1);
      return;
    }

    // The signature never travels inside `responses`: it is a data URI bound for
    // `POST /:token/sign`, where it becomes the immutable signed document.
    const { signature, ...responses } = values;

    try {
      await submit.mutateAsync({ responses, signature: typeof signature === "string" ? signature : undefined });
      setSubmitted(true);
    } catch (err) {
      // A refusal is only useful next to the field it is about, so walk back to
      // the earliest step that owns one of the named fields. Answers are kept.
      if (err instanceof ValidationError) {
        const targets = Object.keys(err.errors)
          .map((key) => fieldStep.get(key.startsWith("responses.") ? key.slice("responses.".length) : key))
          .filter((index): index is number => index !== undefined);
        if (targets.length > 0) setStep(Math.min(...targets));
      }
    }
  }

  const signatureRequired = fields.some((f) => f.type === "signature");
  const signatureMissing = signatureRequired && typeof values.signature !== "string";

  return (
    <div className="space-y-5">
      <div className="text-center pt-1">
        <p className="text-xs font-medium uppercase tracking-wider" style={{ color: "var(--color-subtle-foreground)" }}>
          {packet.packet.name}
        </p>
        {packet.patient_name && (
          <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
            For {packet.patient_name}
          </p>
        )}
      </div>

      <Progress count={steps.length} step={step} />

      <div className="card-premium p-5">
        <h1 ref={headingRef} tabIndex={-1} className="text-lg font-bold mb-1 outline-none" style={{ color: "var(--color-foreground)" }}>
          {current.title}
        </h1>
        <p className="text-xs mb-5" style={{ color: "var(--color-muted-foreground)" }}>
          Step {step + 1} of {steps.length}
        </p>

        {/* Two consent documents grouped onto one step are two documents — the
            patient must see that they are signing something separate. */}
        {current.sections.length > 1 && (
          <div className="space-y-1 mb-4">
            {current.sections.map((section) => (
              <p key={section.key} className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
                · {section.title}
              </p>
            ))}
          </div>
        )}

        <IntakeForm
          key={step}
          fields={fields}
          values={values}
          onChange={(key, value) => setValues((prev) => ({ ...prev, [key]: value }))}
          onSubmit={handleStepSubmit}
          serverErrors={serverErrors}
          isSubmitting={submit.isPending}
          submitLabel={isLast ? "Submit" : "Continue"}
          footer={
            step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="w-full font-semibold transition-colors"
                style={{
                  minHeight: 48,
                  borderRadius: 16,
                  fontSize: 15,
                  border: "1px solid var(--color-border)",
                  color: "var(--color-muted-foreground)",
                  background: "var(--color-surface)",
                }}
              >
                Back
              </button>
            ) : null
          }
        />

        {isLast && signatureMissing && !submit.isPending && (
          <p className="mt-3 text-xs text-center" style={{ color: "var(--color-subtle-foreground)" }}>
            Please sign above before submitting.
          </p>
        )}

        {submit.isError && !(submit.error instanceof ValidationError) && (
          <p className="mt-3 text-xs text-center" role="alert" style={{ color: "var(--color-destructive)" }}>
            {/* The server's own words — e.g. a minor needs a guardian on file —
                tell the patient what to do; a generic failure does not. */}
            {submit.error instanceof ApiError && submit.error.status !== 0
              ? submit.error.message
              : "We could not save your answers. Please check your connection and try again."}
          </p>
        )}

        {submit.error instanceof ValidationError && (
          <p className="mt-3 text-xs text-center" role="alert" style={{ color: "var(--color-destructive)" }}>
            Some answers are still needed — we have taken you back to them.
          </p>
        )}
      </div>
    </div>
  );
}

/* ─── Chrome (from DentalOS) ────────────────────────────────────── */

/** Bars only: the step's name is the heading right below, and printing it twice reads as a fault. */
function Progress({ count, step }: { count: number; step: number }) {
  return (
    <div className="card-premium px-4 py-3" aria-hidden="true">
      <div className="flex items-center gap-1.5">
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className="flex-1 rounded-full transition-colors"
            style={{ height: 4, background: i <= step ? "var(--color-primary)" : "var(--color-border)" }}
          />
        ))}
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="card-premium p-8 text-center space-y-2">{children}</div>;
}

function Loading() {
  return (
    <div className="card-premium p-8 text-center">
      <div
        className="w-10 h-10 rounded-full border-4 animate-spin mx-auto mb-4"
        style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
        aria-label="Loading your forms"
      />
      <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
        Loading your forms…
      </p>
    </div>
  );
}

function LinkNotFound({ message }: { message?: string }) {
  return (
    <Card>
      <h1 className="text-base font-semibold" style={{ color: "var(--color-foreground)" }}>
        {message === "Intake token has expired." ? "This link has expired" : "Link not found"}
      </h1>
      <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
        Please ask the front desk to send you a new one.
      </p>
    </Card>
  );
}

function Done() {
  return (
    <div className="card-premium p-8 text-center space-y-3">
      <div
        className="flex items-center justify-center rounded-full mx-auto mb-2"
        style={{ width: 64, height: 64, background: "var(--color-success-light)" }}
        aria-hidden="true"
      >
        <CheckCircle2 size={32} style={{ color: "var(--color-success)" }} strokeWidth={1.75} />
      </div>
      <h1 className="text-lg font-bold" style={{ color: "var(--color-foreground)" }}>
        Thank you
      </h1>
      <p className="text-sm" style={{ color: "var(--color-muted-foreground)" }}>
        Your signed forms have been sent to the clinic. There is nothing else to do — please see the front desk when you
        arrive.
      </p>
    </div>
  );
}
