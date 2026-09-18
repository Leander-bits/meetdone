"use client";
import { useI18n } from "@/components/language-provider";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  CheckCheck,
  ClipboardCheck,
  Flag,
  MessageSquare,
  Plus,
  Rocket,
  RotateCcw,
  Users,
} from "lucide-react";
import { MeetingTemplate } from "@/lib/models";
import { templates } from "@/lib/templates";
import { useWorkspace } from "./workspace-store";
import {
  AboutDemo,
  AppHeader,
  LifecycleBadge,
  LoadingWorkspace,
  Notice,
  StatusBadge,
} from "./shared";
import { Button } from "./ui/button";
import { CreateMeeting } from "./create-meeting";

export function Home() {
  const { t: tx, title: meetingTitle } = useI18n();

  const { loaded, meetings, warning, resetDemo } = useWorkspace();
  const [creating, setCreating] = useState<MeetingTemplate["id"] | null>(null);
  if (!loaded) return <LoadingWorkspace />;
  const demo = meetings.find((m) => m.id === "demo-launch");
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-6xl space-y-9 px-5 py-9 sm:px-9 sm:py-12">
        {warning && <Notice error>{warning}</Notice>}
        <section className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="eyebrow mb-4 flex items-center gap-2">
              <span className="size-1.5 rounded-full bg-primary" />
              {tx("A clear finish for every meeting")}
            </p>
            <h1 className="max-w-xl text-4xl font-semibold leading-[1.15] tracking-[-0.035em] sm:text-[44px]">
              {tx("Know if your meeting")}
              <br className="hidden sm:block" /> {tx("is actually done.")}
            </h1>
            <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted-foreground">
              {tx(
                "MeetDone checks whether required decisions, speakers, owners, deadlines, and blockers have actually been resolved before a meeting ends.",
              )}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link
                  href="/meetings/demo-launch"
                  onClick={() => {
                    if (!demo) resetDemo();
                  }}
                >
                  {tx("Try Demo Meeting")}
                  <ArrowRight size={16} />
                </Link>
              </Button>
              <Button variant="outline" size="lg" onClick={() => setCreating("launch")}>
                <Plus size={16} />
                {tx("Create Meeting")}
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {tx("No setup needed. Everything stays in your browser.")}
            </p>
          </div>
          <div className="surface overflow-hidden shadow-sm">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <span className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck size={16} />
                {tx("The end-of-meeting check")}
              </span>
              <StatusBadge tone="bad">{tx("4 blockers")}</StatusBadge>
            </div>
            <div className="space-y-4 p-5">
              {[
                [tx("Required topics discussed"), true],
                [tx("Sales opinion captured"), false],
                [tx("Final Go / No-Go decided"), false],
                [tx("Every action has an owner & deadline"), false],
              ].map(([label, complete]) => (
                <div key={String(label)} className="flex items-center gap-3 text-sm">
                  <span
                    className={`flex size-6 shrink-0 items-center justify-center rounded-full ${complete ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}
                  >
                    {complete ? <CheckCheck size={14} /> : <span className="text-xs">!</span>}
                  </span>
                  {label}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 border-t bg-muted/60 px-5 py-3 text-xs text-muted-foreground">
              <Flag size={13} />
              {tx("Demo preview · Find the gaps while everyone is still here.")}
            </div>
          </div>
        </section>
        <section>
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="eyebrow mb-1">{tx("Built around your outcome")}</p>
              <h2 className="section-title">{tx("Three ways to get to done")}</h2>
            </div>
            <span className="hidden text-xs text-muted-foreground sm:block">
              {tx("Start with a template. Adjust as needed.")}
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {templates.map((t, i) => {
              const Icon = [Rocket, MessageSquare, Users][i];
              return (
                <button
                  key={t.id}
                  onClick={() => setCreating(t.id)}
                  className="surface group p-5 text-left transition-colors hover:border-primary/50 hover:bg-accent/40"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="rounded-lg bg-muted p-2.5 text-primary">
                      <Icon size={19} />
                    </span>
                    <ArrowUpRight
                      size={16}
                      className="text-muted-foreground group-hover:text-primary"
                    />
                  </div>
                  <h3 className="text-sm font-semibold">{tx(t.name)}</h3>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">
                    {tx(t.description)}
                  </p>
                </button>
              );
            })}
          </div>
        </section>
        <section>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="section-title">
              {tx("Your meetings")}{" "}
              <span className="ml-1 text-sm font-normal text-muted-foreground">
                {meetings.length}
              </span>
            </h2>
            <Button variant="ghost" size="sm" onClick={resetDemo}>
              <RotateCcw size={13} />
              {tx("Reset Demo")}
            </Button>
          </div>
          <div className="surface divide-y">
            {meetings.map((m) => (
              <Link
                key={m.id}
                href={`/meetings/${m.id}`}
                className="flex flex-wrap items-center gap-3 px-5 py-4 hover:bg-muted/60"
              >
                <span className="hidden rounded-lg border p-2.5 text-muted-foreground sm:block">
                  <ClipboardCheck size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{meetingTitle(m)}</span>
                    {m.isDemo && <StatusBadge>{tx("Preloaded demo")}</StatusBadge>}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tx(templates.find((t) => t.id === m.templateId)!.name)} ·{" "}
                    {m.requirements.items.filter((r) => r.level === "required").length}{" "}
                    {tx("required outcomes")}
                  </p>
                </div>
                <LifecycleBadge lifecycle={m.lifecycle} />
                <ArrowRight size={15} className="text-muted-foreground" />
              </Link>
            ))}
          </div>
        </section>
        <AboutDemo />
        <footer className="flex items-center justify-between border-t pt-5 text-xs text-muted-foreground">
          <span>{tx("MeetDone · Meetings with a finish line.")}</span>
          <span>{tx("Frontend demo · v0.1")}</span>
        </footer>
      </main>
      {creating && <CreateMeeting templateId={creating} onClose={() => setCreating(null)} />}
    </>
  );
}
