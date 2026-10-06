"use client";

import { use, useState } from "react";
import { Check, Copy, ExternalLink, FileSignature, FileText, Send, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PatientSearch } from "@/components/frontdesk/PatientSearch";
import { FormError } from "@/components/ui/form";
import {
  documentFileUrl,
  useCreateGuardianLink,
  useDeleteGuardianLink,
  useGuardianLinks,
  useMintIntakeLink,
  usePackets,
  usePatientDocuments,
  usePatientSubmissions,
  useUpdateGuardianLink,
} from "@/lib/api/consent";
import { usePatient } from "@/lib/api/patients";
import { GUARDIAN_RELATIONSHIPS, type GuardianLink, type GuardianRelationship, type IntakeLink } from "@/types/api";

/**
 * Consent for one patient: send the forms, see what came back, and — for a
 * minor — record who may sign on their behalf.
 *
 * DentalOS mints intake links only when an appointment is confirmed (its header
 * "Send Intake" button was never wired up). This tab gives the front desk the
 * missing door: pick a packet, get the link, hand the tablet over or send it.
 * Confirming an appointment still mints one automatically.
 */
export default function PatientConsentPage({ params }: PageProps<"/patients/[id]/consent">) {
  const { id } = use(params);
  const patient = usePatient(id);

  return (
    <div className="p-6 space-y-4 max-w-5xl">
      {patient.data?.is_minor && <GuardianWarning patientId={id} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
        <SendForms patientId={id} />
        <Guardians patientId={id} patientName={patient.data?.full_name} />
      </div>
      <Requests patientId={id} />
    </div>
  );
}

/* ─── Send ──────────────────────────────────────────────────────── */

function SendForms({ patientId }: { patientId: string }) {
  const packets = usePackets();
  const mint = useMintIntakeLink(patientId);
  const [packetId, setPacketId] = useState("");
  const [link, setLink] = useState<IntakeLink | null>(null);
  const [copied, setCopied] = useState(false);

  const chosen = packetId || packets.data?.[0]?.id || "";

  async function copy(url: string) {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Card title="Send consent forms" icon={Send} subtitle="Creates a private, single-use link for this patient">
      <div className="space-y-3">
        <div className="flex gap-2">
          <select
            aria-label="Forms to send"
            value={chosen}
            onChange={(e) => setPacketId(e.target.value)}
            className="flex-1 h-9 rounded-lg px-3 text-sm outline-none field-focus"
            style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
            disabled={packets.isLoading}
          >
            {packets.data?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {p.items.map((i) => i.template.name).join(", ")}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!chosen || mint.isPending}
            onClick={() => mint.mutate(chosen, { onSuccess: setLink })}
          >
            {mint.isPending ? "Creating…" : "Create link"}
          </button>
        </div>

        <FormError error={mint.error} />

        {link && (
          <div className="rounded-xl p-3 space-y-2" style={{ background: "var(--color-primary-light)" }}>
            <p className="text-xs font-semibold" style={{ color: "var(--color-primary-hover)" }}>
              Link ready — it is shown only now, so copy or open it before leaving this page.
            </p>
            <p className="text-xs font-mono break-all" style={{ color: "var(--color-foreground)" }}>
              {link.url}
            </p>
            <div className="flex gap-2 flex-wrap">
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copy(link.url)}>
                {copied ? <Check size={13} /> : <Copy size={13} />}
                {copied ? "Copied" : "Copy link"}
              </button>
              <a className="btn btn-secondary btn-sm" href={link.url} target="_blank" rel="noreferrer">
                <ExternalLink size={13} /> Open on this device
              </a>
              <span className="text-xs self-center" style={{ color: "var(--color-muted-foreground)" }}>
                Expires {link.expires_at.slice(0, 16).replace("T", " ")}
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ─── Requests & signed documents ───────────────────────────────── */

function Requests({ patientId }: { patientId: string }) {
  const submissions = usePatientSubmissions(patientId);
  const documents = usePatientDocuments(patientId);
  const packets = usePackets();

  const packetName = (id: string) => packets.data?.find((p) => p.id === id)?.name ?? "Forms";
  const rows = submissions.data ?? [];

  return (
    <Card title="Consent requests" icon={FileSignature} subtitle="Every link sent to this patient, newest first. Signed forms are filed as PDFs.">
      {submissions.isLoading ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton" style={{ height: 44, borderRadius: 10 }} />
          ))}
        </div>
      ) : submissions.isError ? (
        <p className="text-xs" role="alert" style={{ color: "var(--color-destructive)" }}>
          The requests could not be loaded. Treat this list as unknown rather than empty.
        </p>
      ) : rows.length === 0 ? (
        <EmptyState icon={FileText} title="No forms sent yet" description="Create a link above, or confirm an appointment — that sends the New Patient Packet automatically." />
      ) : (
        <ul className="divide-y -mx-5">
          {rows.map((s) => {
            const doc = documents.data?.find((d) => d.id === s.document_id);
            return (
              <li key={s.id} className="flex items-center gap-3 px-5 py-3">
                <span className={s.status === "completed" ? "chip chip-confirmed" : "chip chip-pending"}>
                  {s.status === "completed" ? "Signed" : "Waiting"}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
                    {packetName(s.packet_id)}
                  </p>
                  <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                    Sent {s.created_at.slice(0, 16).replace("T", " ")}
                    {s.completed_at && ` · signed ${s.completed_at.slice(0, 16).replace("T", " ")}`}
                    {s.appointment_id && " · from an appointment"}
                  </p>
                </div>
                {s.document_id && (
                  <a className="btn btn-secondary btn-sm" href={documentFileUrl(s.document_id)} target="_blank" rel="noreferrer">
                    <FileText size={13} /> Signed PDF{doc?.size_bytes ? ` · ${Math.round(doc.size_bytes / 1024)} KB` : ""}
                  </a>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/* ─── Guardians ─────────────────────────────────────────────────── */

const RELATIONSHIP_LABEL: Record<GuardianRelationship, string> = {
  parent: "Parent",
  legal_guardian: "Legal guardian",
  grandparent: "Grandparent",
  sibling: "Sibling",
  other: "Other",
};

function GuardianWarning({ patientId }: { patientId: string }) {
  const links = useGuardianLinks(patientId);
  const authorised = links.data?.some((l) => l.ward_patient_id === patientId && l.consent_authority_flag);
  if (links.isLoading || authorised) return null;

  return (
    <div
      role="alert"
      className="rounded-xl px-4 py-3 text-sm flex items-start gap-2"
      style={{ background: "var(--color-amber-light)", color: "#92400E", border: "1px solid #FCD34D" }}
    >
      <ShieldCheck size={16} className="mt-0.5 shrink-0" />
      <span>
        This patient is under 18 and cannot sign for themselves. Add a guardian with <strong>consent authority</strong>{" "}
        before they open a consent link — otherwise signing will be refused.
      </span>
    </div>
  );
}

function Guardians({ patientId, patientName }: { patientId: string; patientName?: string }) {
  const links = useGuardianLinks(patientId);
  const create = useCreateGuardianLink();
  const update = useUpdateGuardianLink();
  const remove = useDeleteGuardianLink();

  const [adding, setAdding] = useState(false);
  const [guardian, setGuardian] = useState<{ id: string; name: string } | null>(null);
  const [relationship, setRelationship] = useState<GuardianRelationship>("parent");
  const [authority, setAuthority] = useState(true);

  const guardians = (links.data ?? []).filter((l) => l.ward_patient_id === patientId);
  const wards = (links.data ?? []).filter((l) => l.guardian_patient_id === patientId);

  function reset() {
    setAdding(false);
    setGuardian(null);
    setRelationship("parent");
    setAuthority(true);
    create.reset();
  }

  return (
    <Card
      title="Guardians"
      icon={ShieldCheck}
      subtitle="Who may consent for a patient under 18"
      action={
        !adding && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            <UserPlus size={13} /> Add guardian
          </button>
        )
      }
    >
      <div className="space-y-3">
        {adding && (
          <div className="rounded-xl p-3 space-y-3" style={{ background: "var(--color-surface-subtle)", border: "1px solid var(--color-border)" }}>
            {guardian ? (
              <p className="text-sm" style={{ color: "var(--color-foreground)" }}>
                Guardian: <strong>{guardian.name}</strong>{" "}
                <button type="button" className="text-xs underline ml-1" style={{ color: "var(--color-primary)" }} onClick={() => setGuardian(null)}>
                  change
                </button>
              </p>
            ) : (
              <PatientSearch
                placeholder="Find the guardian's patient record…"
                onSelect={(p) => setGuardian({ id: p.id, name: p.name })}
              />
            )}
            <div className="flex gap-2 items-center flex-wrap">
              <select
                aria-label="Relationship"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value as GuardianRelationship)}
                className="h-9 rounded-lg px-3 text-sm outline-none field-focus"
                style={{ background: "var(--color-surface)", border: "1px solid var(--color-border)" }}
              >
                {GUARDIAN_RELATIONSHIPS.map((r) => (
                  <option key={r} value={r}>
                    {RELATIONSHIP_LABEL[r]}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={authority}
                  onChange={(e) => setAuthority(e.target.checked)}
                  style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }}
                />
                May sign consent
              </label>
            </div>
            <FormError error={create.error} />
            <div className="flex gap-2 justify-end">
              <button type="button" className="btn btn-ghost btn-sm" onClick={reset}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={!guardian || create.isPending}
                onClick={() =>
                  guardian &&
                  create.mutate(
                    { guardian_patient_id: guardian.id, ward_patient_id: patientId, relationship, consent_authority_flag: authority },
                    { onSuccess: reset },
                  )
                }
              >
                {create.isPending ? "Saving…" : "Save guardian"}
              </button>
            </div>
          </div>
        )}

        {links.isLoading ? (
          <div className="skeleton" style={{ height: 40, borderRadius: 10 }} />
        ) : guardians.length === 0 && wards.length === 0 && !adding ? (
          <p className="text-sm" style={{ color: "var(--color-subtle-foreground)" }}>
            No guardians recorded.
          </p>
        ) : null}

        {guardians.map((link) => (
          <GuardianRow
            key={link.id}
            name={`${link.guardian?.first_name ?? ""} ${link.guardian?.last_name ?? ""}`.trim()}
            link={link}
            onToggle={(next) => update.mutate({ id: link.id, consent_authority_flag: next })}
            onRemove={() => remove.mutate(link.id)}
            busy={update.isPending || remove.isPending}
          />
        ))}

        {wards.length > 0 && (
          <div className="pt-1">
            <p className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--color-subtle-foreground)" }}>
              {patientName ? `${patientName} is guardian of` : "Guardian of"}
            </p>
            {wards.map((link) => (
              <p key={link.id} className="text-sm" style={{ color: "var(--color-foreground)" }}>
                {link.ward?.first_name} {link.ward?.last_name}{" "}
                <span className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
                  ({RELATIONSHIP_LABEL[link.relationship]}
                  {link.consent_authority_flag ? ", may sign" : ""})
                </span>
              </p>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

function GuardianRow({
  name,
  link,
  onToggle,
  onRemove,
  busy,
}: {
  name: string;
  link: GuardianLink;
  onToggle: (next: boolean) => void;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2" style={{ border: "1px solid var(--color-border)" }}>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium" style={{ color: "var(--color-foreground)" }}>
          {name || "Unknown"}
        </p>
        <p className="text-xs" style={{ color: "var(--color-muted-foreground)" }}>
          {RELATIONSHIP_LABEL[link.relationship]}
        </p>
      </div>
      <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
        <input
          type="checkbox"
          checked={link.consent_authority_flag}
          disabled={busy}
          onChange={(e) => onToggle(e.target.checked)}
          style={{ width: 15, height: 15, accentColor: "var(--color-primary)" }}
        />
        May sign consent
      </label>
      <button type="button" className="btn-ghost p-1.5 rounded-md" aria-label={`Remove ${name}`} disabled={busy} onClick={onRemove}>
        <Trash2 size={14} />
      </button>
    </div>
  );
}

/* ─── Card ──────────────────────────────────────────────────────── */

function Card({
  title,
  subtitle,
  icon: Icon,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="card-premium overflow-visible">
      <div className="flex items-center gap-3 px-5 py-4" style={{ borderBottom: "1px solid var(--color-border)" }}>
        <Icon size={16} style={{ color: "var(--color-primary)" }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
            {title}
          </h2>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: "var(--color-muted-foreground)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}
