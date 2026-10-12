import { describe, expect, it } from "vitest";
import { emptyAnswers, MEDICAL_HISTORY, showGroup } from "./medical-history";

describe("MEDICAL_HISTORY", () => {
  it("asks every answer the API stores, once", () => {
    const keys = Object.keys(emptyAnswers());
    expect(keys).toHaveLength(20);
    expect(new Set(keys).size).toBe(keys.length);
    expect(Object.values(emptyAnswers()).every((v) => v === null)).toBe(true);
  });

  it("flags 'No' as the concern only for good health", () => {
    const flagged = MEDICAL_HISTORY.flatMap((g) => g.questions).filter((q) => q.concernIf === false);
    expect(flagged.map((q) => q.key)).toEqual(["in_good_health"]);
  });
});

describe("showGroup", () => {
  const women = MEDICAL_HISTORY.find((g) => g.womenOnly)!;
  const general = MEDICAL_HISTORY[0]!;

  it("always shows general groups", () => {
    expect(showGroup(general, "male", emptyAnswers())).toBe(true);
  });

  it("shows the women's questions for female patients", () => {
    expect(showGroup(women, "female", emptyAnswers())).toBe(true);
    expect(showGroup(women, "male", emptyAnswers())).toBe(false);
  });

  it("never hides an answer that was recorded", () => {
    expect(showGroup(women, "other", { ...emptyAnswers(), bleeder: true })).toBe(true);
  });
});
