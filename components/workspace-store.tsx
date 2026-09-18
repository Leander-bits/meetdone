"use client";
import { useEffect, useSyncExternalStore } from "react";
import { Meeting } from "@/lib/models";
import { freshDemo } from "@/lib/meeting-state";
import { readMeetings, STORAGE_KEY, writeMeetings } from "@/lib/storage";

type Snapshot = { meetings: Meeting[]; loaded: boolean; warning: string | null };
const initial: Snapshot = { meetings: [], loaded: false, warning: null };
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
    snapshot = { ...readMeetings(window.localStorage), loaded: true };
  } catch {
    snapshot = {
      meetings: [freshDemo()],
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
  snapshot = { meetings, warning, loaded: true };
  notify();
}
export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initialize();
    const sync = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY) {
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
    saveMeeting: (meeting: Meeting) =>
      persist([meeting, ...snapshot.meetings.filter((m) => m.id !== meeting.id)]),
    updateMeeting: (id: string, update: (m: Meeting) => Meeting) => {
      const current = snapshot.meetings.find((m) => m.id === id);
      if (!current) throw new Error("Meeting not found.");
      const next = update(current);
      persist(snapshot.meetings.map((m) => (m.id === id ? next : m)));
    },
    resetDemo: () =>
      persist([freshDemo(), ...snapshot.meetings.filter((m) => m.id !== "demo-launch")]),
  };
}
