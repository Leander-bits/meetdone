"use client";
import { ArrowLeft, X } from "lucide-react";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";
import { DialogTitle } from "./ui/dialog";

export function BasicInformationHeader({ onClose }: { onClose: () => void }) {
  const { t, locale, setLocale } = useI18n();
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3 text-left md:grid-cols-[1fr_auto_1fr]">
      <DialogTitle className="sr-only">{t("Create Meeting")}</DialogTitle>
      <Button variant="ghost" className="justify-self-start" onClick={onClose}>
        <ArrowLeft size={16} />
        {t("Back to Home")}
      </Button>
      <ol
        aria-label={t("Meeting creation steps")}
        className="col-span-2 row-start-2 flex items-center justify-center gap-2 py-1 md:col-span-1 md:col-start-2 md:row-start-1"
      >
        {["Basic Information", "Meeting Template", "Goals and Structure"].map((label, index) => (
          <li
            key={label}
            aria-current={index === 0 ? "step" : undefined}
            className={`flex min-w-0 items-center gap-2 text-xs ${index === 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}
          >
            {index > 0 && <span aria-hidden="true" className="h-px w-3 bg-border sm:w-6" />}
            <span
              className={`flex size-6 shrink-0 items-center justify-center rounded-full ${index === 0 ? "bg-foreground text-white" : "bg-muted"}`}
            >
              {index + 1}
            </span>
            <span>{t(label)}</span>
          </li>
        ))}
      </ol>
      <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 md:col-start-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        >
          {locale === "zh" ? "EN" : "中文"}
        </Button>
        <Button variant="ghost" size="icon" aria-label={t("Close")} onClick={onClose}>
          <X size={18} />
        </Button>
      </div>
    </div>
  );
}
