"use client";

import { useState } from "react";
import { useSaveAppointmentType } from "@/lib/api/appointments";
import { pesos } from "@/lib/utils/money";
import type { AppointmentType } from "@/types/api";
import { Field, FormDialog, TextField } from "@/components/ui/form";

const formFrom = (t: AppointmentType | null) => ({
  name: t?.name ?? "",
  price: t?.price == null ? "" : String(t.price),
  duration_minutes: String(t?.duration_minutes ?? 30),
  color_hex: t?.color_hex ?? "#6B7530",
  is_block_time: t?.is_block_time ?? false,
});

/**
 * Add a service, or change one (`service` set). Mount it with a `key` per
 * service so the form starts from that service's values each time it opens.
 */
export function ServiceModal({
  open,
  service,
  onClose,
}: {
  open: boolean;
  service: AppointmentType | null;
  onClose: () => void;
}) {
  const save = useSaveAppointmentType();
  const [form, setForm] = useState(() => formFrom(service));

  const set = (key: "name" | "price" | "duration_minutes" | "color_hex") => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  function handleClose() {
    save.reset();
    onClose();
  }

  function handleSubmit() {
    save.mutate(
      {
        id: service?.id,
        name: form.name.trim(),
        // Block time is never charged, so it keeps no price.
        price: form.is_block_time ? null : pesos(form.price),
        duration_minutes: Number(form.duration_minutes),
        color_hex: form.color_hex,
        is_block_time: form.is_block_time,
      },
      { onSuccess: handleClose },
    );
  }

  const duration = Number(form.duration_minutes);
  const incomplete = !form.name.trim() || !Number.isInteger(duration) || duration < 5;

  return (
    <FormDialog
      open={open}
      title={service ? "Edit Service" : "New Service"}
      onClose={handleClose}
      onSubmit={handleSubmit}
      submitLabel={service ? "Save" : "Add Service"}
      submitting={save.isPending}
      disabled={incomplete}
      error={save.error}
    >
      <Field label="Name">
        <TextField required value={form.name} onChange={set("name")} maxLength={255} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Price (₱)" hint={form.is_block_time ? "Block time has no price." : "Leave empty for no set price."}>
          <TextField
            inputMode="decimal"
            placeholder="0.00"
            disabled={form.is_block_time}
            value={form.is_block_time ? "" : form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value.replace(/[^\d.,]/g, "") }))}
          />
        </Field>
        <Field label="Length (minutes)">
          <TextField type="number" required min={5} step={5} value={form.duration_minutes} onChange={set("duration_minutes")} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Calendar colour">
          <TextField type="color" value={form.color_hex} onChange={set("color_hex")} />
        </Field>
        <label className="flex items-center gap-2 text-sm self-end h-9" style={{ color: "var(--color-foreground)" }}>
          <input
            type="checkbox"
            checked={form.is_block_time}
            onChange={(e) => setForm((f) => ({ ...f, is_block_time: e.target.checked }))}
          />
          Block time (no patient)
        </label>
      </div>
    </FormDialog>
  );
}
