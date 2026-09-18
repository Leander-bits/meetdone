"use client";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Sparkles } from "lucide-react";
import { Meeting, MeetingAnalysis } from "@/lib/models";
import { scenarios } from "@/lib/demo";
import { MAX_TRANSCRIPT_LENGTH, AnalysisError } from "@/lib/analysis-contract";
import { requestAnalysis } from "@/lib/analysis-client";
import { analyzeMeeting, loadScenario, updateTranscript } from "@/lib/meeting-state";
import { useI18n } from "./language-provider";
import { Notice, StatusBadge } from "./shared";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { cn } from "@/lib/utils";

export function TranscriptPanel({
  meeting: m,
  update,
  onAnalysis,
}: {
  meeting: Meeting;
  update: (change: (m: Meeting) => Meeting) => boolean;
  onAnalysis: (analysis: MeetingAnalysis, revision: number) => boolean;
}) {
  const { t: tx } = useI18n();
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const ended = m.lifecycle !== "active";
  async function analyze() {
    if (pending) return;
    const abort = new AbortController();
    controller.current = abort;
    setPending(true);
    setFailure(null);
    setMessage(null);
    try {
      const analysis = await requestAnalysis(m, abort.signal);
      if (!abort.signal.aborted && onAnalysis(analysis, m.stateRevision))
        setMessage("Analysis complete. Coverage and readiness are updated.");
    } catch (error) {
      if (!abort.signal.aborted)
        setFailure(error instanceof AnalysisError ? error.code : "PROVIDER_ERROR");
    } finally {
      if (!abort.signal.aborted) setPending(false);
    }
  }
  return (
    <div className="space-y-5">
      <div>
        <h2 className="section-title">{tx("Meeting transcript")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {tx("Text transcript is the primary input. Paste notes or a speaker-labeled transcript.")}
        </p>
      </div>
      {failure && (
        <Notice error>
          <strong>{tx("AI Analysis Failed")}</strong>
          <p>{tx(failure)}</p>
        </Notice>
      )}
      {message && <Notice>{tx(message)}</Notice>}
      {!ended && (
        <div className="surface p-5">
          <p className="eyebrow mb-3">{tx("Load Demo Scenario")}</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {scenarios
              .filter((s) => s.templateId === m.templateId)
              .map((s) => (
                <button
                  disabled={pending}
                  key={s.id}
                  onClick={() => {
                    if (update((current) => loadScenario(current, s.id))) {
                      setFailure(null);
                      setMessage(
                        "Demo transcript loaded. Click Use Demo Analysis or Analyze Meeting.",
                      );
                    }
                  }}
                  className={cn(
                    "rounded-lg border p-3 text-left disabled:opacity-50",
                    m.transcript.scenarioId === s.id
                      ? "border-primary/60 bg-accent"
                      : "hover:border-primary/40",
                  )}
                >
                  <p className="text-sm font-semibold">{tx(s.name)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {tx(s.description)}
                  </p>
                </button>
              ))}
          </div>
          <p className="mt-3 text-[11px] leading-5 text-muted-foreground">
            {tx(
              "Loading a scenario replaces the transcript and extracted actions. Host actions are retained; previous gap resolutions are cleared.",
            )}
          </p>
        </div>
      )}
      <div className="surface p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="transcript" className="text-sm font-semibold">
            {tx("Transcript text")}
          </label>
          <StatusBadge>
            {m.transcript.scenarioId ? "Demo scenario" : "Custom transcript"}
          </StatusBadge>
        </div>
        <Textarea
          id="transcript"
          maxLength={MAX_TRANSCRIPT_LENGTH}
          className="min-h-[360px] resize-y bg-background/50 text-[13px] leading-7"
          placeholder={tx("Paste or type your meeting transcript here…")}
          value={m.transcript.text}
          disabled={ended || pending}
          onChange={(e) => {
            setMessage(null);
            setFailure(null);
            update((current) => updateTranscript(current, e.target.value));
          }}
        />
        <div className="mt-3 space-y-3">
          <p className="text-[11px] text-muted-foreground">
            {m.transcript.text.length.toLocaleString()} / {MAX_TRANSCRIPT_LENGTH.toLocaleString()}{" "}
            {tx("characters")}
          </p>
          {!ended && (
            <>
              <div className="flex flex-wrap gap-2">
                <Button disabled={pending} onClick={analyze}>
                  {pending ? (
                    <LoaderCircle className="animate-spin" size={14} />
                  ) : (
                    <Sparkles size={14} />
                  )}
                  {tx(pending ? "Analyzing" : "Analyze Meeting")}
                </Button>
                <Button
                  disabled={pending}
                  variant="outline"
                  onClick={() => {
                    setFailure(null);
                    if (!m.transcript.scenarioId) {
                      setMessage(
                        "Load a demo scenario to use demo analysis. Your current transcript will only be replaced when you select a scenario.",
                      );
                      return;
                    }
                    if (update(analyzeMeeting))
                      setMessage("Analysis complete. Coverage and readiness are updated.");
                  }}
                >
                  {tx("Use Demo Analysis")}
                </Button>
              </div>
              <p className="text-[11px] leading-5 text-muted-foreground">
                {tx(
                  "AI analysis sends this transcript and its requirements to the configured AI provider.",
                )}
              </p>
            </>
          )}
        </div>
      </div>
      <p role="status" aria-live="polite" className="text-xs text-muted-foreground">
        {pending
          ? tx("Analyzing")
          : m.analysis
            ? `${tx("Analysis Complete")} · ${tx(m.analysis.provider === "demo" ? "Demo Analysis Mode" : "AI Analysis Mode")}`
            : tx("Not analyzed")}
      </p>
    </div>
  );
}
