import { Meeting, MeetingTemplate } from "./models";
import { getTemplate } from "./templates";
import { demoConfiguration, demoTitles } from "./demo-configuration";
import { initialStructure, compileRequirements } from "./meeting-structure";
export function createMeeting(
  templateId: MeetingTemplate["id"],
  id: string,
  isDemo = false,
  customTemplate?: MeetingTemplate,
): Meeting {
  const template = customTemplate ?? getTemplate(templateId);
  if (!template || template.id !== templateId) throw new Error("Template not found.");
  const now = new Date().toISOString();
  return {
    id,
    title: demoTitles[templateId] ?? template.name,
    builtinTitle: !customTemplate,
    templateId,
    isDemo,
    createdAt: now,
    updatedAt: now,
    lifecycle: "active",
    stateRevision: 1,
    ...(!customTemplate
      ? demoConfiguration(templateId)
      : {
          date: "",
          startTime: "09:00",
          endTime: "09:30",
          timezone: "UTC",
          participants: [],
          goals: structuredClone(template.defaultGoals),
          structure: initialStructure(template.structureType, 30, [], template),
          requirements: compileRequirements(
            template.defaultGoals,
            initialStructure(template.structureType, 30, [], template),
            [],
            template.rules,
          ),
        }),
    transcript: { text: "", revision: 1, scenarioId: null },
    analysis: null,
    actionItems: [],
    gapResolutions: [],
    completionCheck: null,
    summary: null,
  };
}
