import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { get, post } from './client'

/**
 * The tooth chart.
 *
 * `POST /v1/patients/:id/odontogram` has existed, tested, with **nothing calling
 * it** — so the odontogram was a display of history that could not be added to,
 * and charting is the core clinical act of a dental appointment.
 *
 * ## Three reads, and they answer different questions
 *
 * - `useToothChart` — the chart as it stands, at **surface resolution**. This is
 *   what the component paints. The older per-tooth endpoint keeps only one event
 *   per tooth, which cannot represent caries on the mesial and a restoration on
 *   the occlusal; it is frozen in the contract fixtures at that shape, so the
 *   surface projection is a separate route.
 * - `useToothHistory` — every event ever charted, **including** superseded and
 *   retracted ones. The graphic drops a withdrawn finding; the list keeps it,
 *   marked. Filtering here would be the failure the whole mechanism exists to
 *   prevent.
 * - Both take `asOf`, which reads the chart as it stood on a past date.
 *
 * ## One write, and it is only ever an append
 *
 * There is no update and no delete. A correction is a new event naming the one
 * it supersedes — see `useSupersedeToothEvent`.
 */

export interface OdontogramEvent {
  id: number
  tooth_number: number
  event_type: string
  surfaces: string[] | null
  condition_code: string | null
  notes: string | null
  /** When the finding was true. */
  observed_at: string
  /** When it was recorded. Differs from `observed_at` for a back-dated entry. */
  created_at: string
  replaces_event_id: number | null
  supersession_type: 'amendment' | 'correction' | 'entered-in-error' | null
  supersession_reason: string | null
  superseded_by_event_ids: number[]
  /** FHIR wording: `final` | `amended` | `corrected` | `entered-in-error`. */
  status: string
}

/** `tooth → surface → event`, with `*` for a whole-tooth finding. */
export type SurfaceChart = Record<string, Record<string, OdontogramEvent>>

const chartKey = (patientId: string | undefined, asOf?: string) =>
  ['odontogram', 'surfaces', patientId, asOf ?? 'now'] as const

const historyKey = (patientId: string | undefined) =>
  ['odontogram', 'history', patientId] as const

export function useToothChart(patientId: string | undefined, asOf?: string) {
  return useQuery({
    queryKey: chartKey(patientId, asOf),
    queryFn: async () => {
      const qs = asOf ? `?as_of=${encodeURIComponent(asOf)}` : ''
      return (
        await get<{ data: SurfaceChart }>(
          `/api/patients/${patientId}/odontogram/surfaces${qs}`,
        )
      ).data
    },
    enabled: Boolean(patientId),
  })
}

export function useToothHistory(patientId: string | undefined) {
  return useQuery({
    queryKey: historyKey(patientId),
    queryFn: async () =>
      (await get<{ data: OdontogramEvent[] }>(`/api/patients/${patientId}/odontogram/history`))
        .data,
    enabled: Boolean(patientId),
  })
}

export interface ChartEventInput {
  tooth_number: number
  event_type: 'condition' | 'procedure' | 'treatment'
  /** Omit entirely for a whole-tooth finding — missing, unerupted, implant. */
  surfaces?: string[] | null
  condition_code?: string | null
  encounter_id?: string | null
  provider_profile_id?: string | null
  notes?: string | null
  /** When the finding was true. Defaults to now; set it for a past visit. */
  observed_at?: string | null
  replaces_event_id?: number | null
  supersession_type?: 'amendment' | 'correction' | 'entered-in-error' | null
  supersession_reason?: string | null
}

/**
 * Every write invalidates the chart at every as-of date and the history.
 *
 * The chart is keyed by date, so a correction to a past finding changes what
 * *every* later view of the chart shows — invalidating only today's would leave
 * a scrubbed-back view showing a finding that has since been withdrawn.
 */
function useChartInvalidation(patientId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['odontogram', 'surfaces', patientId] })
    void qc.invalidateQueries({ queryKey: historyKey(patientId) })
    // The legacy per-tooth read is still what the patient overview uses.
    void qc.invalidateQueries({ queryKey: ['patients', patientId, 'odontogram'] })
  }
}

/** Chart a finding. Append-only: this never modifies an existing event. */
export function useChartToothEvent(patientId: string) {
  const invalidate = useChartInvalidation(patientId)
  return useMutation({
    mutationFn: async (input: ChartEventInput) =>
      (
        await post<{ data: OdontogramEvent }>(
          `/api/patients/${patientId}/odontogram`,
          input,
        )
      ).data,
    onSuccess: invalidate,
  })
}

/**
 * Supersede an existing event.
 *
 * Three kinds, and the difference is clinical rather than technical:
 *
 * - `correction` — the original was wrong; this states the truth. Carries the
 *   corrected finding, so the withdrawal and the replacement are one act.
 * - `amendment` — the original was not wrong; this adds to it.
 * - `entered-in-error` — the entry should never have existed. Carries **no**
 *   condition code (the API refuses one) and **must** carry a reason.
 *
 * The superseded event stays in the history, marked, with a link to this one.
 * That is the point: a finding that was later corrected still explains why a
 * treatment was planned at the time.
 */
export function useSupersedeToothEvent(patientId: string) {
  const invalidate = useChartInvalidation(patientId)
  return useMutation({
    mutationFn: async ({
      replaces,
      kind,
      reason,
      ...input
    }: Omit<ChartEventInput, 'replaces_event_id' | 'supersession_type' | 'supersession_reason'> & {
      replaces: number
      kind: 'correction' | 'amendment' | 'entered-in-error'
      reason?: string
    }) =>
      (
        await post<{ data: OdontogramEvent }>(`/api/patients/${patientId}/odontogram`, {
          ...input,
          replaces_event_id: replaces,
          supersession_type: kind,
          ...(reason ? { supersession_reason: reason } : {}),
          // A retraction asserts nothing about the tooth; the API enforces this
          // with a CHECK, and sending a code would be a 500 rather than a 422.
          ...(kind === 'entered-in-error' ? { condition_code: null } : {}),
        })
      ).data,
    onSuccess: invalidate,
  })
}

/**
 * The dates on which this patient's chart changed.
 *
 * Drives the history scrubber. Derived from the events rather than fetched:
 * every distinct `observed_at` day is a point the chart can be read at, and
 * there is no endpoint for "when did this change" because the history already
 * answers it.
 */
export function chartDates(events: OdontogramEvent[] | undefined): string[] {
  if (!events?.length) return []
  return [...new Set(events.map((e) => e.observed_at.slice(0, 10)))].sort()
}
