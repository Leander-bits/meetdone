import { MeetingRequirements, Requirement } from "./models";

// Keep the existing discriminated array: no parallel fields or fixed numbered entries.
export const minimumKinds: Requirement["kind"][] = [
  "goal",
  "conclusion",
  "topic",
  "speaker",
  "action",
];
export const MAX_REQUIREMENTS = 80;
export function validRequirementLists(requirements: MeetingRequirements): boolean {
  const items = requirements.items;
  return (
    items.length <= MAX_REQUIREMENTS &&
    new Set(items.map((r) => r.id)).size === items.length &&
    minimumKinds.every((kind) => items.some((r) => r.kind === kind)) &&
    items.every(
      (r) =>
        r.label.trim().length > 0 &&
        r.label.length <= 500 &&
        (!r.topicId || items.some((t) => t.kind === "topic" && t.id === r.topicId)),
    )
  );
}
export function removeRequirement(
  requirements: MeetingRequirements,
  id: string,
): MeetingRequirements {
  const item = requirements.items.find((r) => r.id === id);
  if (
    !item ||
    (minimumKinds.includes(item.kind) &&
      requirements.items.filter((r) => r.kind === item.kind).length <= 1)
  )
    return requirements;
  return {
    ...requirements,
    items: requirements.items
      .filter((r) => r.id !== id)
      .map((r) => (r.topicId === id ? { ...r, topicId: undefined } : r)),
  };
}
