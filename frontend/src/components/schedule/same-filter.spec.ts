import { describe, expect, it } from "vitest";
import { sameFilter } from "./AppointmentFilter";

describe("sameFilter", () => {
  it("treats the same ticks in a different order as no change", () => {
    expect(sameFilter({ hiddenProviders: ["a", "b"], hiddenGroups: [] }, { hiddenProviders: ["b", "a"], hiddenGroups: [] })).toBe(true);
  });

  it("sees an unticked box as a change", () => {
    expect(sameFilter({ hiddenProviders: [], hiddenGroups: [] }, { hiddenProviders: [], hiddenGroups: ["done"] })).toBe(false);
  });

  it("compares plain values too, like the patient list's current / removed choice", () => {
    expect(sameFilter({ status: "active", hiddenProviders: [] }, { status: "inactive", hiddenProviders: [] })).toBe(false);
    expect(sameFilter({ status: "active", hiddenProviders: [] }, { status: "active", hiddenProviders: [] })).toBe(true);
  });
});
