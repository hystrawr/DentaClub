"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { FormError } from "@/components/ui/form";
import { useAppointmentTypes, useProviders } from "@/lib/api/appointments";
import { useSaveTreatmentRecords } from "@/lib/api/treatment-records";
import { peso, pesos } from "@/lib/utils/money";
import { pricedServices, priceFor } from "@/lib/utils/services";
import type { TreatmentRecord, TreatmentRow } from "@/types/api";
import { ResetDelete, SaveBar } from "./RecordPanel";

/** A row as typed: every cell a string, "" when empty. */
type Cells = Record<keyof TreatmentRow, string>;

const COLUMNS: Array<{
  key: keyof TreatmentRow;
  label: string;
  width: string;
  type?: "date" | "money";
  align?: "left";
}> = [
  { key: "visit_date", label: "Date", width: "11%", type: "date" },
  { key: "teeth", label: "Tooth No./s", width: "10%" },
  { key: "procedure", label: "Procedure", width: "20%", align: "left" },
  { key: "doctor", label: "Doctor", width: "13%" },
  {
    key: "amount_charged",
    label: "Amount Charged",
    width: "11%",
    type: "money",
  },
  { key: "amount_paid", label: "Amount Paid", width: "11%", type: "money" },
  {
    key: "next_appointment",
    label: "Next Appointment",
    width: "12%",
    type: "date",
  },
];

/** Rows to type into below the last one, so the sheet never opens full. */
const BLANK_ROWS = 3;

const blank = (): Cells => ({
  visit_date: "",
  teeth: "",
  procedure: "",
  doctor: "",
  amount_charged: "",
  amount_paid: "",
  next_appointment: "",
});

const cellsFrom = (r: TreatmentRecord): Cells => ({
  visit_date: r.visit_date ?? "",
  teeth: r.teeth ?? "",
  procedure: r.procedure ?? "",
  doctor: r.doctor ?? "",
  amount_charged: r.amount_charged == null ? "" : String(r.amount_charged),
  amount_paid: r.amount_paid == null ? "" : String(r.amount_paid),
  next_appointment: r.next_appointment ?? "",
});

const toRow = (c: Cells): TreatmentRow => ({
  visit_date: c.visit_date || null,
  teeth: c.teeth.trim() || null,
  procedure: c.procedure.trim() || null,
  doctor: c.doctor.trim() || null,
  amount_charged: pesos(c.amount_charged),
  amount_paid: pesos(c.amount_paid),
  next_appointment: c.next_appointment || null,
});

const isBlank = (c: Cells) => Object.values(c).every((v) => v.trim() === "");

/** Each row's balance: charged minus paid, carried down. A row with no amounts has none. */
function runningBalances(rows: Cells[]): Array<number | null> {
  let running = 0;
  return rows.map((r) => {
    const charged = pesos(r.amount_charged);
    const paid = pesos(r.amount_paid);
    if (charged === null && paid === null) return null;
    running += (charged ?? 0) - (paid ?? 0);
    return running;
  });
}

/** The saved rows, plus blank ones to type into. */
const withBlanks = (rows: Cells[]) => [...rows, ...Array.from({ length: BLANK_ROWS }, blank)];

/** What a sheet would save as — blank rows dropped — for comparing against the saved one. */
const fingerprint = (rows: Cells[]) => JSON.stringify(rows.filter((r) => !isBlank(r)).map(toRow));

/**
 * The Treatment Record: a spreadsheet of procedures, every cell editable.
 *
 * Enter and ↑/↓ move between rows as in Excel, and Enter on the last row adds
 * one. Balance carries down from the row above (charged minus paid, running),
 * so it is worked out here and never typed.
 *
 * Doctor suggests the clinic's dentists. Procedure suggests its services; naming one fills an empty Amount
 * Charged with its price. The price is copied into the row, so changing it in
 * Services later never rewrites what a patient was charged.
 */
export function TreatmentSheet({ patientId, records }: { patientId: string; records: TreatmentRecord[] }) {
  const save = useSaveTreatmentRecords(patientId);
  const { data: types = [] } = useAppointmentTypes();
  // The clinic's working dentists, offered in the Doctor cell as services are in Procedure.
  const { data: providers = [] } = useProviders();
  const dentists = providers.filter((p) => p.is_active).sort((a, b) => a.name.localeCompare(b.name));
  const [saved, setSaved] = useState(() => records.map(cellsFrom));
  const [rows, setRows] = useState(() => withBlanks(saved));
  // Which money cell is being typed in: shown raw while focused, as pesos otherwise.
  const [editing, setEditing] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);

  const dirty = fingerprint(rows) !== fingerprint(saved);

  const setCell = (i: number, key: keyof TreatmentRow, value: string) =>
    setRows((rs) =>
      rs.map((r, j) => {
        if (j !== i) return r;
        const next = { ...r, [key]: value };
        // A typed amount is never overwritten, so a discount survives re-picking the service.
        const price = key === "procedure" && r.amount_charged.trim() === "" ? priceFor(value, types) : null;
        return price === null ? next : { ...next, amount_charged: String(price) };
      }),
    );

  async function persist(next: Cells[]) {
    try {
      const fresh = (await save.mutateAsync(next.filter((r) => !isBlank(r)).map(toRow))).map(cellsFrom);
      setSaved(fresh);
      setRows(withBlanks(fresh));
    } catch {
      // Shown under the sheet from the mutation's own error.
    }
  }

  const balances = runningBalances(rows);
  const totalCharged = rows.reduce((sum, r) => sum + (pesos(r.amount_charged) ?? 0), 0);
  const totalPaid = rows.reduce((sum, r) => sum + (pesos(r.amount_paid) ?? 0), 0);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>, row: number, col: number) {
    if (!["Enter", "ArrowDown", "ArrowUp"].includes(e.key)) return;
    // Arrows inside a date field change the date; only Enter leaves it.
    if (e.key !== "Enter" && COLUMNS[col]!.type === "date") return;
    e.preventDefault();
    const next = e.key === "ArrowUp" ? row - 1 : row + 1;
    if (next < 0) return;
    if (next >= rows.length) setRows((rs) => [...rs, blank()]);
    requestAnimationFrame(() => document.getElementById(`cell-${next}-${col}`)?.focus());
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="sheet">
          <thead>
            <tr>
              {COLUMNS.slice(0, 6).map((c) => (
                <th key={c.key} style={{ width: c.width }}>
                  {c.label}
                </th>
              ))}
              <th style={{ width: "10%" }}>Balance</th>
              <th style={{ width: "12%" }}>Next Appointment</th>
              <th aria-label="Row tools" data-print="hide" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {COLUMNS.map((c, col) => {
                  const id = `cell-${i}-${col}`;
                  const money = c.type === "money";
                  const value = money && editing !== id && pesos(r[c.key]) !== null ? peso(pesos(r[c.key])!) : r[c.key];
                  const cell = (
                    <td key={c.key}>
                      <input
                        id={id}
                        type={c.type === "date" ? "date" : "text"}
                        inputMode={money ? "decimal" : undefined}
                        className={money ? "money" : undefined}
                        style={c.align ? { textAlign: c.align } : undefined}
                        value={value}
                        maxLength={c.key === "teeth" ? 50 : 255}
                        list={c.key === "procedure" ? "treatment-services" : c.key === "doctor" ? "treatment-doctors" : undefined}
                        aria-label={`${c.label}, row ${i + 1}`}
                        onFocus={() => money && setEditing(id)}
                        onBlur={() => money && setEditing(null)}
                        onChange={(e) => setCell(i, c.key, money ? e.target.value.replace(/[^\d.,]/g, "") : e.target.value)}
                        onKeyDown={(e) => onKeyDown(e, i, col)}
                      />
                    </td>
                  );
                  // Balance sits between Amount Paid and Next Appointment.
                  return c.key === "next_appointment"
                    ? [
                        <td
                          key="balance"
                          className="text-right font-mono text-xs font-semibold px-2.5"
                          style={{
                            color: (balances[i] ?? 0) > 0 ? "var(--color-destructive)" : undefined,
                          }}
                        >
                          {balances[i] === null ? "" : peso(balances[i]!)}
                        </td>,
                        cell,
                      ]
                    : cell;
                })}
                <td className="text-center" style={{ width: 36 }} data-print="hide">
                  <button
                    type="button"
                    className="rounded-md hover:bg-red-50 hover:text-red-700"
                    style={{
                      width: 28,
                      height: 28,
                      color: "var(--color-subtle-foreground)",
                    }}
                    onClick={() => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : [blank()]))}
                    aria-label={`Delete row ${i + 1}`}
                    title="Delete row"
                  >
                    <X size={14} className="mx-auto" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ textAlign: "left", fontFamily: "var(--font-sans)" }}>
                Totals
              </td>
              <td>{peso(totalCharged)}</td>
              <td>{peso(totalPaid)}</td>
              <td
                style={{
                  color: totalCharged - totalPaid > 0 ? "var(--color-destructive)" : undefined,
                }}
              >
                {peso(totalCharged - totalPaid)}
              </td>
              <td colSpan={2} />
            </tr>
          </tfoot>
        </table>
        <datalist id="treatment-services">
          {pricedServices(types).map((t) => (
            <option key={t.id} value={t.name}>
              {t.price === null ? undefined : peso(t.price)}
            </option>
          ))}
        </datalist>
        <datalist id="treatment-doctors">
          {dentists.map((d) => (
            <option key={d.id} value={d.name} />
          ))}
        </datalist>
      </div>

      <div
        className="flex items-center justify-end gap-3 flex-wrap px-4 sm:px-6 py-3 text-xs"
        style={{ color: "var(--color-muted-foreground)" }}
        data-print="hide"
      >
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setRows((rs) => [...rs, blank()])}>
          + Add row
        </button>
      </div>

      <SaveBar
        dirty={dirty}
        saving={save.isPending}
        onSave={() => void persist(rows)}
        error={<FormError error={save.error} />}
        tools={
          <ResetDelete
            onReset={() => {
              setRows(withBlanks(saved));
              save.reset();
            }}
            resetDisabled={!dirty}
            onDelete={() => {
              setClearing(true);
              void persist([]).finally(() => setClearing(false));
            }}
            confirmText="Delete every treatment row?"
            deleting={clearing}
          />
        }
      />
    </>
  );
}
