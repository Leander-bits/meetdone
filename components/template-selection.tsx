"use client";
import { BarChart3, Check, FilePenLine, Plus, RefreshCw, Rocket, Trash2 } from "lucide-react";
import { MeetingTemplate } from "@/lib/models";
import { isBuiltinTemplate } from "@/lib/custom-templates";
import { useI18n } from "./language-provider";
import { Button } from "./ui/button";

export function TemplateSelection({
  templates,
  selected,
  onSelect,
  onCreate,
  onDelete,
}: {
  templates: MeetingTemplate[];
  selected: MeetingTemplate | null;
  onSelect: (template: MeetingTemplate) => void;
  onCreate: () => void;
  onDelete: (template: MeetingTemplate) => void;
}) {
  const { t } = useI18n();
  const newSelected = !!selected && !templates.some((template) => template.id === selected.id);
  const card = (active: boolean) =>
    `relative rounded-xl border-2 bg-card transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"}`;
  const selectClass =
    "flex min-h-36 w-full flex-col items-start justify-center gap-4 rounded-lg p-5 pr-12 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-6 sm:pr-12";
  return (
    <section aria-labelledby="template-selection-title" className="space-y-7">
      <h2 id="template-selection-title" className="text-2xl font-semibold">
        {t("Choose a template")}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2" data-template-grid>
        {templates.map((template) => {
          const builtin = isBuiltinTemplate(template.id);
          const active = selected?.id === template.id;
          const Icon =
            template.id === "launch"
              ? Rocket
              : template.id === "retro"
                ? RefreshCw
                : template.id === "customer"
                  ? BarChart3
                  : FilePenLine;
          return (
            <div key={template.id} className={card(active)}>
              <button
                type="button"
                className={selectClass}
                aria-pressed={active}
                onClick={() => onSelect(template)}
              >
                <Icon size={24} aria-hidden="true" className="text-primary" />
                <span className="break-words text-base font-semibold">
                  {builtin ? t(template.name) : template.name}
                </span>
                {active && (
                  <Check
                    size={18}
                    aria-hidden="true"
                    className="absolute bottom-5 right-5 text-primary"
                  />
                )}
              </button>
              {!builtin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-2"
                  aria-label={`${t("Delete Custom Template")}: ${template.name}`}
                  onClick={() => onDelete(template)}
                >
                  <Trash2 size={14} />
                </Button>
              )}
            </div>
          );
        })}
        <button
          type="button"
          className={`${card(newSelected)} ${selectClass}`}
          aria-pressed={newSelected}
          onClick={onCreate}
        >
          <Plus size={24} aria-hidden="true" className="text-primary" />
          <span className="text-base font-semibold">{t("Create New Template")}</span>
          {newSelected && (
            <Check
              size={18}
              aria-hidden="true"
              className="absolute bottom-5 right-5 text-primary"
            />
          )}
        </button>
      </div>
    </section>
  );
}
