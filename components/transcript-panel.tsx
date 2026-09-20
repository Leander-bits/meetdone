"use client";
import { useRef, useState } from "react";
import { Meeting } from "@/lib/models";
import { MAX_TRANSCRIPT_LENGTH } from "@/lib/analysis-contract";
import { updateTranscript } from "@/lib/meeting-state";
import { useI18n } from "./language-provider";
import { Notice } from "./shared";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { importTextFile } from "@/lib/transcript-import";

export function TranscriptPanel({
  meeting: m,
  update,
  onAnalysis,
  pending,
  importing,
  onImportingChange,
  analysisFailure,
  clearAnalysisFailure,
}: {
  meeting: Meeting;
  update: (change: (m: Meeting) => Meeting) => boolean;
  onAnalysis: () => void;
  pending: boolean;
  importing: boolean;
  onImportingChange: (importing: boolean) => void;
  analysisFailure: string | null;
  clearAnalysisFailure: () => void;
}) {
  const { t: tx } = useI18n();
  const [failure, setFailure] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const tooLong = m.transcript.text.length > MAX_TRANSCRIPT_LENGTH;
  const ended = m.lifecycle !== "active";
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
            {tx(importing ? "Importing…" : "Import Text")}
          </Button>
        )}
      </div>
      <input
        ref={fileInput}
        type="file"
        accept=".txt,text/plain"
        aria-label={tx("Import Text")}
        className="hidden"
        disabled={ended || pending || importing}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          onImportingChange(true);
          setFailure(null);
          clearAnalysisFailure();
          try {
            const text = await importTextFile(file);
            update((current) => updateTranscript(current, text, file.name));
          } catch (error) {
            setFailure(error instanceof Error ? error.message : "The file could not be read.");
          } finally {
            onImportingChange(false);
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
          clearAnalysisFailure();
          update((current) =>
            updateTranscript(current, e.target.value, current.transcript.fileName),
          );
        }}
      />
      {m.transcript.fileName && (
        <p className="break-all text-xs text-muted-foreground">{m.transcript.fileName}</p>
      )}
      {(failure || analysisFailure || tooLong) && (
        <Notice error>{tx(tooLong ? "TRANSCRIPT_TOO_LONG" : (failure ?? analysisFailure)!)}</Notice>
      )}
      {!ended && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Button
              disabled={pending || importing || tooLong}
              onClick={() => {
                setFailure(null);
                onAnalysis();
              }}
            >
              {tx(pending ? "Analyzing" : "AI Analyze Meeting")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {m.transcript.text.length.toLocaleString()} / {MAX_TRANSCRIPT_LENGTH.toLocaleString()}
            </span>
          </div>
        </>
      )}
    </section>
  );
}
