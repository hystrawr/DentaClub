"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { Search, User, X } from "lucide-react";
import { usePatients } from "@/lib/api/patients";

// Ported from DentalOS components/frontdesk/PatientSearch: a debounced
// typeahead with keyboard navigation that routes to the chosen patient.

interface PatientResult {
  id: string;
  name: string;
  mobile: string | null;
}

interface PatientSearchProps {
  onSelect?: (patient: PatientResult) => void;
  placeholder?: string;
  className?: string;
}

function useDebounce<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function PatientSearch({ onSelect, placeholder = "Search by name or phone…", className }: PatientSearchProps) {
  const [query, setQuery] = useState("");
  const [dismissed, setDismissed] = useState(false);
  const [focused, setFocused] = useState(-1);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query, 250);
  const listId = useId();
  const active = debouncedQuery.trim().length >= 2;

  const { data, isFetching } = usePatients({ search: debouncedQuery.trim() }, { enabled: active });

  const results: PatientResult[] = (active ? (data ?? []) : []).map((p) => ({
    id: p.id,
    name: p.full_name,
    mobile: p.mobile,
  }));

  // Derived rather than synced in an effect: open while there is a live query,
  // unless the user dismissed it (Escape / outside click) since last typing.
  const open = active && !dismissed && (results.length > 0 || !isFetching);

  function handleSelect(patient: PatientResult) {
    setQuery("");
    setFocused(-1);
    if (onSelect) onSelect(patient);
    else router.push(`/patients/${patient.id}/info` as Route);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setFocused((f) => Math.min(f + 1, results.length - 1));
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setFocused((f) => Math.max(f - 1, 0));
    }
    if (e.key === "Enter" && focused >= 0) {
      const chosen = results[focused];
      if (chosen) handleSelect(chosen);
    }
    if (e.key === "Escape") {
      setDismissed(true);
      setFocused(-1);
    }
  }

  // Close on outside click.
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (!listRef.current?.contains(e.target as Node) && !inputRef.current?.contains(e.target as Node)) {
        setDismissed(true);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div className={`relative ${className ?? ""}`}>
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-full transition-shadow"
        style={{
          background: "var(--color-surface)",
          border: `1px solid ${open ? "var(--color-primary)" : "var(--color-border)"}`,
          boxShadow: open ? "0 0 0 3px rgba(37,99,235,0.12)" : undefined,
        }}
      >
        <Search size={15} style={{ color: "var(--color-subtle-foreground)" }} className="shrink-0" />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setDismissed(false);
            setFocused(-1);
          }}
          onFocus={() => setDismissed(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="flex-1 bg-transparent text-sm outline-none min-w-0"
          style={{ color: "var(--color-foreground)" }}
          aria-label="Search patients"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          role="combobox"
        />
        {isFetching && active && (
          <div
            className="w-3.5 h-3.5 rounded-full border-2 animate-spin shrink-0"
            style={{ borderColor: "var(--color-primary)", borderTopColor: "transparent" }}
            aria-hidden="true"
          />
        )}
        {query && !isFetching && (
          <button
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="rounded-full transition-colors hover:bg-slate-100 p-0.5"
          >
            <X size={13} style={{ color: "var(--color-subtle-foreground)" }} />
          </button>
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          id={listId}
          className="absolute left-0 right-0 mt-1.5 rounded-2xl overflow-hidden z-50"
          style={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            boxShadow: "var(--shadow-dropdown)",
          }}
          role="listbox"
          aria-label="Patient search results"
        >
          {results.map((patient, i) => (
            <div
              key={patient.id}
              className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
              style={{
                background: focused === i ? "var(--color-surface-raised)" : undefined,
                borderTop: i > 0 ? "1px solid var(--color-border)" : undefined,
              }}
              onClick={() => handleSelect(patient)}
              onMouseEnter={() => setFocused(i)}
              role="option"
              aria-selected={focused === i}
            >
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{ width: 32, height: 32, background: "var(--color-primary-light)" }}
                aria-hidden="true"
              >
                <User size={15} style={{ color: "var(--color-primary)" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: "var(--color-foreground)" }}>
                  {patient.name}
                </p>
                {patient.mobile && (
                  <p className="text-xs truncate" style={{ color: "var(--color-muted-foreground)" }}>
                    {patient.mobile}
                  </p>
                )}
              </div>
            </div>
          ))}
          {results.length === 0 && !isFetching && (
            <div className="px-4 py-3 text-xs" style={{ color: "var(--color-muted-foreground)" }}>
              No patients found for &quot;{debouncedQuery}&quot;
            </div>
          )}
        </div>
      )}
    </div>
  );
}
