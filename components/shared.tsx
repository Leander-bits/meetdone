"use client";
import { useI18n } from "@/components/language-provider";
import Link from "next/link";
import { Check, CheckCheck, CircleHelp, HardDrive, Info } from "lucide-react";
import { Evidence, Meeting } from "@/lib/models";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function Brand() {
  const { t: tx } = useI18n();

  return (
    <Link
      href="/"
      className="inline-flex items-center gap-2.5 font-semibold tracking-tight text-xl"
      aria-label={tx("MeetDone home")}
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-white">
        <CheckCheck size={21} />
      </span>
      MeetDone
      <span className="ml-1 rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
        {tx("Demo")}
      </span>
    </Link>
  );
}
export function AppHeader() {
  const { t: tx, locale, setLocale } = useI18n();

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex h-17 max-w-[1440px] items-center justify-between px-5 sm:px-9">
        <Brand />
        <div className="flex items-center gap-3">
          <span className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
            <HardDrive size={14} />{" "}
            <span className="hidden sm:inline">{tx("Your browser. Your workspace.")}</span>
            <span className="sm:hidden">{tx("Saved locally")}</span>
          </span>
          <div
            className="flex items-center rounded-md border bg-muted/50 p-0.5"
            aria-label="中文 / EN"
          >
            <button
              aria-pressed={locale === "zh"}
              onClick={() => setLocale("zh")}
              className={cn(
                "rounded px-2 py-1 text-xs",
                locale === "zh" && "bg-white font-semibold text-primary shadow-sm",
              )}
            >
              中文
            </button>
            <span className="text-xs text-muted-foreground">/</span>
            <button
              aria-pressed={locale === "en"}
              onClick={() => setLocale("en")}
              className={cn(
                "rounded px-2 py-1 text-xs",
                locale === "en" && "bg-white font-semibold text-primary shadow-sm",
              )}
            >
              EN
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
export function StatusBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "bad" | "warn";
}) {
  const { t: tx } = useI18n();
  return (
    <Badge
      variant="outline"
      className={cn("whitespace-normal px-2 py-0.5 text-[11px] font-medium", {
        "border-emerald-200 bg-emerald-50 text-emerald-800": tone === "good",
        "border-red-200 bg-red-50 text-red-800": tone === "bad",
        "border-amber-200 bg-amber-50 text-amber-900": tone === "warn",
        "border-slate-200 bg-slate-50 text-slate-600": tone === "neutral",
      })}
    >
      {typeof children === "string" ? tx(children) : children}
    </Badge>
  );
}
export function LifecycleBadge({ lifecycle }: { lifecycle: Meeting["lifecycle"] }) {
  const { t: tx } = useI18n();

  return (
    <StatusBadge
      tone={
        lifecycle === "ended_with_exceptions" ? "warn" : lifecycle === "ended" ? "good" : "neutral"
      }
    >
      {lifecycle === "active"
        ? tx("In progress")
        : lifecycle === "ended"
          ? tx("Ended")
          : tx("Ended with Exceptions")}
    </StatusBadge>
  );
}
export function EvidenceList({ ids, evidence }: { ids: string[]; evidence: Evidence[] }) {
  const { t: tx } = useI18n();

  const items = evidence.filter((e) => ids.includes(e.id));
  if (!items.length) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="w-fit text-muted-foreground hover:text-primary">
        {tx("View evidence")} · {items.length} {items.length === 1 ? tx("excerpt") : tx("excerpts")}
      </summary>
      <div className="mt-2 space-y-2">
        {items.map((e) => (
          <blockquote
            key={e.id}
            className="border-l-2 border-primary/30 bg-muted/60 p-3 leading-relaxed"
          >
            <div className="mb-1 font-semibold">
              {e.speaker || tx("Unknown speaker")}
              <span className="ml-2 font-normal text-muted-foreground">
                {e.segmentId} · {tx("transcript v")}
                {e.transcriptRevision}
              </span>
            </div>
            “{e.quote}”
          </blockquote>
        ))}
      </div>
    </details>
  );
}
export function AboutDemo() {
  const { t: tx } = useI18n();

  return (
    <details className="surface text-sm">
      <summary className="flex items-center gap-2 p-4 font-medium">
        <CircleHelp size={16} className="text-muted-foreground" />
        {tx("About this demo")}
        <span className="ml-auto text-xs font-normal text-muted-foreground">
          {tx("What works today")}
        </span>
      </summary>
      <div className="grid gap-5 border-t p-5 text-xs leading-relaxed md:grid-cols-3">
        <div>
          <p className="mb-2 flex items-center gap-1.5 font-semibold">
            <Check size={14} className="text-primary" />
            {tx("Implemented")}
          </p>
          <p className="text-muted-foreground">
            {tx(
              "Meeting templates, requirement editing, text transcript input, AI extraction, coverage, deterministic readiness checks, actions, exceptions, and summaries.",
            )}
          </p>
        </div>
        <div>
          <p className="mb-2 font-semibold">{tx("Mock")}</p>
          <p className="text-muted-foreground">
            {tx(
              "Demo fixtures always work without an API key. AI analysis is optional and clearly labeled.",
            )}
          </p>
        </div>
        <div>
          <p className="mb-2 font-semibold">{tx("Not yet implemented")}</p>
          <p className="text-muted-foreground">
            {tx(
              "Audio, video, screen recordings, live microphones, Zoom, Teams, and Google Meet are not supported. Future speech-to-text can feed this transcript pipeline.",
            )}
          </p>
        </div>
      </div>
    </details>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: React.ReactNode;
  error?: boolean;
}) {
  const { t: tx } = useI18n();
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex gap-2 rounded-lg border px-4 py-3 text-sm leading-relaxed",
        error
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-border bg-muted/70 text-muted-foreground",
      )}
    >
      <Info size={16} className="mt-0.5 shrink-0" />
      <div>{typeof children === "string" ? tx(children) : children}</div>
    </div>
  );
}
export function LoadingWorkspace() {
  const { t: tx } = useI18n();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl p-8">
        <p role="status" className="text-sm text-muted-foreground">
          {tx("Opening your local workspace…")}
        </p>
      </main>
    </>
  );
}
