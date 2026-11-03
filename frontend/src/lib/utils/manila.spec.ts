import { describe, expect, it } from "vitest";
import { addDays, addMinutes, clock, minutesOf, numericDate, timeOf, weekOf, weekdayOf } from "./manila";

describe("manila calendar maths", () => {
  it("builds a Monday-to-Sunday week from any day in it", () => {
    expect(weekOf("2026-10-04")).toEqual([
      "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04",
    ]); // 4 Oct 2026 is a Sunday
    expect(weekOf("2026-10-05")[0]).toBe("2026-10-05"); // a Monday starts its own week
  });

  it("crosses month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("reads clinic time straight off the API timestamp, whatever the browser timezone", () => {
    expect(timeOf("2026-10-05T07:30:00+08:00")).toBe("07:30");
    expect(minutesOf("2026-10-05T07:30:00+08:00")).toBe(450);
  });

  it("formats and adds wall-clock minutes", () => {
    expect(addMinutes("09:45", 45)).toBe("10:30");
    expect(clock("13:05")).toBe("1:05 PM");
    expect(clock("00:15")).toBe("12:15 AM");
    expect(weekdayOf("2026-10-05")).toBe(1);
  });
});

describe("numericDate", () => {
  it("writes a date as month/day/year with leading zeros", () => {
    expect(numericDate("2026-11-13")).toBe("11/13/2026");
    expect(numericDate("2026-01-05")).toBe("01/05/2026");
  });
});
