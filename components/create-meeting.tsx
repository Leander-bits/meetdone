"use client";
import { useI18n } from "@/components/language-provider";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { MeetingRequirements, MeetingTemplate } from "@/lib/models";
import { templates, getTemplate } from "@/lib/templates";
import { createMeeting } from "@/lib/demo";
import { RequirementsEditor } from "./requirements-editor";
import { useWorkspace } from "./workspace-store";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

export function CreateMeeting({
  templateId,
  onClose,
}: {
  templateId: MeetingTemplate["id"];
  onClose: () => void;
}) {
  const { t: tx } = useI18n();

  const router = useRouter();
  const { saveMeeting } = useWorkspace();
  const [selected, setSelected] = useState(templateId);
  const [title, setTitle] = useState(getTemplate(templateId).defaultTitle);
  const [builtinTitle, setBuiltinTitle] = useState(true);
  const [requirements, setRequirements] = useState<MeetingRequirements>(
    structuredClone(getTemplate(templateId).requirements),
  );
  const [step, setStep] = useState(1);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <div className="eyebrow mb-1">
            {tx("New meeting · Step")}
            {step} {tx("of 2")}
          </div>
          <DialogTitle>
            {step === 1 ? tx("Start with a clear outcome") : tx("Define what done means")}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? tx("Choose a template. Make the requirements your own.")
              : tx(
                  "Required items block completion. Recommended items become follow-ups. Record-only items do not gate readiness.",
                )}
          </DialogDescription>
        </DialogHeader>
        {step === 1 ? (
          <div className="space-y-5 py-3">
            <div className="space-y-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelected(t.id);
                    setTitle(t.defaultTitle);
                    setBuiltinTitle(true);
                    setRequirements(structuredClone(t.requirements));
                  }}
                  className={`w-full rounded-lg border p-4 text-left ${selected === t.id ? "border-primary bg-accent" : "hover:bg-muted"}`}
                >
                  <div className="text-sm font-semibold">{tx(t.name)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{tx(t.description)}</p>
                </button>
              ))}
            </div>
            <label className="block">
              <span className="field-label">{tx("Meeting title")}</span>
              <Input
                value={builtinTitle ? tx(title) : title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setBuiltinTitle(false);
                }}
                maxLength={140}
              />
            </label>
          </div>
        ) : (
          <div className="py-3">
            <RequirementsEditor value={requirements} onChange={setRequirements} />
          </div>
        )}
        <DialogFooter>
          {step === 2 && (
            <Button variant="outline" onClick={() => setStep(1)}>
              {tx("Back")}
            </Button>
          )}
          <Button
            disabled={
              !title.trim() ||
              requirements.items.some((r) => !r.label.trim()) ||
              !requirements.items.some((r) => r.kind === "goal")
            }
            onClick={() => {
              if (step === 1) {
                setStep(2);
                return;
              }
              const meeting = {
                ...createMeeting(selected, crypto.randomUUID()),
                title: title.trim(),
                builtinTitle,
                requirements,
              };
              saveMeeting(meeting);
              onClose();
              router.push(`/meetings/${meeting.id}`);
            }}
          >
            {step === 1 ? tx("Define requirements") : tx("Create Meeting")}
            <ArrowRight size={15} />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
