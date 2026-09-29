"use client";
import { useState } from "react";
import { X } from "lucide-react";
import { Participant } from "@/lib/models";
import { displayNameFromEmail, validParticipantEmail } from "@/lib/meeting-structure";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

export function ParticipantInput({
  participants,
  onChange,
  draft,
  onDraftChange,
}: {
  participants: Participant[];
  onChange: (people: Participant[]) => void;
  draft: string;
  onDraftChange: (value: string) => void;
}) {
  const { t } = useI18n();
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const person = participants.find((p) => p.id === editing);
  const add = () => {
    const email = draft.trim();
    if (!validParticipantEmail(email)) {
      setError("Enter a valid email address");
      return;
    }
    if (participants.some((p) => p.email.toLowerCase() === email.toLowerCase())) {
      setError("This participant has already been added");
      return;
    }
    if (participants.length >= 30) {
      setError("You can add up to 30 participants");
      return;
    }
    onChange([
      ...participants,
      { id: crypto.randomUUID(), email, name: displayNameFromEmail(email), role: "Other" },
    ]);
    onDraftChange("");
    setError("");
  };
  return (
    <fieldset>
      <legend className="mb-3 text-sm font-semibold">{t("Participants")}</legend>
      <div
        data-participant-input
        className={`flex min-h-14 flex-wrap items-center gap-2 rounded-xl border bg-card px-3 py-2 focus-within:ring-2 focus-within:ring-ring ${error ? "border-destructive" : "border-input"}`}
      >
        {participants.map((p) => (
          <span
            key={p.id}
            data-participant-chip
            className="inline-flex max-w-full items-center gap-1 rounded-lg bg-muted px-2.5 py-1 text-sm"
          >
            <button
              type="button"
              className="min-w-0 break-all text-left"
              title={p.email}
              aria-label={`${t("Edit participant")}: ${p.email}`}
              onClick={() => setEditing(editing === p.id ? null : p.id)}
            >
              {displayNameFromEmail(p.email)}
            </button>
            <button
              type="button"
              className="flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-destructive"
              aria-label={`${t("Remove participant")}: ${p.email}`}
              onClick={() => {
                onChange(participants.filter((x) => x.id !== p.id));
                setError("");
                if (editing === p.id) setEditing(null);
              }}
            >
              <X size={14} />
            </button>
          </span>
        ))}
        <input
          aria-label={t("Participant email")}
          type="email"
          autoComplete="off"
          maxLength={254}
          value={draft}
          placeholder={t("Enter an email and press Enter")}
          aria-invalid={!!error}
          aria-describedby={error ? "participant-email-error" : undefined}
          className="min-w-0 basis-48 flex-1 bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground/60"
          onChange={(e) => {
            onDraftChange(e.target.value);
            setError("");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) {
              e.preventDefault();
              add();
            }
          }}
          onBlur={() => {
            if (draft.trim() && !validParticipantEmail(draft.trim()))
              setError("Enter a valid email address");
          }}
        />
      </div>
      {error && (
        <p id="participant-email-error" role="alert" className="mt-2 text-sm text-destructive">
          {t(error)}
        </p>
      )}
      {person && (
        <div className="mt-3 flex items-end gap-2" data-participant-details>
          <label className="min-w-0 flex-1">
            <span className="field-label">{t("Display name")}</span>
            <Input
              maxLength={100}
              value={person.name}
              onChange={(e) =>
                onChange(
                  participants.map((p) =>
                    p.id === person.id ? { ...p, name: e.target.value } : p,
                  ),
                )
              }
            />
          </label>
          <Button variant="ghost" onClick={() => setEditing(null)}>
            {t("Done")}
          </Button>
        </div>
      )}
    </fieldset>
  );
}
