"use client";
import { useState } from "react";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Meeting } from "@/lib/models";
import { useI18n } from "./language-provider";
import { useWorkspace } from "./workspace-store";
import { AppHeader, LoadingWorkspace, Notice, meetingStatus } from "./shared";
import { Button } from "./ui/button";
import { CreateMeeting } from "./create-meeting";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./ui/dialog";

export function Home() {
  const { t: tx, title } = useI18n();
  const { loaded, meetings, warning, resetDemo, deleteMeeting } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Meeting | null>(null);
  if (!loaded) return <LoadingWorkspace />;
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-3xl px-5 py-10 sm:py-14">
        {warning && <Notice error>{warning}</Notice>}
        <section className="mb-12">
          <h1 className="text-3xl font-semibold tracking-tight">MeetDone</h1>
          <p className="mt-3 max-w-xl text-base leading-7 text-muted-foreground">
            {tx(
              "Before the meeting ends, make sure the discussion, decisions, and responsibilities are complete.",
            )}
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link
                href="/meetings/demo-launch"
                onClick={() => {
                  if (!meetings.some((m) => m.id === "demo-launch")) resetDemo();
                }}
              >
                {tx("Try Demo Meeting")}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setCreating(true)}>
              {tx("Create Meeting")}
            </Button>
          </div>
        </section>
        <section>
          <h2 className="mb-3 text-sm font-semibold">{tx("Your meetings")}</h2>
          <div className="divide-y border-y">
            {meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-2">
                <Link
                  href={`/meetings/${m.id}`}
                  className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-x-5 gap-y-2 py-4 hover:text-primary"
                >
                  <span className="min-w-0 break-words text-sm font-medium">{title(m)}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {tx(meetingStatus(m))}
                  </span>
                </Link>
                <Button
                  size="icon"
                  variant="ghost"
                  aria-label={`${tx("Delete meeting")}: ${title(m)}`}
                  onClick={() => setDeleting(m)}
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
            {meetings.length === 0 && (
              <p className="py-5 text-sm text-muted-foreground">{tx("No meetings yet.")}</p>
            )}
          </div>
        </section>
      </main>
      {creating && <CreateMeeting templateId="launch" onClose={() => setCreating(false)} />}
      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tx("Delete this meeting?")}</DialogTitle>
            <DialogDescription>
              {tx("This removes the meeting and its saved record from this browser.")}
            </DialogDescription>
          </DialogHeader>
          <p className="break-words font-medium">{deleting && title(deleting)}</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>
              {tx("Cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (deleting) deleteMeeting(deleting.id);
                setDeleting(null);
              }}
            >
              {tx("Delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
