"use client";
import { useI18n } from "@/components/language-provider";
import Link from "next/link";
import { CheckCheck, Info } from "lucide-react";
import { Evidence, Meeting } from "@/lib/models";
import { Badge } from "@/components/ui/badge";
import { evaluateMeeting } from "@/lib/meeting-state";
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
    </Link>
  );
}
export function AppHeader() {
  const { locale, setLocale } = useI18n();

  return (
    <header className="border-b bg-white">
      <div className="flex h-17 w-full items-center justify-between px-4 sm:px-6 lg:px-8">
        <Brand />
        <div className="flex items-center gap-3">
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
export function meetingStatus(m: Meeting, pending = false): string {
  if (m.lifecycle === "ended_with_exceptions") return "Ended with Exceptions";
  if (m.lifecycle === "ended") return "Ended";
  if (pending) return "Analyzing";
  if (!m.analysis) return "Not analyzed";
  return evaluateMeeting(m).readiness === "READY" ? "Ready to End" : "Blocked";
}
export function EvidenceList({ ids, evidence }: { ids: string[]; evidence: Evidence[] }) {
  const { t: tx } = useI18n();

  const items = evidence.filter((e) => ids.includes(e.id));
  if (!items.length) return null;
  return (
    <details className="mt-2 text-xs">
      <summary className="w-fit text-muted-foreground hover:text-primary">
        {tx("View evidence")}
      </summary>
      <div className="mt-2 space-y-2">
        {items.map((e) => (
          <blockquote
            key={e.id}
            className="max-w-[90ch] break-words border-l-2 border-primary/30 bg-muted/60 p-3 leading-relaxed"
          >
            <div className="mb-1 font-semibold">
              {e.speaker || tx("Unknown speaker")}
              <span className="ml-2 font-normal text-muted-foreground">{e.segmentId}</span>
            </div>
            “{e.quote}”
          </blockquote>
        ))}
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
      <main className="app-page">
        <p role="status" className="text-sm text-muted-foreground">
          {tx("Opening your local workspace…")}
        </p>
      </main>
    </>
  );
}
