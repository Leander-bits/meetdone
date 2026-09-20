"use client";
import { CornerDownRight } from "lucide-react";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";

export function ItemNumber({ index, letters = false }: { index: number; letters?: boolean }) {
  return (
    <span
      data-item-number
      className="shrink-0 self-start pt-2 text-sm tabular-nums text-muted-foreground"
    >
      {letters ? String.fromCharCode(97 + index) : index + 1}.
    </span>
  );
}

export function DeferralToggle({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const { t } = useI18n();
  const hint = t("Allow conversion into a follow-up action with owner and deadline");
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={hint}
      title={hint}
      aria-pressed={enabled}
      className={
        enabled ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "text-muted-foreground"
      }
      onClick={() => onChange(!enabled)}
    >
      <CornerDownRight size={16} />
    </Button>
  );
}
