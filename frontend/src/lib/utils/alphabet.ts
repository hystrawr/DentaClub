import type { PatientSummary } from "@/types/api";

export const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

/** Where a name that does not start with A–Z (a digit, a stray symbol) is filed. */
export const OTHER = "#";

/**
 * The directory letter for a last name.
 *
 * Accents are stripped first, so "Ñañez" files under N and "Ábalos" under A —
 * which is where a Filipino front desk looks for them — rather than under "#".
 */
function letterOf(lastName: string): string {
  const first = lastName.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").charAt(0).toUpperCase();
  return LETTERS.includes(first) ? first : OTHER;
}

/**
 * Patients grouped by the first letter of their last name, in A–Z order.
 * The API already returns them sorted by last name then first name, so each
 * group keeps that order.
 */
export function groupByLetter(patients: PatientSummary[]): Array<{ letter: string; patients: PatientSummary[] }> {
  const groups = new Map<string, PatientSummary[]>();
  for (const patient of patients) {
    const letter = letterOf(patient.last_name);
    const list = groups.get(letter) ?? [];
    list.push(patient);
    groups.set(letter, list);
  }

  return [...LETTERS, OTHER].flatMap((letter) => {
    const list = groups.get(letter);
    return list ? [{ letter, patients: list }] : [];
  });
}

/** "Dela Cruz, Juan Santos" — the directory reads surname first. */
export function directoryName(p: PatientSummary): string {
  const rest = p.full_name.replace(new RegExp(`\\s*${escapeRegExp(p.last_name)}$`), "").trim();
  return rest ? `${p.last_name}, ${rest}` : p.last_name;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function initials(name: string | undefined): string {
  if (!name) return "··";
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "··"
  );
}
