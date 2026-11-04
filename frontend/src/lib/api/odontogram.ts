import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { get, post } from './client'

/**
 * The tooth chart API. `useToothChart` reads the chart as it stands (per
 * surface), `useToothHistory` reads every event including corrected and
 * withdrawn ones, and both accept `asOf` for a past date. Writes only ever
 * append: a correction is a new event naming the one it replaces.
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

/** The chart as it stands now, or on the date `asOf`, one finding per surface. */
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

/** Every event ever charted for the patient, oldest first. */
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

/** A write refreshes the chart at every date (a correction changes past views too) and the history. */
function useChartInvalidation(patientId: string) {
  const qc = useQueryClient()
  return () => {
    void qc.invalidateQueries({ queryKey: ['odontogram', 'surfaces', patientId] })
    void qc.invalidateQueries({ queryKey: historyKey(patientId) })
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
 * Replace an existing event: a `correction` states the right finding, and
 * `entered-in-error` withdraws it (no code, a reason required). The old event
 * stays in the history, marked.
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
          // A withdrawal never carries a finding (the database refuses one).
          ...(kind === 'entered-in-error' ? { condition_code: null } : {}),
        })
      ).data,
    onSuccess: invalidate,
  })
}

/** The days this patient's chart changed, for the history scrubber (worked out from the events). */
export function chartDates(events: OdontogramEvent[] | undefined): string[] {
  if (!events?.length) return []
  return [...new Set(events.map((e) => e.observed_at.slice(0, 10)))].sort()
}
