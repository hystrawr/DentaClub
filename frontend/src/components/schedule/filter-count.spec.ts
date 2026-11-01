import { describe, expect, it } from "vitest";
import { DEFAULT_FILTER, STATUS_GROUPS, selectedCount } from "./AppointmentFilter";

const dentists = ["d1", "d2"];

describe("selectedCount", () => {
  it("counts the ticked dentists and statuses, not the unticked ones", () => {
    // Two dentists ticked, and every status but Cancelled / No-show.
    expect(selectedCount(DEFAULT_FILTER, dentists)).toBe(2 + STATUS_GROUPS.length - 1);
  });

  it("drops a hidden dentist from the count", () => {
    expect(selectedCount({ hiddenProviders: ["d1"], hiddenGroups: [] }, dentists)).toBe(1 + STATUS_GROUPS.length);
  });

  it("is null when everything is ticked, so no badge shows", () => {
    expect(selectedCount({ hiddenProviders: [], hiddenGroups: [] }, dentists)).toBeNull();
  });

  it("ignores a hidden dentist who is no longer listed", () => {
    expect(selectedCount({ hiddenProviders: ["gone"], hiddenGroups: [] }, dentists)).toBeNull();
  });
});
