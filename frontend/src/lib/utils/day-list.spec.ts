import { describe, expect, it } from "vitest";
import type { Appointment, AppointmentStatus } from "@/types/api";
import { dayKind, planDay } from "./day-list";

const TODAY = "2026-11-03";

let n = 0;
const apt = (time: string, status: AppointmentStatus, date = TODAY): Appointment =>
  ({
    id: `a${++n}`,
    status,
    scheduled_start: `${date}T${time}:00+08:00`,
    scheduled_end: `${date}T${time}:00+08:00`,
  }) as Appointment;

const at = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

describe("dayKind", () => {
  it("names the day relative to today", () => {
    expect(dayKind("2026-11-02", TODAY)).toBe("past");
    expect(dayKind(TODAY, TODAY)).toBe("today");
    expect(dayKind("2026-11-04", TODAY)).toBe("tomorrow");
    expect(dayKind("2026-11-13", TODAY)).toBe("upcoming");
  });
});

describe("planDay — today", () => {
  it("tags late, next and the ones already here, and folds completed away", () => {
    const late = apt("08:30", "scheduled");
    const seated = apt("09:00", "in_chair");
    const done = apt("09:30", "completed");
    const next = apt("14:00", "confirmed");
    const later = apt("15:00", "scheduled");
    const plan = planDay([later, next, done, seated, late], TODAY, TODAY, at("13:00"));

    expect(plan.rows.map((r) => [r.appointment.id, r.tag])).toEqual([
      [late.id, "late"],
      [seated.id, "in_chair"],
      [next.id, "next"],
      [later.id, null],
    ]);
    expect(plan.completed.map((r) => r.appointment.id)).toEqual([done.id]);
  });

  it("leaves cancellations and no-shows off today's list", () => {
    const plan = planDay([apt("10:00", "cancelled"), apt("11:00", "no_show")], TODAY, TODAY, at("09:00"));
    expect(plan.rows).toEqual([]);
    expect(plan.bookedAny).toBe(false);
  });

  it("knows a finished day from an empty one", () => {
    const plan = planDay([apt("09:00", "completed")], TODAY, TODAY, at("17:00"));
    expect(plan.rows).toEqual([]);
    expect(plan.completed).toHaveLength(1);
    expect(plan.bookedAny).toBe(true);
  });
});

describe("planDay — other days", () => {
  it("keeps everything on a past day, with how each booking ended", () => {
    const d = "2026-10-04";
    const plan = planDay([apt("11:00", "no_show", d), apt("09:00", "completed", d), apt("10:00", "cancelled", d)], d, TODAY, 0);
    expect(plan.rows.map((r) => r.tag)).toEqual(["completed", "cancelled", "no_show"]);
  });

  it("lists a future day plainly, without cancellations", () => {
    const d = "2026-11-04";
    const plan = planDay([apt("09:00", "scheduled", d), apt("10:00", "cancelled", d)], d, TODAY, 0);
    expect(plan.kind).toBe("tomorrow");
    expect(plan.rows.map((r) => r.tag)).toEqual([null]);
  });
});
