import { describe, expect, it } from "vitest";
import { ALLERGENS, allergiesOnFile, CONDITIONS, emptyAnswers, SCREENING, showWomenOnly, toSave } from "./medical-history";

describe("emptyAnswers", () => {
  it("leaves every answer unanswered", () => {
    const answers = emptyAnswers();
    expect(Object.values(answers).every((v) => v === null || (Array.isArray(v) && v.length === 0))).toBe(true);
  });

  it("covers every question asked on the form, once", () => {
    const keys = new Set(Object.keys(emptyAnswers()));
    const asked = [
      ...SCREENING.flatMap((q) => [q.key, ...(q.detail ? [q.detail.key] : [])]),
      ...ALLERGENS.map((a) => a.key),
    ];
    expect(asked.every((k) => keys.has(k))).toBe(true);
    expect(new Set(asked).size).toBe(asked.length);
  });
});

describe("CONDITIONS", () => {
  it("has no repeated code", () => {
    const codes = CONDITIONS.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe("showWomenOnly", () => {
  it("shows the women's questions for female patients", () => {
    expect(showWomenOnly("female", emptyAnswers())).toBe(true);
    expect(showWomenOnly("male", emptyAnswers())).toBe(false);
  });

  it("never hides an answer that was recorded", () => {
    expect(showWomenOnly("other", { ...emptyAnswers(), on_menstruation: true })).toBe(true);
  });
});

describe("toSave", () => {
  it("turns unticked allergies into No and keeps has_allergies in step", () => {
    const saved = toSave({ ...emptyAnswers(), allergic_to_latex: true });
    expect(saved.allergic_to_latex).toBe(true);
    expect(saved.allergic_to_penicillin).toBe(false);
    expect(saved.has_allergies).toBe(true);
  });

  it("counts a written allergy", () => {
    const answers = { ...emptyAnswers(), other_allergies: "Shellfish" };
    expect(allergiesOnFile(answers)).toEqual(["Shellfish"]);
    expect(toSave(answers).has_allergies).toBe(true);
  });

  it("records no allergies as No, not unanswered", () => {
    expect(toSave(emptyAnswers()).has_allergies).toBe(false);
  });
});
