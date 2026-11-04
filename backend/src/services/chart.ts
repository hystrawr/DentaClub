/**
 * Dental chart vocabulary.
 *
 * FDI tooth numbers: first digit = quadrant, second = position from the midline.
 *   Adults:   11–18, 21–28, 31–38, 41–48
 *   Children: 51–55, 61–65, 71–75, 81–85
 */
const VALID_FDI = new Set<number>();
for (const quadrant of [1, 2, 3, 4]) {
  for (let tooth = 1; tooth <= 8; tooth++) VALID_FDI.add(quadrant * 10 + tooth);
}
for (const quadrant of [5, 6, 7, 8]) {
  for (let tooth = 1; tooth <= 5; tooth++) VALID_FDI.add(quadrant * 10 + tooth);
}

export const isValidFdi = (toothNumber: number): boolean => VALID_FDI.has(toothNumber);

/** M = mesial, D = distal, O = occlusal, B = buccal, L = lingual, I = incisal. */
export const SURFACES = ["M", "D", "O", "B", "L", "I"] as const;

export const ODONTOGRAM_EVENT_TYPES = ["condition", "procedure", "treatment"] as const;

export const SUPERSESSION_TYPES = ["amendment", "correction", "entered-in-error"] as const;

/** The Philippine Dental Association chart legend. */
export const CONDITION_CODES = [
  // Conditions
  "caries", "watch", "missing", "missing_other", "impacted", "unerupted",
  "root_fragment", "supernumerary",
  // Restorations and prosthetics
  "amalgam", "restoration", "inlay", "sealant", "crown", "root_canal",
  "implant", "pontic", "abutment", "removable_denture",
  // Surgery
  "extraction", "extraction_other",
] as const;

/**
 * What may still be charted on a tooth, given what the tooth *is* — its
 * foundation: its latest standing missing, extraction, implant, pontic or
 * denture finding (see `foundationOf` in services/odontogram.ts). Kept in step
 * with the frontend's `lib/odontogram/tooth-rules.ts`.
 *
 * A missing or extracted tooth only takes what replaces it (an implant, a
 * bridge's pontic, a removable denture); a denture or a pontic takes nothing
 * further; an implant has no natural tooth, so only a crown or an abutment.
 */
const ABSENT_CODES = ["missing", "missing_other", "extraction", "extraction_other"];
export const FOUNDATION_CODES = [...ABSENT_CODES, "implant", "pontic", "removable_denture"];

export function allowedFindings(foundation: string | null | undefined): string[] | null {
  if (!foundation) return null;
  if (ABSENT_CODES.includes(foundation)) return ["implant", "pontic", "removable_denture"];
  if (foundation === "implant") return ["crown", "abutment"];
  if (foundation === "removable_denture" || foundation === "pontic") return [];
  return null;
}

/** Why `code` cannot be charted on a tooth with this foundation, or null when it can. */
export function chartingRefusal(toothNumber: number, foundation: string | null | undefined, code: string): string | null {
  const allowed = allowedFindings(foundation);
  if (allowed === null || allowed.includes(code)) return null;
  if (foundation === "removable_denture") return `Tooth ${toothNumber} has a removable denture, so nothing more can be charted on it.`;
  if (foundation === "pontic") return `Tooth ${toothNumber} is a pontic (a bridge's false tooth), so nothing more can be charted on it.`;
  if (foundation === "implant") return `Tooth ${toothNumber} has an implant, so only a jacket crown or an abutment can be charted on it.`;
  return `Tooth ${toothNumber} is missing, so only an implant, a pontic or a removable denture can be charted on it.`;
}
