import { describe, expect, it } from "vitest";
import type { AppointmentType } from "@/types/api";
import { pricedServices, priceFor } from "./services";

const service = (over: Partial<AppointmentType>): AppointmentType => ({
  id: "t1",
  name: "Cleaning",
  duration_minutes: 30,
  color_hex: "#6B7280",
  is_block_time: false,
  recall_interval_months: null,
  price: 800,
  is_active: true,
  ...over,
});

describe("pricedServices", () => {
  it("offers active services, sorted by name", () => {
    const list = pricedServices([service({ id: "a", name: "Extraction" }), service({ id: "b", name: "Cleaning" })]);
    expect(list.map((s) => s.name)).toEqual(["Cleaning", "Extraction"]);
  });

  it("leaves out inactive services and block time", () => {
    const list = pricedServices([
      service({ id: "a", is_active: false }),
      service({ id: "b", name: "Lunch", is_block_time: true, price: null }),
      service({ id: "c", name: "Filling" }),
    ]);
    expect(list.map((s) => s.name)).toEqual(["Filling"]);
  });
});

describe("priceFor", () => {
  const services = [service({ name: "Cleaning", price: 800 }), service({ id: "t2", name: "Root Canal", price: null })];

  it("finds a service's price by its exact name, ignoring case and spaces", () => {
    expect(priceFor("  cleaning ", services)).toBe(800);
  });

  it("has no price for a procedure that only starts like a service", () => {
    expect(priceFor("Clean", services)).toBeNull();
  });

  it("has no price for a service that has none set", () => {
    expect(priceFor("Root Canal", services)).toBeNull();
  });

  it("has no price for an inactive service", () => {
    expect(priceFor("Cleaning", [service({ is_active: false })])).toBeNull();
  });
});
