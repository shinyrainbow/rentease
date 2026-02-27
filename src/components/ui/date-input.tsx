"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { CalendarDays } from "lucide-react";

interface DateInputProps {
  value: string; // yyyy-mm-dd
  onChange: (value: string) => void;
  className?: string;
  required?: boolean;
  disabled?: boolean;
}

/**
 * Date input that displays dd/mm/yyyy format.
 * Stores/returns value in yyyy-mm-dd format for compatibility with existing form state.
 * Includes a hidden native date picker triggered by calendar icon.
 */
export function DateInput({ value, onChange, className, required, disabled }: DateInputProps) {
  const hiddenDateRef = React.useRef<HTMLInputElement>(null);

  // Convert yyyy-mm-dd → dd/mm/yyyy for display
  const toDisplay = (iso: string): string => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  };

  // Convert dd/mm/yyyy → yyyy-mm-dd for storage
  const toIso = (display: string): string => {
    const parts = display.split("/");
    if (parts.length !== 3) return "";
    const [d, m, y] = parts;
    if (!d || !m || !y || y.length !== 4) return "";
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  };

  const [displayValue, setDisplayValue] = React.useState(() => toDisplay(value));

  // Sync display when external value changes
  React.useEffect(() => {
    setDisplayValue(toDisplay(value));
  }, [value]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/[^0-9/]/g, "");

    // Auto-insert slashes
    const digits = raw.replace(/\//g, "");
    if (digits.length >= 4 && !raw.includes("/")) {
      // User pasted or typed digits without slashes
      raw = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
    } else if (digits.length >= 2 && raw.length === 2 && !raw.includes("/")) {
      raw = raw + "/";
    } else if (raw.replace(/\//g, "").length >= 4 && raw.split("/").length === 2 && raw.endsWith(raw.replace(/\//g, "").slice(2))) {
      const p = raw.split("/");
      if (p[1] && p[1].length === 2) {
        raw = raw + "/";
      }
    }

    setDisplayValue(raw);

    // Only update parent if we have a complete date
    if (raw.length === 10 && raw.split("/").length === 3) {
      const iso = toIso(raw);
      if (iso && iso.length === 10) {
        onChange(iso);
      }
    } else if (raw === "") {
      onChange("");
    }
  };

  const handleNativeDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const iso = e.target.value; // yyyy-mm-dd
    onChange(iso);
    setDisplayValue(toDisplay(iso));
  };

  return (
    <div className="relative">
      <input
        type="text"
        inputMode="numeric"
        placeholder="dd/mm/yyyy"
        maxLength={10}
        value={displayValue}
        onChange={handleTextChange}
        required={required}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 pr-9 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={() => hiddenDateRef.current?.showPicker()}
      >
        <CalendarDays className="h-4 w-4" />
      </button>
      <input
        ref={hiddenDateRef}
        type="date"
        value={value}
        onChange={handleNativeDateChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden
      />
    </div>
  );
}
