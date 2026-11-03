import { describe, expect, it } from "vitest";
import type { Appointment, AppointmentStatus } from "@/types/api";
import { splitPatientAppointments } from "./patient-appointments";

const TODAY = "2026-11-03";
const apt = (id: string, date: string, status: AppointmentStatus, time = "09:00"): Appointment =>
  ({ id, status, scheduled_start: `${date}T${time}:00+08:00`, scheduled_end: `${date}T${time}:00+08:00` }) as Appointment;

describe("splitPatientAppointments", () => {
  it("lists what is still on from today onwards, soonest first", () => {
    const { upcoming } = splitPatientAppointments(
      [apt("later", "2026-11-20", "scheduled"), apt("today", TODAY, "confirmed", "15:00"), apt("next", "2026-11-05", "scheduled")],
      TODAY,
    );
    expect(upcoming.map((a) => a.id)).toEqual(["today", "next", "later"]);
  });

  it("puts earlier days and today's finished visits in the past, most recent first", () => {
    const { upcoming, past } = splitPatientAppointments(
      [apt("oct", "2026-10-04", "completed"), apt("doneToday", TODAY, "completed"), apt("noShow", "2026-10-20", "no_show")],
      TODAY,
    );
    expect(upcoming).toEqual([]);
    expect(past.map((a) => a.id)).toEqual(["doneToday", "noShow", "oct"]);
  });

  it("drops a future cancellation from both lists", () => {
    const { upcoming, past } = splitPatientAppointments([apt("x", "2026-11-10", "cancelled")], TODAY);
    expect(upcoming).toEqual([]);
    expect(past).toEqual([]);
  });
});
