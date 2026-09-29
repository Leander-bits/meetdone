"use client";
import { Clock3 } from "lucide-react";
import { useI18n } from "./language-provider";

export function MeetingTimePicker({
  label,
  value,
  onChange,
  invalid,
  describedBy,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid: boolean;
  describedBy?: string;
}) {
  const { t } = useI18n();
  const [hour = "", minute = ""] = value.split(":");
  return (
    <div role="group" aria-label={label} aria-describedby={describedBy}>
      <span className="field-label flex items-center gap-1">
        <Clock3 size={14} />
        {label}
      </span>
      <div
        className={`flex items-center gap-1 rounded-md border bg-card px-2 ${invalid ? "border-destructive ring-1 ring-destructive" : "border-input"}`}
      >
        <select
          required
          aria-label={`${label} · ${t("Hour")}`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="native-select !border-0 !bg-transparent !px-1"
          value={hour}
          onChange={(e) => onChange(`${e.target.value}:${minute}`)}
        >
          <option value="" disabled>
            --
          </option>
          {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
            <option key={h} value={h}>
              {h}
            </option>
          ))}
        </select>
        <span aria-hidden="true">:</span>
        <select
          required
          aria-label={`${label} · ${t("Minute")}`}
          aria-invalid={invalid}
          aria-describedby={describedBy}
          className="native-select !border-0 !bg-transparent !px-1"
          value={minute}
          onChange={(e) => onChange(`${hour}:${e.target.value}`)}
        >
          <option value="" disabled>
            --
          </option>
          {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, "0")).map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
