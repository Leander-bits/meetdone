import { z } from "zod";
import { MeetingRequirements, MeetingTemplate, templateSchema } from "./models";
import { minimumKinds, validRequirementLists } from "./requirements";
import { templates } from "./templates";
import type { StorageLike } from "./storage";

export const TEMPLATES_STORAGE_KEY = "meetdone.templates.v1";
export function isBuiltinTemplate(id: string) {
  return templates.some((template) => template.id === id);
}
export function blankRequirements(): MeetingRequirements {
  return {
    revision: 1,
    items: minimumKinds.map((kind) => ({
      id: crypto.randomUUID(),
      kind,
      label: "",
      level: "required",
      allowsDeferral: false,
    })),
  };
}
export function saveCustomTemplate(current: MeetingTemplate[], template: MeetingTemplate) {
  if (isBuiltinTemplate(template.id)) throw new Error("Built-in templates cannot be changed.");
  const parsed = templateSchema.parse(template);
  if (!parsed.name.trim() || !validRequirementLists(parsed.requirements))
    throw new Error("Enter a template name and complete every requirement.");
  return [structuredClone(parsed), ...current.filter((t) => t.id !== parsed.id)];
}
export function deleteCustomTemplate(current: MeetingTemplate[], id: string) {
  if (isBuiltinTemplate(id)) throw new Error("Built-in templates cannot be deleted.");
  return current.filter((t) => t.id !== id);
}
const storeSchema = z.object({ version: z.literal(1), templates: z.array(templateSchema) });
export function readCustomTemplates(storage: StorageLike): {
  customTemplates: MeetingTemplate[];
  warning: string | null;
} {
  try {
    const raw = storage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return { customTemplates: [], warning: null };
    const saved = storeSchema.parse(JSON.parse(raw)).templates;
    if (
      new Set(saved.map((t) => t.id)).size !== saved.length ||
      saved.some(
        (t) => isBuiltinTemplate(t.id) || !t.name.trim() || !validRequirementLists(t.requirements),
      )
    )
      throw new Error();
    return { customTemplates: saved, warning: null };
  } catch {
    return { customTemplates: [], warning: "Custom templates could not be loaded." };
  }
}
export function writeCustomTemplates(
  storage: StorageLike,
  customTemplates: MeetingTemplate[],
): string | null {
  try {
    storage.setItem(
      TEMPLATES_STORAGE_KEY,
      JSON.stringify({ version: 1, templates: customTemplates }),
    );
    return null;
  } catch {
    return "Changes could not be saved to browser storage. Keep this tab open.";
  }
}
