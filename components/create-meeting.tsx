"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { MeetingRequirements, MeetingTemplate } from "@/lib/models";
import { templates, getTemplate } from "@/lib/templates";
import { blankRequirements, isBuiltinTemplate } from "@/lib/custom-templates";
import { validRequirementLists } from "@/lib/requirements";
import { createMeeting } from "@/lib/demo";
import { RequirementsEditor } from "./requirements-editor";
import { useI18n } from "./language-provider";
import { useWorkspace } from "./workspace-store";
import { Notice } from "./shared";
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
  templateId: string;
  onClose: () => void;
}) {
  const { t: tx, label } = useI18n();
  const router = useRouter();
  const { saveMeeting, customTemplates, saveTemplate, deleteTemplate } = useWorkspace();
  const initial = getTemplate(templateId)!;
  const [selected, setSelected] = useState(templateId);
  const [title, setTitle] = useState(initial.defaultTitle);
  const [builtinTitle, setBuiltinTitle] = useState(true);
  const [requirements, setRequirements] = useState<MeetingRequirements>(
    structuredClone(initial.requirements),
  );
  const [templateName, setTemplateName] = useState("");
  const [managing, setManaging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const allTemplates = [...templates, ...customTemplates];
  const current = allTemplates.find((t) => t.id === selected);
  const custom = current && !isBuiltinTemplate(current.id);
  const valid = validRequirementLists(requirements);
  const userRequirements = (): MeetingRequirements => ({
    revision: 1,
    items: requirements.items.map((r) => ({ ...r, label: label(r), builtinKey: undefined })),
  });
  function choose(t: MeetingTemplate) {
    setSelected(t.id);
    setRequirements(structuredClone(t.requirements));
    if (builtinTitle || !title.trim()) {
      setTitle(t.defaultTitle);
      setBuiltinTitle(isBuiltinTemplate(t.id));
    }
    setTemplateName(isBuiltinTemplate(t.id) ? "" : t.name);
    setManaging(false);
    setMessage(null);
  }
  function newTemplate(empty: boolean) {
    setSelected(`custom-${crypto.randomUUID()}`);
    if (empty) {
      setTitle("");
      setRequirements(blankRequirements());
    } else {
      setTitle(builtinTitle ? tx(title) : title);
      setRequirements(userRequirements());
    }
    setBuiltinTitle(false);
    setTemplateName("");
    setManaging(true);
    setMessage(null);
  }
  function save() {
    const id = isBuiltinTemplate(selected) ? `custom-${crypto.randomUUID()}` : selected;
    saveTemplate({
      id,
      name: templateName.trim(),
      defaultTitle: builtinTitle ? tx(title) : title,
      description: "",
      requirements: userRequirements(),
    });
    setSelected(id);
    setRequirements(userRequirements());
    setTitle(builtinTitle ? tx(title) : title);
    setBuiltinTitle(false);
    setManaging(false);
    setMessage("Template saved.");
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        aria-describedby={undefined}
        className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
      >
        <DialogHeader className="px-5 py-4">
          <DialogTitle>{tx("Create Meeting")}</DialogTitle>
        </DialogHeader>
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim() || !valid) return;
            const source: MeetingTemplate = current ?? {
              id: selected,
              name: templateName,
              defaultTitle: title,
              description: "",
              requirements,
            };
            const meeting = {
              ...createMeeting(selected, crypto.randomUUID(), false, source),
              title: title.trim(),
              builtinTitle,
              requirements: structuredClone(requirements),
            };
            saveMeeting(meeting);
            onClose();
            router.push(`/meetings/${meeting.id}`);
          }}
        >
          <div className="space-y-5 overflow-y-auto px-5 pb-5">
            <label className="block">
              <span className="field-label">{tx("Meeting name")}</span>
              <Input
                required
                value={builtinTitle ? tx(title) : title}
                maxLength={140}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setBuiltinTitle(false);
                }}
              />
            </label>
            <div>
              <label className="block">
                <span className="field-label">{tx("Template")}</span>
                <select
                  className="native-select"
                  value={selected}
                  onChange={(e) => choose(allTemplates.find((t) => t.id === e.target.value)!)}
                >
                  {!current && <option value={selected}>{tx("New template")}</option>}
                  <optgroup label={tx("Built-in templates")}>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {tx(t.name)}
                      </option>
                    ))}
                  </optgroup>
                  {customTemplates.length > 0 && (
                    <optgroup label={tx("Custom templates")}>
                      {customTemplates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </label>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button type="button" size="sm" variant="ghost" onClick={() => newTemplate(true)}>
                  {tx("Create New Template")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => (custom ? setManaging(!managing) : setManaging(true))}
                >
                  {tx(custom ? "Template options" : "Save as Template")}
                </Button>
              </div>
              {managing && (
                <div className="mt-3 space-y-3 border-l-2 pl-3">
                  <label className="block">
                    <span className="field-label">{tx("Template name")}</span>
                    <Input
                      value={templateName}
                      maxLength={100}
                      onChange={(e) => setTemplateName(e.target.value)}
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!valid || !templateName.trim()}
                      onClick={save}
                    >
                      {tx("Save Template")}
                    </Button>
                    {custom && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => newTemplate(false)}
                        >
                          {tx("Save as Template")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleting(true)}
                        >
                          {tx("Delete Custom Template")}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
            {message && <Notice>{message}</Notice>}
            <h2 className="border-t pt-5 text-sm font-semibold">{tx("What must be completed?")}</h2>
            <RequirementsEditor
              value={requirements}
              onChange={(r) => {
                setRequirements(r);
                setMessage(null);
              }}
            />
          </div>
          <DialogFooter className="border-t px-5 py-4">
            <Button type="button" variant="ghost" onClick={onClose}>
              {tx("Cancel")}
            </Button>
            <Button type="submit" disabled={!title.trim() || !valid}>
              {tx("Create Meeting")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
      <Dialog open={deleting} onOpenChange={setDeleting}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tx("Delete this template?")}</DialogTitle>
            <DialogDescription>
              {tx("Meetings created from this template will be kept.")}
            </DialogDescription>
          </DialogHeader>
          <p className="break-words font-medium">{current?.name}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(false)}>
              {tx("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                deleteTemplate(selected);
                setDeleting(false);
                newTemplate(true);
              }}
            >
              {tx("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
