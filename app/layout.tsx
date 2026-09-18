import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/workspace-store";
import { LanguageProvider } from "@/components/language-provider";
import "./globals.css";
export const metadata: Metadata = {
  title: "MeetDone · 确认你的会议是否真正完成",
  description: "Check goals, decisions, speaker inputs, and action items before your meeting ends.",
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <LanguageProvider>
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
