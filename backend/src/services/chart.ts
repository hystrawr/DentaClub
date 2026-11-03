/**
 * Dental chart vocabulary — copied from DentalOS so both systems agree.
 *
 * FDI tooth numbers: first digit = quadrant, second = position from the midline.
 *   Adults:   11–18, 21–28, 31–38, 41–48
 *   Children: 51–55, 61–65, 71–75, 81–85
 * Anything else (19, 49, 56, 0…) is a typo, not a tooth.
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

/** FHIR's vocabulary, verbatim — `observation-status` / `diagnostic-report-status`. */
export const SUPERSESSION_TYPES = ["amendment", "correction", "entered-in-error"] as const;

/** The Philippine Dental Association chart legend, same codes as DentalOS. */
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
