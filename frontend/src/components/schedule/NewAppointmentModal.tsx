"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useAppointmentTypes, useCreateAppointment, useOperatories, useProviders, useSlots } from "@/lib/api/appointments";
import { usePatients } from "@/lib/api/patients";
import { Dropdown } from "@/components/ui/Dropdown";
import { FormError } from "@/components/ui/form";
import { addMinutes, clock, manilaMinutes, manilaTimestamp, manilaToday } from "@/lib/utils/manila";

/**
 * Book an appointment (from DentalOS's NewAppointmentModal).
 *
 * Added to DentalOS's form: the appointment type (which sets the length), the
 * chair (without it every appointment lands under "Unassigned" on the queue
 * board), and a free-slot picker driven by the dentist's weekly hours. Times
 * are sent with Manila's `+08:00` offset — DentalOS sent them bare, leaving the
 * timezone to whichever machine parsed them.
 *
 * Render it with a fresh `key` each time it opens, so a new booking never
 * starts with the last one's answers.
 */
export function NewAppointmentModal({
  onClose,
  defaultDate,
  defaultStartTime,
  defaultEndTime,
  defaultPatient,
}: {
  onClose: () => void;
  defaultDate?: string;
  defaultStartTime?: string;
  defaultEndTime?: string;
  defaultPatient?: { id: string; name: string };
}) {
  const create = useCreateAppointment();
  const { data: providers = [] } = useProviders();
  const { data: types = [] } = useAppointmentTypes();
  const { data: chairs = [] } = useOperatories();

  const [patientSearch, setPatientSearch] = useState(defaultPatient?.name ?? "");
  const [patientId, setPatientId] = useState(defaultPatient?.id ?? "");
  const [typeId, setTypeId] = useState("");
  const [providerId, setProviderId] = useState("");
  const [chairId, setChairId] = useState("");
  const [date, setDate] = useState(defaultDate ?? manilaToday());
  const [startTime, setStartTime] = useState(defaultStartTime ?? "09:00");
  const [endTime, setEndTime] = useState(defaultEndTime ?? "09:30");
  const [notes, setNotes] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const patients = usePatients({ search: patientSearch.trim() }, { enabled: patientSearch.trim().length >= 2 && !patientId });
  const activeProviders = providers.filter((p) => p.is_active);
  const activeTypes = types.filter((t) => t.is_active);
  const type = activeTypes.find((t) => t.id === typeId);
  const blockTime = Boolean(type?.is_block_time);
  const duration = type?.duration_minutes ?? null;

  // Free slots: the dentist's 15-minute free steps, kept only where the whole
  // appointment fits — a 45-minute cleaning needs three free steps in a row.
  const slots = useSlots(providerId || undefined, date || undefined, 15);
  const freeSteps = (slots.data ?? []).map((s) => s.start);
  const free = new Set(freeSteps);
  const stepsNeeded = Math.max(1, Math.ceil((duration ?? 30) / 15));
  // Today's steps that have already gone by are not offered.
  const nowClock = addMinutes("00:00", manilaMinutes());
  const fitting = freeSteps.filter(
    (start) =>
      !(date === manilaToday() && start < nowClock) &&
      Array.from({ length: stepsNeeded }, (_, i) => addMinutes(start, i * 15)).every((t) => free.has(t)),
  );

  function chooseType(id: string) {
    setTypeId(id);
    const chosen = activeTypes.find((t) => t.id === id);
    if (chosen) setEndTime(addMinutes(startTime, chosen.duration_minutes));
  }

  function chooseStart(value: string) {
    setStartTime(value);
    setEndTime(addMinutes(value, duration ?? 30));
  }

  const today = manilaToday();
  const endBeforeStart = endTime <= startTime;
  // Same 15-minute grace as the API, so a walk-in entered a little late still books.
  const [startH = 0, startM = 0] = startTime.split(":").map(Number);
  const startInPast = date < today || (date === today && startH * 60 + startM < manilaMinutes() - 15);
  const errors = {
    patient: submitted && !patientId && !blockTime ? "Please select a patient." : undefined,
    provider: submitted && !providerId ? "Please select a dentist." : undefined,
    date: submitted && !date ? "Please select a date." : submitted && date < today ? "The date has already passed." : undefined,
    startTime: submitted && date === today && startInPast ? "This time has already passed." : undefined,
    endTime: submitted && endBeforeStart ? "End time must be after start time." : undefined,
  };

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    if ((!patientId && !blockTime) || !providerId || !date || startInPast || endBeforeStart) return;

    create.mutate(
      {
        patient_id: patientId || null,
        provider_profile_id: providerId,
        appointment_type_id: typeId || null,
        operatory_id: chairId || null,
        scheduled_start: manilaTimestamp(date, startTime),
        scheduled_end: manilaTimestamp(date, endTime),
        notes: notes.trim() || null,
      },
      { onSuccess: onClose },
    );
  }

  const control = "w-full h-9 rounded-lg px-3 text-sm outline-none field-focus";
  const controlStyle = (invalid?: boolean) => ({
    background: "var(--color-surface)",
    border: `1px solid ${invalid ? "var(--color-destructive)" : "var(--color-border)"}`,
  });

  return (
    <>
      <div className="fixed inset-0 z-40" style={{ background: "rgba(0,0,0,0.35)" }} onClick={onClose} aria-hidden="true" />

      <div role="dialog" aria-modal="true" aria-label="New Appointment" className="fixed z-50 inset-0 flex items-center justify-center p-4 pointer-events-none">
        {/* A fixed height, so the free-time list or the patient matches never make the modal grow or shrink. */}
        <div className="card-premium w-full max-w-lg pointer-events-auto" style={{ height: "min(640px, 92vh)", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: "1px solid var(--color-border)" }}>
            <h2 className="text-sm font-semibold" style={{ color: "var(--color-foreground)" }}>
              New Appointment
            </h2>
            <button onClick={onClose} className="btn-ghost p-1 rounded-md" aria-label="Close">
              <X size={16} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0" noValidate>
            {/* Only the fields scroll (.modal-body); the title above and the buttons below stay put. */}
            <div className="modal-body px-5 py-4 space-y-4">
              {/* Who it is for first, then what: the type still sets the length, and block time (lunch) makes the patient optional. */}
              <Labelled label="Patient" htmlFor="patient-search" required={!blockTime} error={errors.patient}>
                <div className="relative">
                  <input
                    id="patient-search"
                    className={control}
                    style={controlStyle(Boolean(errors.patient))}
                    placeholder={blockTime ? "Not needed for blocked time" : "Search by name…"}
                    value={patientSearch}
                    onChange={(e) => {
                      setPatientSearch(e.target.value);
                      setPatientId("");
                    }}
                    autoComplete="off"
                  />
                  {/* Floats over the fields below instead of pushing them down. */}
                  {(patients.data?.length ?? 0) > 0 && patientSearch && !patientId && (
                    <ul className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg max-h-56 overflow-y-auto" style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", boxShadow: "var(--shadow-dropdown)" }}>
                      {patients.data!.slice(0, 6).map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm table-row-hover"
                            onClick={() => {
                              setPatientId(p.id);
                              setPatientSearch(p.full_name);
                            }}
                          >
                            {p.full_name}
                            <span className="text-xs ml-2" style={{ color: "var(--color-muted-foreground)" }}>
                              {p.date_of_birth}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </Labelled>

              <Labelled label="Appointment type" htmlFor="appt-type">
                <Dropdown
                  id="appt-type"
                  value={typeId}
                  onChange={chooseType}
                  placeholder="— Select type —"
                  options={activeTypes.map((t) => ({
                    value: t.id,
                    label: `${t.name} · ${t.duration_minutes} min${t.is_block_time ? " (blocked time)" : ""}`,
                  }))}
                />
              </Labelled>

              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Dentist" htmlFor="appt-provider" required error={errors.provider}>
                  <Dropdown
                    id="appt-provider"
                    value={providerId}
                    onChange={setProviderId}
                    placeholder="— Select dentist —"
                    invalid={Boolean(errors.provider)}
                    options={activeProviders.map((p) => ({ value: p.id, label: p.name, swatch: p.color_hex ?? undefined }))}
                  />
                </Labelled>
                <Labelled label="Chair" htmlFor="appt-chair">
                  <Dropdown
                    id="appt-chair"
                    value={chairId}
                    onChange={setChairId}
                    placeholder="Unassigned"
                    options={chairs.map((c) => ({ value: c.id, label: c.name }))}
                  />
                </Labelled>
              </div>

              <Labelled label="Date" htmlFor="appt-date" required error={errors.date}>
                <input id="appt-date" type="date" min={today} className={control} style={controlStyle(Boolean(errors.date))} value={date} onChange={(e) => setDate(e.target.value)} />
              </Labelled>

              {/* Free slots for the chosen dentist and date. */}
              {providerId && date && (
                <div>
                  <p className="text-xs font-medium mb-1.5" style={{ color: "var(--color-foreground)" }}>
                    Free times {duration ? `for ${duration} min` : ""}
                  </p>
                  {slots.isLoading ? (
                    <div className="skeleton" style={{ height: 30 }} />
                  ) : fitting.length === 0 ? (
                    <p className="text-xs" style={{ color: "var(--color-subtle-foreground)" }}>
                      {slots.data?.length ? "No gap long enough on this day." : "This dentist has no working hours on this day."} You can still enter a time below.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto" role="listbox" aria-label="Free start times">
                      {fitting.map((start) => (
                        <button
                          key={start}
                          type="button"
                          role="option"
                          aria-selected={startTime === start}
                          onClick={() => chooseStart(start)}
                          className="text-xs font-semibold rounded-full px-2.5 py-1"
                          style={{
                            border: `1px solid ${startTime === start ? "var(--color-primary)" : "var(--color-border)"}`,
                            background: startTime === start ? "var(--color-primary)" : "var(--color-surface)",
                            color: startTime === start ? "#fff" : "var(--color-foreground)",
                          }}
                        >
                          {clock(start)}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <Labelled label="Start" htmlFor="start-time" required error={errors.startTime}>
                  <input id="start-time" type="time" step={300} className={control} style={controlStyle(Boolean(errors.startTime))} value={startTime} onChange={(e) => chooseStart(e.target.value)} />
                </Labelled>
                <Labelled label="End" htmlFor="end-time" required error={errors.endTime}>
                  <input id="end-time" type="time" step={300} className={control} style={controlStyle(Boolean(errors.endTime))} value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </Labelled>
              </div>

              <Labelled label="Notes" htmlFor="appt-notes">
                <textarea
                  id="appt-notes"
                  rows={2}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none field-focus"
                  style={{ ...controlStyle(), resize: "vertical" }}
                  placeholder="Optional notes…"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </Labelled>
            </div>

            <div className="shrink-0 px-5 py-3 space-y-2" style={{ borderTop: "1px solid var(--color-border)" }}>
              <FormError error={create.error} />
              <div className="flex gap-3">
                <button type="submit" className="btn-gradient flex-1 py-2 text-sm font-semibold" disabled={create.isPending}>
                  {create.isPending ? "Booking…" : "Book Appointment"}
                </button>
                <button type="button" className="btn-ghost px-4 text-sm" onClick={onClose}>
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}

function Labelled({
  label,
  htmlFor,
  required,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium block mb-1" htmlFor={htmlFor} style={{ color: "var(--color-foreground)" }}>
        {label}
        {required && (
          <span className="ml-0.5" style={{ color: "var(--color-destructive)" }} aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs" style={{ color: "var(--color-destructive)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
