"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Meeting, MeetingTemplate } from "@/lib/models";
import { sampleMeetings } from "@/lib/sample-meetings";
import { readMeetings, STORAGE_KEY, writeMeetings } from "@/lib/storage";

import {
  readCustomTemplates,
  writeCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
  TEMPLATES_STORAGE_KEY,
} from "@/lib/custom-templates";
type Snapshot = {
  meetings: Meeting[];
  customTemplates: MeetingTemplate[];
  loaded: boolean;
  warning: string | null;
};
const initial: Snapshot = { meetings: [], customTemplates: [], loaded: false, warning: null };
let snapshot = initial;
const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((listener) => listener());
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function initialize() {
  if (snapshot.loaded) return;
  try {
    const meetings = readMeetings(window.localStorage);
    const custom = readCustomTemplates(window.localStorage);
    snapshot = {
      meetings: meetings.meetings,
      customTemplates: custom.customTemplates,
      warning: meetings.warning ?? custom.warning,
      loaded: true,
    };
  } catch {
    snapshot = {
      meetings: sampleMeetings(),
      customTemplates: [],
      loaded: true,
      warning: "Browser storage is unavailable. Changes will last for this tab only.",
    };
  }
  notify();
}
function persist(meetings: Meeting[]) {
  let warning: string | null;
  try {
    warning = writeMeetings(window.localStorage, meetings);
  } catch {
    warning = "Changes could not be saved to browser storage. Keep this tab open.";
  }
  snapshot = { ...snapshot, meetings, warning, loaded: true };
  notify();
}
function persistTemplates(customTemplates: MeetingTemplate[]) {
  let warning: string | null;
  try {
    warning = writeCustomTemplates(window.localStorage, customTemplates);
  } catch {
    warning = "Changes could not be saved to browser storage. Keep this tab open.";
  }
  snapshot = { ...snapshot, customTemplates, warning };
  notify();
}
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initialize();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === TEMPLATES_STORAGE_KEY) {
        snapshot = initial;
        initialize();
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  return children;
}
export function useWorkspace() {
  const state = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => initial,
  );
  return {
    ...state,
    deleteMeeting: (id: string) => persist(snapshot.meetings.filter((m) => m.id !== id)),
    saveTemplate: (template: MeetingTemplate) =>
      persistTemplates(saveCustomTemplate(snapshot.customTemplates, template)),
    deleteTemplate: (id: string) =>
      persistTemplates(deleteCustomTemplate(snapshot.customTemplates, id)),
    saveMeeting: (meeting: Meeting) =>
      persist([meeting, ...snapshot.meetings.filter((m) => m.id !== meeting.id)]),
    updateMeeting: (id: string, update: (m: Meeting) => Meeting) => {
      const current = snapshot.meetings.find((m) => m.id === id);
      if (!current) throw new Error("Meeting not found.");
      const next = update(current);
      persist(snapshot.meetings.map((m) => (m.id === id ? next : m)));
    },
  };
}
