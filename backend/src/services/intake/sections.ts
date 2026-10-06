// Ported verbatim from DentalOS apps/api/src/intake/intake-sections.ts
import type { IntakePacketItem, IntakeTemplate } from '../../generated/prisma/client.js'

/**
 * Packet → sections, for a patient-facing wizard.
 *
 * **No schema change, and none is needed** (frozen fact #7). Sections already
 * exist in the data: a packet is an ordered list of `IntakePacketItem →
 * IntakeTemplate`, and the New Patient Packet has been three templates — Medical
 * History, Treatment Consent, Data Privacy Consent — since the first seed. The
 * portal endpoint returns exactly that, nested. What was missing was a flat,
 * ordered, renderable projection of it, so `app/(intake)/[token]/page.tsx` gave
 * up and sliced the fields into thirds with `Math.ceil(fields.length / 3)` —
 * cutting a consent form in half mid-sentence and putting the signature box on
 * the same step as the allergy question.
 *
 * Everything here is a pure function over plain data. That is deliberate: the
 * interesting logic is the HMO conditional and the required-field gate, and both
 * are decisions about content rather than about the database. Testing them
 * through a Prisma client would test the seed.
 */

/** One question, as the wizard renders it. */
interface IntakeFieldSpec {
  key: string
  type: string
  label: string
  required: boolean
  /** Present only for the choice types — `select`, `radio`, `checkboxes`. */
  options?: string[]
}

export interface IntakeSection {
  /** Stable within one packet. The frontend keys React nodes on it. */
  key: string
  title: string
  templateId: string
  /**
   * Required **of this patient**, not merely declared required by the packet.
   *
   * A section the patient is never shown cannot be required of them, so a
   * section whose `showIf` does not match the context is reported as not
   * required even when its packet item says otherwise. That is what stops a
   * self-pay patient being blocked by an HMO member number they were never
   * asked for — see `missingRequiredFields`, which is the server-side half of
   * the same rule.
   */
  required: boolean
  showIf: { payor_type: string } | null
  fields: IntakeFieldSpec[]
}

export type PacketItemWithTemplate = Pick<IntakePacketItem, 'id' | 'templateId' | 'sortOrder' | 'isRequired'> & {
  template?: Pick<IntakeTemplate, 'id' | 'name' | 'fieldsSchema'> | null
}

export interface SectionContext {
  /** `self_pay | hmo | corporate`. Null — no linked appointment — reads as self-pay. */
  payorType: string | null
}

/**
 * The HMO conditional (§E1, §11 Scenario C).
 *
 * The rule is on the **section key**, not on the template name, because the key
 * is the one identifier both paths to a section produce: `slugify('HMO
 * Information')` and a field carrying `"section": "hmo_information"` both land on
 * `hmo_information`. Writing the rule against the name would have covered the
 * first and silently missed the second, and a clinic that tucks two HMO fields
 * into an existing template would have shown them to every self-pay patient.
 *
 * The token boundary matters: `hmo` or `hmo_…` matches, `homeopathy` does not.
 * Any clinic can add an HMO section by naming a template "HMO Information" — no
 * code change, no migration, no allow-list to update, which is the whole point of
 * keeping this data-driven.
 */
const HMO_SECTION = /^hmo(_|$)/

/** The only acronym this domain guarantees (rule #5: PH payor model). */
const ACRONYMS: Readonly<Record<string, string>> = { hmo: 'HMO' }

/**
 * Build the sections for one packet.
 *
 * Ordering is `sortOrder` then `id`, matching every other ordered read in this
 * codebase. An unstable sort is a named trap here: the seeded packet items share
 * a `sortOrder` of 0 across packets and every row shares a `created_at`, so
 * without the tie-break PostgreSQL is free to return them in a different order on
 * each call — and a wizard whose steps reorder between the first render and a
 * back-navigation loses the patient's place.
 */
export function buildSections(items: PacketItemWithTemplate[], context: SectionContext): IntakeSection[] {
  const ordered = [...items].sort(
    (a, b) => a.sortOrder - b.sortOrder || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  )

  const taken = new Set<string>()
  const sections: IntakeSection[] = []

  for (const item of ordered) {
    const template = item.template
    if (!template) continue

    for (const group of groupBySection(parseFields(template.fieldsSchema))) {
      const slug = group.section === null ? slugify(template.name) : slugify(group.section)
      const showIf = HMO_SECTION.test(slug) ? { payor_type: 'hmo' } : null

      sections.push({
        key: uniqueKey(slug, taken),
        title: group.section === null ? template.name : humanize(group.section),
        templateId: template.id,
        required: item.isRequired && sectionApplies(showIf, context),
        showIf,
        fields: group.fields.map(({ section: _section, ...field }) => field),
      })
    }
  }

  return sections
}

/** Whether a section's `showIf` is satisfied. No `showIf` means always shown. */
function sectionApplies(showIf: { payor_type: string } | null, context: SectionContext): boolean {
  if (!showIf) return true

  // A submission with no linked appointment has no payor on file, and the safe
  // reading is self-pay: showing an HMO block to someone who has not said they
  // have one asks for a card number they cannot produce, and — because the block
  // is required — stops them finishing the form at all.
  return (context.payorType ?? 'self_pay') === showIf.payor_type
}

/**
 * Which required answers are missing. The server-side half of `show_if`.
 *
 * Two exemptions, and both are the difference between this working and this
 * rejecting every real submission:
 *
 *  1. **Hidden sections are skipped entirely.** `IntakeSection.required` already
 *     folds in the `showIf` result, so a hidden section is never required — the
 *     self-pay patient is not blocked by the HMO member number they were never
 *     shown, which is the exact bug this function exists to prevent.
 *  2. **`signature` fields are never checked here.** The seeded consent templates
 *     both declare a required `signature` field, but a signature does not arrive
 *     in `responses` — it arrives as a data URI on `POST /:token/sign` and is
 *     recorded on the immutable document. Checking it against `responses` would
 *     reject every submission against the New Patient Packet, before signing is
 *     even reachable.
 *
 * Keys are reported once each. Two templates in one packet may declare the same
 * field key — the seeded Treatment Consent and Data Privacy Consent both use
 * `acknowledge` — and `responses` is a flat map, so they are one answer whether
 * or not that was intended.
 */
export function missingRequiredFields(
  sections: IntakeSection[],
  responses: Record<string, unknown>,
): string[] {
  const missing: string[] = []

  for (const section of sections) {
    if (!section.required) continue

    for (const field of section.fields) {
      if (!field.required || field.type === 'signature') continue
      if (missing.includes(field.key)) continue
      if (!isAnswered(field, responses[field.key])) missing.push(field.key)
    }
  }

  return missing
}

/**
 * `checkbox` is the consent tick — "I consent to the proposed treatment" — so an
 * unticked one is not an answer, it is a refusal, and a required consent that
 * arrives `false` has not been given. `boolean` is a yes/no *question* — "Are you
 * pregnant?" — where `false` is a complete and meaningful answer. The two types
 * look alike in the schema and are opposite here.
 */
function isAnswered(field: IntakeFieldSpec, value: unknown): boolean {
  if (value === undefined || value === null) return false
  if (field.type === 'checkbox') return value === true || value === 'true' || value === 1 || value === '1'
  if (typeof value === 'string') return value.trim() !== ''
  if (Array.isArray(value)) return value.length > 0
  return true
}

/**
 * `'Data Privacy Consent (RA 10173)'` → `'data_privacy_consent_ra_10173'`.
 *
 * Falls back to `'section'` rather than returning an empty string. A template
 * named entirely in punctuation or in a non-Latin script strips to nothing here,
 * and the empty key would then be the key for *every* such section — which the
 * collision suffix below cannot help with, because it makes them unique only
 * after the first. The frontend keys React nodes on this, so duplicates mean one
 * step's inputs rendering inside another's.
 */
function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')

  return slug || 'section'
}

/**
 * Slugs are not unique by construction — a packet may legitimately carry two
 * templates with the same name, most obviously two versions of "Medical History"
 * during a rollover. Colliding keys would make React reuse one step's DOM for
 * another's, so the second occurrence is suffixed. The numbering is deterministic
 * because the caller has already fixed the order.
 */
function uniqueKey(base: string, taken: Set<string>): string {
  // A template named entirely in non-Latin characters slugifies to nothing.
  // A blank key is worse than a generic one: it collides with itself.
  const root = base || 'section'

  let key = root
  for (let n = 2; taken.has(key); n++) key = `${root}_${n}`

  taken.add(key)
  return key
}

interface ParsedField extends IntakeFieldSpec {
  /** The optional finer grouping. Null for every seeded template. */
  section: string | null
}

/**
 * `fieldsSchema` is a JSONB column, so nothing about its contents is guaranteed
 * by the database. Anything that is not an object with a string `key` is dropped
 * rather than rendered as a broken input.
 */
function parseFields(schema: unknown): ParsedField[] {
  if (!Array.isArray(schema)) return []

  const fields: ParsedField[] = []

  for (const raw of schema) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue

    const { key, label, type, required, options, section } = raw as Record<string, unknown>
    if (typeof key !== 'string' || key === '') continue

    const parsed: ParsedField = {
      key,
      type: typeof type === 'string' && type !== '' ? type : 'text',
      label: typeof label === 'string' && label !== '' ? label : key,
      required: required === true,
      section: typeof section === 'string' && section.trim() !== '' ? section.trim() : null,
    }

    if (Array.isArray(options)) {
      const values = options.filter((option): option is string => typeof option === 'string')
      if (values.length > 0) parsed.options = values
    }

    fields.push(parsed)
  }

  return fields
}

interface FieldGroup {
  section: string | null
  fields: ParsedField[]
}

/**
 * Split a template's fields on the optional `"section"` key.
 *
 * **Existing seeded templates carry no such key**, so every one of them produces
 * exactly one group and renders precisely as it does today — which is what keeps
 * `GET__v1_intake_templates.json` and `GET__patient_intake_token.json` frozen.
 *
 * Groups appear in the order their first field does, and a field returning to an
 * earlier group's name rejoins it rather than opening a second group with the
 * same name — otherwise the disambiguating suffix above would invent a
 * `contact_2` step out of nothing more than the order the fields were listed in.
 *
 * A template with no usable fields still yields one group. A consent template is
 * mostly its title, and dropping it would remove a step the patient has to see.
 */
function groupBySection(fields: ParsedField[]): FieldGroup[] {
  const groups: FieldGroup[] = []
  const byName = new Map<string | null, FieldGroup>()

  for (const field of fields) {
    let group = byName.get(field.section)
    if (!group) {
      group = { section: field.section, fields: [] }
      byName.set(field.section, group)
      groups.push(group)
    }
    group.fields.push(field)
  }

  return groups.length > 0 ? groups : [{ section: null, fields: [] }]
}

/**
 * `'hmo_information'` → `'HMO Information'`.
 *
 * Best-effort, and only ever applied to the optional sub-section grouping: a
 * section that came from a template uses the template's name verbatim. A clinic
 * that needs exact wording for a heading should give those fields their own
 * template, which is the primary mechanism and the one that survives this
 * function not knowing an acronym.
 */
function humanize(value: string): string {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((word) => ACRONYMS[word.toLowerCase()] ?? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ')
}
