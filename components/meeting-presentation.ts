"use client";
import { Meeting } from "@/lib/models";
import { meetingPresentation } from "@/lib/meeting-presentation";
import { useI18n } from "./language-provider";
export function useMeetingPresentation(meeting: Meeting) {
  return meetingPresentation(meeting, useI18n().locale);
}
