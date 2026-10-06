import type { IntakePortalPacket, IntakeSection } from '@/types/api'

/**
 * Packet sections → wizard steps, §19.
 *
 * The grouping is **derived from the section keys, never hard-coded to a count**.
 * The old page sliced `fields` into `Math.ceil(fields.length / 3)` thirds, which
 * cut a consent form in half mid-sentence and put the signature box on the same
 * step as the allergy question — and would have produced three steps whatever a
 * clinic actually configured. A clinic that adds a fourth template, drops the
 * HMO block, or ships a single combined form gets a wizard shaped like its own
 * packet here, with no code change.
 *
 * The four buckets are the brief's, and each is skipped when nothing lands in
 * it: the seeded New Patient Packet has no personal-details template, so it
 * produces two steps rather than four empty-ish ones. An empty step is worse
 * than a missing one — it reads as a form that failed to load.
 */

export interface IntakeStep {
  title:    string
  sections: IntakeSection[]
}

/**
 * The buckets, in the order a patient meets them.
 *
 * Matching is on the section **key**, which is `slugify(template.name)` — the
 * one identifier both routes to a section produce (a whole template, or a
 * `"section"` key inside `fieldsSchema`). Matching on the title would break the
 * moment a clinic renamed "Medical History" to "Health History", which is
 * precisely the kind of edit a clinic makes without telling anyone.
 *
 * Order matters: `consent` is tested first because "Data Privacy Consent"
 * contains neither "medical" nor "hmo" but "Treatment Consent (Medical)" would
 * contain one, and a consent form belongs at the end wherever its wording
 * wandered.
 */
const BUCKETS: ReadonlyArray<{ title: string; test: RegExp }> = [
  { title: 'Consent & Signature',          test: /consent|signature|privacy|authoriz|acknowledg|waiver|agreement/ },
  { title: 'HMO / Additional Information', test: /^hmo(_|$)|insurance|coverage|payor/ },
  { title: 'Health & Dental History',      test: /medical|health|dental|history|allerg|medication|condition/ },
  { title: 'About You',                    test: /.*/ },
]

/**
 * Which sections this patient is actually shown.
 *
 * `show_if` is the HMO conditional (§11, Scenario C). The server has already
 * folded it into `required` — a hidden section reports `required: false`, so it
 * **can never block submission** whatever this function decides — but it still
 * ships the section's fields, so the client hides it too. Without that, a
 * self-pay patient is shown an HMO member number they cannot produce and do not
 * owe anyone.
 *
 * ## The payor type is not in the response, so this infers it
 *
 * `GET /api/public/intake/:token` returns `{ clinic, patient_name, sections,
 * patient_data, submission_id, status }` and nothing else — there is no
 * `payor_type` to compare `show_if` against. What there is, is the server's own
 * evaluation of the same condition, already baked into each section's
 * `required`: `required = item.isRequired && sectionApplies(show_if, context)`.
 * So a conditional section that comes back `required: true` is one whose
 * condition matched, and that is a fact the client can read directly.
 *
 * The inference is exact in one direction and lossy in the other. `required:
 * true` on a conditional section means it matched, always. `required: false`
 * means either it did not match — hide it, correct — or it matched but the
 * packet item was optional, in which case an HMO patient loses an optional HMO
 * section they could have filled in. That degradation is silent and one-sided by
 * design: it can only ever hide an optional question, never block a submission
 * and never show HMO fields to somebody who is paying for themselves. The
 * opposite default would leak the fields to every self-pay patient, which is the
 * failure this conditional exists to prevent.
 *
 * `payorType` is here for the day the API sends it: pass it and the condition is
 * evaluated exactly, with no inference at all. That is a one-line change on both
 * sides and is written up as a change request in the handoff.
 */
export function visibleSections(sections: IntakeSection[], payorType?: string | null): IntakeSection[] {
  return sections.filter((section) => {
    if (!section.show_if) return true
    if (payorType !== undefined) return section.show_if.payor_type === (payorType ?? 'self_pay')
    return section.required
  })
}

/**
 * Group the visible sections into steps.
 *
 * The fallback is the interesting half. If everything lands in one bucket — a
 * clinic whose packet is three templates all named "…History", say — the patient
 * would get one enormous page. So when the buckets fail to separate three or
 * more sections, the grouping falls back to one step per section and uses each
 * section's own title. Still derived from the data, still no fixed count.
 */
export function buildSteps(sections: IntakeSection[]): IntakeStep[] {
  if (sections.length === 0) return []

  const grouped = new Map<string, IntakeSection[]>()

  for (const section of sections) {
    const bucket = BUCKETS.find((b) => b.test.test(section.key)) ?? BUCKETS[BUCKETS.length - 1]
    const list   = grouped.get(bucket.title)
    if (list) list.push(section)
    else grouped.set(bucket.title, [section])
  }

  // Canonical order, not insertion order: consent is last however the packet
  // happens to be sorted, because signing before reading the health questions is
  // signing something the patient has not filled in yet.
  const ordered: IntakeStep[] = ['About You', 'Health & Dental History', 'HMO / Additional Information', 'Consent & Signature']
    .flatMap((title) => {
      const list = grouped.get(title)
      return list ? [{ title, sections: list }] : []
    })

  if (ordered.length === 1 && sections.length >= 3) {
    return sections.map((section) => ({ title: section.title, sections: [section] }))
  }

  return ordered
}

/**
 * Where a field key lives — the step index, for putting a 422 back in its place.
 *
 * The server names missing answers `responses.<field_key>` and nothing else: no
 * section, no step. So the map is rebuilt from the same sections the wizard is
 * rendering, which is the only place that correspondence exists.
 *
 * A key can legitimately appear twice — the seeded Treatment Consent and Data
 * Privacy Consent both declare `acknowledge`, and `responses` is a flat map, so
 * they are one answer whether or not that was intended. First occurrence wins:
 * sending the patient to the earlier step means walking forward through what
 * they still owe, rather than backward.
 */
export function stepOfField(steps: IntakeStep[]): Map<string, number> {
  const index = new Map<string, number>()

  steps.forEach((step, i) => {
    for (const section of step.sections) {
      for (const field of section.fields) {
        if (!index.has(field.key)) index.set(field.key, i)
      }
    }
  })

  return index
}

/**
 * Seed the answers from what the clinic already holds (§20).
 *
 * A returning patient should not retype their own phone number. `patient_data`
 * is keyed by patient/medical-profile field names, and prefill happens **only on
 * an exact key match** — a template asking `medications` gets nothing from
 * `current_medications`, and guessing at near-matches would put the wrong answer
 * in a medical history with the patient's name on it.
 *
 * Types are coerced where the record and the form legitimately disagree:
 * `allergies` is a `String[]` on the medical profile and a `textarea` on the
 * form, so the array is joined rather than rendered as `[object Object]` or
 * dropped. A `checkboxes` field going the other way keeps the array.
 */
export function prefillFrom(
  sections: IntakeSection[],
  patientData: Record<string, unknown>,
): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  for (const section of sections) {
    for (const field of section.fields) {
      if (!(field.key in patientData)) continue

      const raw = patientData[field.key]
      if (raw === null || raw === undefined) continue

      if (field.type === 'checkboxes') {
        values[field.key] = Array.isArray(raw) ? raw : [String(raw)]
        continue
      }

      if (field.type === 'boolean' || field.type === 'checkbox') {
        values[field.key] = raw === true || raw === 'true'
        continue
      }

      values[field.key] = Array.isArray(raw) ? raw.join(', ') : String(raw)
    }
  }

  return values
}

/**
 * The fields of a step, with exact repeats removed.
 *
 * Two sections in one step can legitimately declare the same field key —
 * `responses` is a flat map, so the seeded Treatment Consent and Data Privacy
 * Consent share one `acknowledge` answer whether or not that was intended, and
 * both templates declare a `signature`. Rendering them verbatim puts **two
 * identical signature pads on one screen**, both writing the same value, both
 * reporting "Signature captured." after either is used. That reads as a bug even
 * though the underlying single answer is correct.
 *
 * So a repeat is dropped only when the key, the type *and* the label all match —
 * which is true of the two `signature` fields and false of the two `acknowledge`
 * boxes, whose labels are different consents and both of which the patient
 * should see. The shared answer behind those two is the server's, and hiding one
 * of them would hide a consent rather than tidy a duplicate.
 */
export function stepFields(step: IntakeStep): IntakeSection['fields'] {
  const seen = new Set<string>()

  return step.sections.flatMap((section) =>
    section.fields.filter((field) => {
      const identity = `${field.key}\u0000${field.type}\u0000${field.label}`
      if (seen.has(identity)) return false
      seen.add(identity)
      return true
    }),
  )
}


/**
 * The packet's own sections, one per template, in the order the clinic set.
 *
 * This is the grouping §19 asked for, and it was in the data all along: the
 * seeded New Patient Packet is three templates — Medical History, Treatment
 * Consent, Data Privacy Consent — and the wizard used to ignore that and slice
 * the flattened field list into thirds, which cut the consent in half and put
 * the signature box next to the allergy question.
 *
 * Derived here rather than served ready-made because the portal response is
 * pinned by a golden fixture; adding a `sections` key to it would be a contract
 * change for a grouping the client can do itself.
 *
 * `key` is the slugified template name, disambiguated on collision — two
 * templates may legitimately share one, and React keys off it.
 */
export function sectionsFromPacket(packet: IntakePortalPacket | undefined): IntakeSection[] {
  if (!packet) return []

  const seen = new Map<string, number>()

  return [...packet.packet.items]
    .sort((a, b) => a.sort_order - b.sort_order || a.id.localeCompare(b.id))
    .map((item) => {
      const base = slug(item.template.name)
      const n = seen.get(base) ?? 0
      seen.set(base, n + 1)

      return {
        key: n === 0 ? base : `${base}-${n + 1}`,
        title: item.template.name,
        template_id: item.template.id,
        required: item.is_required,
        show_if: null,
        fields: Array.isArray(item.template.fields_schema) ? item.template.fields_schema : [],
      }
    })
}

/** `Data Privacy Consent (RA 10173)` → `data_privacy_consent_ra_10173`. */
function slug(name: string): string {
  const out = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return out || 'section'
}
