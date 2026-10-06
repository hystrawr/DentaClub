import { describe, expect, it } from "vitest";
import { layoutLanes } from "./ScheduleCalendar";
import type { Appointment } from "@/types/api";

const apt = (id: string, start: string, end: string) =>
  ({ id, scheduled_start: `2026-10-05T${start}:00+08:00`, scheduled_end: `2026-10-05T${end}:00+08:00` }) as Appointment;

describe("layoutLanes", () => {
  it("gives a lone appointment the full width", () => {
    expect(layoutLanes([apt("a", "09:00", "09:45")]).get("a")).toEqual({ lane: 0, lanes: 1 });
  });

  it("puts overlapping appointments side by side", () => {
    const l = layoutLanes([apt("a", "09:00", "09:45"), apt("b", "09:30", "10:30")]);
    expect(l.get("a")).toEqual({ lane: 0, lanes: 2 });
    expect(l.get("b")).toEqual({ lane: 1, lanes: 2 });
  });

  it("does not split back-to-back appointments", () => {
    const l = layoutLanes([apt("a", "09:00", "09:45"), apt("b", "09:45", "10:30")]);
    expect(l.get("b")).toEqual({ lane: 0, lanes: 1 });
  });

  it("reuses a lane once it frees up inside a cluster", () => {
    const l = layoutLanes([apt("long", "09:00", "11:00"), apt("x", "09:00", "09:30"), apt("y", "10:00", "10:30")]);
    expect(l.get("long")).toEqual({ lane: 0, lanes: 2 });
    expect(l.get("x")).toEqual({ lane: 1, lanes: 2 });
    expect(l.get("y")).toEqual({ lane: 1, lanes: 2 });
  });
});
