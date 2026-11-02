"use client";

import { use, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, FileSignature, FileText, History, PenLine, RotateCcw } from "lucide-react";
import { SignaturePad } from "@/components/shared/SignaturePad";
import { Field, FormError, TextField } from "@/components/ui/form";
import { ApiError } from "@/lib/api/client";
import { documentFileUrl, signatureUrl, useConsentForm, usePatientConsent, useSignConsent } from "@/lib/api/consent";
import { usePatient } from "@/lib/api/patients";
import { clock, dateOf, longDate, timeOf } from "@/lib/utils/manila";
import type { PatientConsent } from "@/types/api";

/**
 * The patient's consent: one form, signed on this device.
 *
 * Unsigned, the tab shows the form with a signature pad under it. Signed, it
 * shows the form as it was signed, with the signature. "Sign again" files a new
 * signing and keeps the old one under "Previous consents".
 */
export default function PatientConsentPage({ params }: PageProps<"/patients/[id]/consent">) {
  const { id } = use(params);
  const consent = usePatientConsent(id);
  const [signingAgain, setSigningAgain] = useState(false);

  if (consent.isLoading) {
    return (
      <div className="p-6" aria-busy="true">
        <div className="skeleton" style={{ height: 320, borderRadius: 16 }} />
      </div>
    );
  }

  if (consent.isError || !consent.data) {
    return (
      <div className="p-6">
        <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          The consent could not be loaded. Treat it as unknown rather than unsigned.
        </p>
      </div>
    );
  }

  const { current, previous } = consent.data;

  return (
    <div className="p-6 space-y-10">
      {current && !signingAgain ? (
        <SignedConsent current={current} onSignAgain={() => setSigningAgain(true)} />
      ) : (
        <SignConsent
          patientId={id}
          onCancel={current ? () => setSigningAgain(false) : undefined}
          onSigned={() => setSigningAgain(false)}
        />
      )}
      {previous.length > 0 && <PreviousConsents previous={previous} />}
    </div>
  );
}

/* ─── Sign ──────────────────────────────────────────────────────── */

function SignConsent({
  patientId,
  onCancel,
  onSigned,
}: {
  patientId: string;
  onCancel?: () => void;
  onSigned: () => void;
}) {
  const qc = useQueryClient();
  const patient = usePatient(patientId);
  const form = useConsentForm();
  const sign = useSignConsent(patientId);

  const [signature, setSignature] = useState<string | null>(null);
  const [signerName, setSignerName] = useState("");
  const [relationship, setRelationship] = useState("");

  const isMinor = patient.data?.is_minor ?? false;
  const ready = !!form.data && !!signature && (!isMinor || (signerName.trim() !== "" && relationship.trim() !== ""));

  function confirm() {
    if (!form.data || !signature) return;
    sign.mutate(
      {
        form_version: form.data.version,
        signature_data_uri: signature,
        ...(isMinor ? { signer_name: signerName.trim(), signer_relationship: relationship.trim() } : {}),
      },
      {
        onSuccess: onSigned,
        // The form was edited while it was open: show the new wording to sign.
        onError: (error) => {
          if (error instanceof ApiError && error.status === 409) void qc.invalidateQueries({ queryKey: ["consent-form"] });
        },
      },
    );
  }

  return (
    <Section title="Consent Form" icon={FileSignature}>
      {form.isLoading ? (
        <div className="skeleton" style={{ height: 160, borderRadius: 10 }} />
      ) : form.isError || !form.data ? (
        <p className="text-sm" role="alert" style={{ color: "var(--color-destructive)" }}>
          The consent form could not be loaded.
        </p>
      ) : (
        <div className="space-y-5">
          {form.data.is_placeholder && (
            <div
              role="alert"
              className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
              style={{ background: "var(--color-amber-light)", color: "#92400E", border: "1px solid #FCD34D" }}
            >
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                This form still has the starter text. Paste your clinic&apos;s wording into{" "}
                <code className="font-mono text-xs">backend/consent-form.txt</code> before patients sign it.
              </span>
            </div>
          )}

          <FormText text={form.data.text} />

          <div className="space-y-3 pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
            {isMinor ? (
              <>
                <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                  This patient is under 18, so a <strong>parent or guardian</strong> signs for them.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Parent or guardian's full name">
                    <TextField value={signerName} onChange={(e) => setSignerName(e.target.value)} autoComplete="off" />
                  </Field>
                  <Field label="Relationship to patient">
                    <TextField
                      value={relationship}
                      onChange={(e) => setRelationship(e.target.value)}
                      placeholder="e.g. Mother"
                      autoComplete="off"
                    />
                  </Field>
                </div>
              </>
            ) : (
              <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                Signing as <strong>{patient.data?.full_name ?? "the patient"}</strong>
              </p>
            )}

            <div>
              <p className="text-xs font-medium mb-1 flex items-center gap-1.5" style={{ color: "var(--color-foreground)" }}>
                <PenLine size={13} /> Signature
              </p>
              <SignaturePad onChange={setSignature} disabled={sign.isPending} />
            </div>

            <FormError error={sign.error} />

            <div className="flex gap-2 justify-end" data-print="hide">
              {onCancel && (
                <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={sign.isPending}>
                  Cancel
                </button>
              )}
              <button type="button" className="btn btn-primary" disabled={!ready || sign.isPending} onClick={confirm}>
                {sign.isPending ? "Saving…" : "Confirm and save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Section>
  );
}

/* ─── Signed ────────────────────────────────────────────────────── */

const signedOn = (iso: string) => `${longDate(dateOf(iso))} at ${clock(timeOf(iso))}`;

function SignedConsent({
  current,
  onSignAgain,
}: {
  current: NonNullable<PatientConsent["current"]>;
  onSignAgain: () => void;
}) {
  return (
    <Section
      title="Consent Form"
      icon={FileSignature}
      badge={<span className="chip chip-confirmed">Signed</span>}
      action={
        <div className="flex gap-2" data-print="hide">
          <a className="btn btn-secondary btn-sm" href={documentFileUrl(current.document_id)} target="_blank" rel="noreferrer">
            <FileText size={13} /> View PDF
          </a>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onSignAgain}>
            <RotateCcw size={13} /> Sign again
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <FormText text={current.form_text} />
        <div className="pt-4" style={{ borderTop: "1px solid var(--color-border)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- served by the API behind the sign-in cookie, which next/image would not send */}
          <img src={signatureUrl(current.id)} alt={`Signature of ${current.signer_name}`} style={{ maxHeight: 100, maxWidth: 300 }} />
          <div style={{ borderTop: "1px solid var(--color-foreground)", maxWidth: 300 }} />
          <p className="text-sm font-semibold mt-1" style={{ color: "var(--color-foreground)" }}>
            {current.signer_name}
            {current.signer_relationship && (
              <span className="font-normal" style={{ color: "var(--color-muted-foreground)" }}>
                {" "}({current.signer_relationship}, on the patient&apos;s behalf)
              </span>
            )}
          </p>
          <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
            Signed {signedOn(current.signed_at)}
          </p>
        </div>
      </div>
    </Section>
  );
}

/* ─── Previous ──────────────────────────────────────────────────── */

function PreviousConsents({ previous }: { previous: PatientConsent["previous"] }) {
  return (
    <Section title="Previous consents" icon={History}>
      <ul className="divide-y -mt-2">
        {previous.map((p) => (
          <li key={p.document_id} className="flex items-center gap-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                {p.title}
              </p>
              <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                Signed {signedOn(p.signed_at)}
              </p>
            </div>
            <a className="btn btn-secondary btn-sm" href={documentFileUrl(p.document_id)} target="_blank" rel="noreferrer" data-print="hide">
              <FileText size={13} /> PDF{p.size_bytes ? ` · ${Math.round(p.size_bytes / 1024)} KB` : ""}
            </a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

/* ─── Pieces ────────────────────────────────────────────────────── */

/** The form text: blank-line-separated paragraphs; a paragraph starting with "# " is a heading. */
function FormText({ text }: { text: string }) {
  return (
    <div className="space-y-3 text-sm leading-relaxed" style={{ color: "var(--color-foreground)" }}>
      {text.split(/\n\s*\n/).map((block, i) =>
        block.startsWith("# ") ? (
          <h3 key={i} className="text-base font-semibold pt-1">
            {block.slice(2).trim()}
          </h3>
        ) : (
          <p key={i} className="whitespace-pre-line">
            {block.trim()}
          </p>
        ),
      )}
    </div>
  );
}

/** A titled part of the tab: a heading over a rule, straight on the panel. */
function Section({
  title,
  icon: Icon,
  badge,
  action,
  children,
}: {
  title: string;
  icon: React.ElementType;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-center gap-3 pb-2 mb-4 flex-wrap" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <Icon size={16} style={{ color: "var(--color-primary)" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
          {title}
        </h2>
        {badge}
        <div className="ml-auto">{action}</div>
      </div>
      {children}
    </section>
  );
}
