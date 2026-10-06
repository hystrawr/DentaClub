import { Router } from "express";
import { z } from "zod";
import {
  CONDITION_CODES,
  ODONTOGRAM_EVENT_TYPES,
  SUPERSESSION_TYPES,
  SURFACES,
} from "../lib/chart.js";
import { HttpError } from "../lib/http-error.js";
import { odontogramEventResource } from "../lib/serialize.js";
import * as odontogram from "../services/odontogram.js";

// Mounted at /api/patients/:id/odontogram. `mergeParams` lets us read that :id.
export const odontogramRouter = Router({ mergeParams: true });

const eventInput = z
  .object({
    // FDI notation — the service rejects numbers that are not a tooth with a 422.
    tooth_number: z.coerce.number().int(),
    event_type: z.enum(ODONTOGRAM_EVENT_TYPES),
    /** Omit for a whole-tooth finding — missing, unerupted, implant. */
    surfaces: z.array(z.enum(SURFACES)).nullish(),
    condition_code: z.enum(CONDITION_CODES).nullish(),
    /** The event this one supersedes. Points new → old. */
    replaces_event_id: z.coerce.number().int().positive().nullish(),
    supersession_type: z.enum(SUPERSESSION_TYPES).nullish(),
    /** Required when superseding as entered-in-error. */
    supersession_reason: z.string().max(500).nullish(),
    /** When the finding was true. Defaults to now; set it when charting a past visit. */
    observed_at: z.union([z.iso.datetime({ offset: true }), z.iso.date()]).nullish(),
    notes: z.string().max(500).nullish(),
  })
  // The same rules as the database CHECKs, checked first so the client gets a
  // readable 400 instead of a database error.
  .refine((d) => (d.replaces_event_id == null) === (d.supersession_type == null), {
    message: "replaces_event_id and supersession_type must be sent together",
    path: ["supersession_type"],
  })
  .refine((d) => d.supersession_type !== "entered-in-error" || d.condition_code == null, {
    message: "An entered-in-error retraction cannot carry a condition code",
    path: ["condition_code"],
  });

/** `?as_of=2026-09-01` reads the chart as it stood on that date. */
function parseAsOf(value: unknown): Date | undefined {
  if (typeof value !== "string" || value === "") return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new HttpError(400, "as_of must be a valid date");
  return date;
}

const patientIdOf = (params: unknown) => (params as { id: string }).id;

/**
 * GET /api/patients/:id/odontogram/surfaces
 * Current charted state, keyed by tooth then surface (`*` = whole tooth).
 * This is what the chart component renders.
 */
odontogramRouter.get("/surfaces", async (req, res) => {
  const patientId = patientIdOf(req.params);
  const [state, inverse] = await Promise.all([
    odontogram.surfaceState(patientId, parseAsOf(req.query.as_of)),
    odontogram.supersededBy(patientId),
  ]);

  res.json({
    data: Object.fromEntries(
      Object.entries(state).map(([tooth, surfaces]) => [
        tooth,
        Object.fromEntries(
          Object.entries(surfaces).map(([surface, event]) => [
            surface,
            odontogramEventResource(event, inverse.get(String(event.id)) ?? []),
          ]),
        ),
      ]),
    ),
  });
});

/**
 * GET /api/patients/:id/odontogram/history
 * Every event ever charted, oldest first. Superseded and retracted entries are
 * included — and that is the point: the graphic drops a withdrawn finding, the
 * history keeps it, marked, with what replaced it.
 */
odontogramRouter.get("/history", async (req, res) => {
  const patientId = patientIdOf(req.params);
  const [rows, inverse] = await Promise.all([
    odontogram.history(patientId),
    odontogram.supersededBy(patientId),
  ]);

  res.json({
    data: rows.map((row) => odontogramEventResource(row, inverse.get(String(row.id)) ?? [])),
  });
});

/**
 * POST /api/patients/:id/odontogram
 * Append an event — the chart is never edited in place.
 */
odontogramRouter.post("/", async (req, res) => {
  const dto = eventInput.parse(req.body);
  const event = await odontogram.append(patientIdOf(req.params), dto);
  res.status(201).json({ data: odontogramEventResource(event) });
});
