"use client";
import { useEffect, useRef, useState } from "react";
import { Meeting, MeetingAnalysis } from "@/lib/models";
import { requestAnalysis } from "@/lib/analysis-client";
import { AnalysisError } from "@/lib/analysis-contract";

// Both entry points use the same request, validation and cancellation lifecycle.
export function useMeetingAnalysis() {
  const [pending, setPending] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function analyze(
    meeting: Meeting,
    apply: (analysis: MeetingAnalysis, revision: number) => boolean,
  ) {
    if (controller.current || meeting.lifecycle !== "active") return;
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setAnalyzed(false);
    setFailure(null);
    try {
      const result = await requestAnalysis(meeting, abort.signal);
      if (!abort.signal.aborted && apply(result, meeting.stateRevision)) setAnalyzed(true);
    } catch (error) {
      if (!abort.signal.aborted)
        setFailure(error instanceof AnalysisError ? error.code : "PROVIDER_ERROR");
    } finally {
      if (controller.current === abort) {
        controller.current = null;
        setPending(false);
      }
    }
  }
  return { pending, analyzed, failure, analyze, clearFailure: () => setFailure(null) };
}
