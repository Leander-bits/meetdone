"use client";
import { useState } from "react";
import Link from "next/link";
import { Trash2, Plus, CircleHelp } from "lucide-react";
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
  const { loaded, meetings, warning, deleteMeeting } = useWorkspace();
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<Meeting | null>(null);
  if (!loaded) return <LoadingWorkspace />;
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-5 py-8 sm:py-16">
        {warning && <Notice error>{warning}</Notice>}
        <div className="grid gap-6 md:grid-cols-2">
          <section className="relative aspect-square rounded-2xl border bg-white transition-colors hover:border-primary/50">
            <button
              onClick={() => setCreating(true)}
              className="flex h-full w-full flex-col items-center justify-center gap-6 rounded-2xl focus-visible:outline-2 focus-visible:outline-primary"
            >
              <Plus strokeWidth={1.3} className="h-20 w-20 text-primary" />
              <h1 className="text-xl font-semibold">{tx("Create Meeting")}</h1>
            </button>
            <button
              popoverTarget="create-help"
              aria-label={tx("About MeetDone")}
              className="absolute bottom-4 right-4 rounded-full p-2 text-muted-foreground hover:bg-muted"
            >
              <CircleHelp size={19} />
            </button>
            <div
              id="create-help"
              popover="auto"
              className="m-auto max-w-xs rounded-xl border bg-white p-5 text-sm leading-6 shadow-lg backdrop:bg-black/10"
            >
              {tx(
                "Before the meeting ends, make sure the discussion, decisions, and responsibilities are complete.",
              )}
            </div>
          </section>
          <section
            className="flex aspect-square min-h-80 flex-col rounded-2xl border bg-white p-6"
            aria-labelledby="existing-meetings"
          >
            <h2 id="existing-meetings" className="mb-5 text-xl font-semibold">
              {tx("Existing Meetings")}
            </h2>
            <div className="min-h-0 flex-1 divide-y overflow-y-auto">
              {meetings.map((m) => (
                <div key={m.id} className="flex items-center gap-2 py-4">
                  <Link href={`/meetings/${m.id}`} className="min-w-0 flex-1 hover:text-primary">
                    <p className="break-words text-sm font-medium">{title(m)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.date} · {tx(meetingStatus(m))}
                    </p>
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
              {!meetings.length && (
                <p className="py-5 text-sm text-muted-foreground">{tx("No meetings yet.")}</p>
              )}
            </div>
          </section>
        </div>
      </main>
      {creating && <CreateMeeting onClose={() => setCreating(false)} />}
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
