import { MeetingRequirements, MeetingTemplate, templateSchema, requirementSchema } from "./models";
import { minimumKinds } from "./requirements";
import { templates } from "./templates";
import type { StorageLike } from "./storage";
export const TEMPLATES_STORAGE_KEY = "meetdone.templates.v1";
export function isBuiltinTemplate(id: string) {
  return templates.some((t) => t.id === id);
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
export function blankTemplate(id = `custom-${crypto.randomUUID()}`): MeetingTemplate {
  return {
    id,
    name: "",
    structureType: "stages",
    defaultGoals: [blankRequirements().items[0]],
    defaultStages: [],
    roleRequirements: [],
    rules: [],
  };
}
export function saveCustomTemplate(current: MeetingTemplate[], template: MeetingTemplate) {
  if (isBuiltinTemplate(template.id)) throw new Error("Built-in templates cannot be changed.");
  const parsed = templateSchema.parse(template);
  if (
    !parsed.name.trim() ||
    !parsed.defaultGoals.length ||
    parsed.defaultGoals.some((g) => !g.label.trim())
  )
    throw new Error("Enter a template name and complete every requirement.");
  return [structuredClone(parsed), ...current.filter((t) => t.id !== parsed.id)];
}
export function deleteCustomTemplate(current: MeetingTemplate[], id: string) {
  if (isBuiltinTemplate(id)) throw new Error("Built-in templates cannot be deleted.");
  return current.filter((t) => t.id !== id);
}
export function readCustomTemplates(storage: StorageLike): {
  customTemplates: MeetingTemplate[];
  warning: string | null;
} {
  try {
    const raw = storage.getItem(TEMPLATES_STORAGE_KEY);
    if (!raw) return { customTemplates: [], warning: null };
    const data = JSON.parse(raw);
    if (![1, 2].includes(data.version) || !Array.isArray(data.templates)) throw new Error();
    const result: MeetingTemplate[] = [];
    let skipped = false;
    for (const record of data.templates) {
      if (!record || typeof record !== "object") {
        skipped = true;
        continue;
      }
      const oldItems =
        data.version === 1 ? requirementSchema.array().safeParse(record.requirements?.items) : null;
      const migrated = oldItems?.success
        ? {
            id: record.id,
            name: record.name,
            structureType: "stages",
            defaultGoals: oldItems.data.filter((r) => r.kind === "goal"),
            defaultStages: [],
            roleRequirements: [],
            rules: oldItems.data
              .filter((r) => r.kind !== "speaker" && r.kind !== "goal")
              .map((r) => ({ ...r, topicId: undefined })),
          }
        : record;
      const parsed = templateSchema.safeParse(migrated);
      if (
        parsed.success &&
        !isBuiltinTemplate(parsed.data.id) &&
        !result.some((t) => t.id === parsed.data.id)
      )
        result.push(parsed.data);
      else skipped = true;
    }
    if (data.version === 1 || skipped) {
      try {
        if (!storage.getItem("meetdone.templates.recovery"))
          storage.setItem("meetdone.templates.recovery", raw);
      } catch {
        /* retain readable records */
      }
    }
    return {
      customTemplates: result,
      warning: skipped ? "Custom templates could not be loaded." : null,
    };
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
      JSON.stringify({ version: 2, templates: customTemplates }),
    );
    return null;
  } catch {
    return "Changes could not be saved to browser storage. Keep this tab open.";
  }
}
