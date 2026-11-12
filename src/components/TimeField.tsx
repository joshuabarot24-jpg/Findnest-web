"use client";

import { useState } from "react";
import { timeBounds, timeAllowed } from "@/lib/reportTime";

function label(v: string) {
  const [h, m] = v.split(":").map(Number);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// A time box for any minute from 6:00 AM to 7:00 PM. It stays disabled until the date is chosen.
export default function TimeField({ date, value, onChange, className }: { date: string; value: string; onChange: (v: string) => void; className: string }) {
  const [error, setError] = useState("");
  const b = timeBounds(date);
  const disabled = !date || b.empty;

  return (
    <>
      <input
        type="time"
        value={value}
        min={b.min}
        max={b.max}
        disabled={disabled}
        onChange={(e) => {
          const v = e.target.value;
          if (!v) { setError(""); onChange(""); return; }
          if (timeAllowed(date, v)) { setError(""); onChange(v); }
          else { onChange(""); setError(`Choose a time between 6:00 AM and ${label(b.max)}.`); }
        }}
        className={`${className} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
      />
      {!date && <p className="text-xs text-gray-400 font-medium mt-1">Choose the date first.</p>}
      {date && b.empty && <p className="text-xs text-red-500 font-medium mt-1">No time is available yet today. Choose an earlier date.</p>}
      {error && <p className="text-xs text-red-500 font-medium mt-1">{error}</p>}
    </>
  );
}