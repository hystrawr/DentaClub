"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";

export interface DropdownOption {
  value: string;
  label: string;
  /** A small coloured dot before the label, e.g. a dentist's calendar colour. */
  swatch?: string;
}

/**
 * A select whose list is drawn by the page, not the browser, so it opens as the
 * same floating list as the patient search (border, shadow, hover rows) instead
 * of the operating system's menu. It floats over what is below, so opening it
 * never changes the size of the form around it.
 *
 * Keyboard: Enter, Space or ↓ opens; ↑/↓ move; Enter picks; Escape or Tab closes.
 */
export function Dropdown({
  id,
  value,
  onChange,
  options,
  placeholder,
  invalid,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  options: DropdownOption[];
  /** Shown when `value` is "" and offered as the first row, to clear the choice. */
  placeholder: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const rows: DropdownOption[] = [{ value: "", label: placeholder }, ...options];
  const chosen = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    // A field near the bottom of a scrolling modal would open its list out of
    // sight: scroll just enough to show the whole list.
    listRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  function openList() {
    setActive(Math.max(0, rows.findIndex((r) => r.value === value)));
    setOpen(true);
  }

  function pick(next: string) {
    onChange(next);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      // Only the list closes, not the modal it sits in.
      e.stopPropagation();
      setOpen(false);
    } else if (e.key === "Tab") {
      setOpen(false);
    } else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i + (e.key === "ArrowDown" ? 1 : rows.length - 1)) % rows.length);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(rows[active]!.value);
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        id={id}
        type="button"
        className="w-full h-9 rounded-lg pl-3 pr-9 text-sm text-left outline-none field-focus flex items-center gap-2"
        style={{
          background: "var(--color-surface)",
          border: `1px solid ${invalid ? "var(--color-destructive)" : "var(--color-border)"}`,
          color: chosen ? "var(--color-foreground)" : "var(--color-placeholder)",
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onKeyDown}
      >
        {chosen?.swatch && <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: chosen.swatch }} aria-hidden="true" />}
        <span className="truncate">{chosen?.label ?? placeholder}</span>
        <ChevronDown
          size={16}
          className="absolute right-3 top-1/2 transition-transform"
          style={{ color: "var(--color-muted-foreground)", transform: `translateY(-50%)${open ? " rotate(180deg)" : ""}` }}
          aria-hidden="true"
        />
      </button>

      {open && (
        <ul
          ref={listRef}
          id={`${id}-list`}
          role="listbox"
          className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg max-h-56 overflow-y-auto"
          style={{ border: "1px solid var(--color-border)", background: "var(--color-surface)", boxShadow: "var(--shadow-dropdown)" }}
        >
          {rows.map((row, i) => (
            <li
              key={row.value || "none"}
              role="option"
              aria-selected={row.value === value}
              className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer table-row-hover"
              style={{
                background: i === active ? "var(--color-surface-raised)" : undefined,
                color: row.value ? "var(--color-foreground)" : "var(--color-muted-foreground)",
              }}
              onPointerEnter={() => setActive(i)}
              onClick={() => pick(row.value)}
            >
              {row.swatch && <span className="rounded-full shrink-0" style={{ width: 8, height: 8, background: row.swatch }} aria-hidden="true" />}
              <span className="truncate flex-1">{row.label}</span>
              {row.value === value && <Check size={14} style={{ color: "var(--color-primary)" }} aria-hidden="true" />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
