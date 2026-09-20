"use client";
import { useI18n } from "@/components/language-provider";
import Link from "next/link";
export default function NotFound() {
  const { t: tx } = useI18n();

  return (
    <main className="app-page">
      <h1 className="text-2xl font-semibold">{tx("Page not found")}</h1>
      <p className="my-4 text-muted-foreground">{tx("Return to your meeting workspace.")}</p>
      <Link className="underline" href="/">
        {tx("Back to MeetDone")}
      </Link>
    </main>
  );
}
