"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Meeting, MeetingAnalysis } from "@/lib/models";
import { scenarios } from "@/lib/demo";
import { MAX_TRANSCRIPT_LENGTH, AnalysisError } from "@/lib/analysis-contract";
import { requestAnalysis } from "@/lib/analysis-client";
import { analyzeMeeting, loadScenario, updateTranscript } from "@/lib/meeting-state";
import { useI18n } from "./language-provider";
import { Notice } from "./shared";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { importTextFile } from "@/lib/transcript-import";
import { useWorkspace } from "./workspace-store";

export function TranscriptPanel({
  meeting: m,
  update,
  onAnalysis,
  pending,
  onPendingChange,
}: {
  meeting: Meeting;
  update: (change: (m: Meeting) => Meeting) => boolean;
  onAnalysis: (analysis: MeetingAnalysis, revision: number) => boolean;
  pending: boolean;
  onPendingChange: (pending: boolean) => void;
}) {
  const { t: tx } = useI18n();
  const [failure, setFailure] = useState<string | null>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoHint, setDemoHint] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const { meetings, resetDemo } = useWorkspace();
  const availableScenarios = scenarios.filter((s) => s.templateId === m.templateId);
  const tooLong = m.transcript.text.length > MAX_TRANSCRIPT_LENGTH;
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const ended = m.lifecycle !== "active";
  async function analyze() {
    if (pending) return;
    const abort = new AbortController();
    controller.current = abort;
    onPendingChange(true);
    setFailure(null);
    try {
      const analysis = await requestAnalysis(m, abort.signal);
      if (!abort.signal.aborted) onAnalysis(analysis, m.stateRevision);
    } catch (error) {
      if (!abort.signal.aborted)
        setFailure(error instanceof AnalysisError ? error.code : "PROVIDER_ERROR");
    } finally {
      onPendingChange(false);
    }
  }
  return (
    <section className="space-y-3" aria-labelledby="transcript-heading">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="transcript-heading" className="section-title">
          <label htmlFor="transcript">{tx("Transcript")}</label>
        </h2>
        {!ended && (
          <Button
            variant="ghost"
            size="sm"
            disabled={pending || importing}
            onClick={() => fileInput.current?.click()}
          >
            {tx(importing ? "Importing…" : "Import .txt")}
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,text/plain"
        aria-label={tx("Import .txt")}
        className="hidden"
        disabled={ended || pending || importing}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setImporting(true);
          setFailure(null);
          try {
            const text = await importTextFile(file);
            update((current) => updateTranscript(current, text, file.name));
            setDemoHint(false);
          } catch (error) {
            setFailure(error instanceof Error ? error.message : "The file could not be read.");
          } finally {
            setImporting(false);
          }
        }}
      />
      <Textarea
        id="transcript"
        className="h-[340px] min-h-56 scroll-mt-36 resize-y field-sizing-fixed bg-white text-sm leading-7 sm:h-[460px]"
        placeholder={tx("Paste or type your meeting transcript here…")}
        value={m.transcript.text}
        disabled={ended || pending || importing}
        aria-invalid={tooLong}
        onChange={(e) => {
          setFailure(null);
          setDemoHint(false);
          update((current) =>
            updateTranscript(current, e.target.value, current.transcript.fileName),
          );
        }}
      />
      {m.transcript.fileName && (
        <p className="break-all text-xs text-muted-foreground">{m.transcript.fileName}</p>
      )}
      {(failure || tooLong) && (
        <Notice error>{tx(tooLong ? "TRANSCRIPT_TOO_LONG" : failure!)}</Notice>
      )}
      {!ended && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button disabled={pending || importing || tooLong} onClick={analyze}>
              {tx(pending ? "Analyzing" : "Analyze Meeting")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {m.transcript.text.length.toLocaleString()} / {MAX_TRANSCRIPT_LENGTH.toLocaleString()}
            </span>
          </div>
          {availableScenarios.length > 0 && (
            <details
              open={demoOpen}
              onToggle={(e) => setDemoOpen(e.currentTarget.open)}
              className="pt-1 text-sm"
            >
              <summary className="w-fit text-muted-foreground">{tx("Load Demo Scenario")}</summary>
              <p className="mt-2 text-xs text-muted-foreground">
                {tx("Replaces the current transcript.")}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {availableScenarios.map((s) => (
                  <Button
                    key={s.id}
                    size="sm"
                    variant="outline"
                    disabled={pending || importing}
                    onClick={() => {
                      if (update((current) => loadScenario(current, s.id))) {
                        setFailure(null);
                        setDemoHint(false);
                      }
                    }}
                  >
                    {tx(s.name)}
                  </Button>
                ))}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={pending || importing}
                  onClick={() => {
                    setFailure(null);
                    if (!m.transcript.scenarioId) {
                      setDemoHint(true);
                      return;
                    }
                    if (update(analyzeMeeting)) setDemoHint(false);
                  }}
                >
                  {tx("Use Demo Analysis")}
                </Button>
              </div>
              {demoHint && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {tx("Select a demo scenario first. This replaces your transcript.")}
                </p>
              )}
            </details>
          )}
          {failure && !demoOpen && availableScenarios.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setDemoOpen(true);
                setDemoHint(!m.transcript.scenarioId);
              }}
            >
              {tx("Use Demo Analysis")}
            </Button>
          )}
          {availableScenarios.length === 0 && (
            <Button variant="ghost" size="sm" asChild>
              <Link
                href="/meetings/demo-launch"
                onClick={() => {
                  if (!meetings.some((m) => m.id === "demo-launch")) resetDemo();
                }}
              >
                {tx("Open Demo Meeting")}
              </Link>
            </Button>
          )}
          <details className="text-sm">
            <summary className="w-fit text-muted-foreground">{tx("Live Transcription")}</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              {tx("Coming soon. Paste or import a transcript for now.")}
            </p>
          </details>
        </>
      )}
    </section>
  );
}
