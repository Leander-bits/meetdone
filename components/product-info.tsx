"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { sampleMeetings } from "@/lib/sample-meetings";
import { useI18n } from "./language-provider";
import { useWorkspace } from "./workspace-store";
import { Button } from "./ui/button";

export function ProductInfo() {
  const { locale, title } = useI18n();
  const { saveMeeting } = useWorkspace();
  const router = useRouter();
  const [review, setReview] = useState(false);
  const text = (zh: string, en: string) => (locale === "zh" ? zh : en);
  return (
    <section
      className="mt-8 space-y-5 border-t pt-6"
      aria-label={text("测试与产品说明", "Try it and product details")}
    >
      <div>
        <h2 className="font-semibold">{text("测试入口 · 模拟会议", "Try sample meetings")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {text(
            "Mock：预置会议与记录是虚构示例；分析调用真实 AI，不提供模拟分析结果。点击案例会创建独立副本。",
            "Mock: sample meetings and transcripts are fictional. Analysis uses the real AI service, never simulated results. Each sample opens a fresh copy.",
          )}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {sampleMeetings().map((m) => (
            <Button
              key={m.id}
              variant="outline"
              className="h-auto whitespace-normal text-left"
              onClick={() => {
                const copy = { ...m, id: crypto.randomUUID() };
                saveMeeting(copy);
                router.push(`/meetings/${copy.id}`);
              }}
            >
              {title(m)}
            </Button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {text(
            "上线案例保留销售意见、上线决定、负责人和日期缺口；追加示例讨论后再次分析。复盘与客户案例展示主要结果已确认、次要问题会后跟进。",
            "The launch sample leaves sales input, the launch decision, an owner and a deadline unresolved. Append the sample follow-up and analyze again. The retrospective and customer samples distinguish agreed outcomes from secondary follow-ups.",
          )}
        </p>
      </div>
      <details className="text-sm leading-7">
        <summary className="cursor-pointer font-medium">
          {text("功能说明、Mock 标识与已知限制", "Features, mock data and known limitations")}
        </summary>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>
            {text(
              "填写会议目标（可写议题、结论、决策、行动项），选择结构并配置阶段目标或必须发言者。没有单独的会议规则表单。",
              "Write meeting goals, including topics, conclusions, decisions and actions; choose a structure and configure stage goals or required speakers. There is no separate rules form.",
            )}
          </li>
          <li>
            {text(
              "粘贴或导入 UTF-8 TXT 记录，最多 50,000 字符。点击 AI 分析或准备结束会议，逐项查看覆盖状态、引用证据和六项结束检查。",
              "Paste or import UTF-8 TXT transcripts, up to 50,000 characters. AI Analyze Meeting and Prepare to End Meeting show coverage, quoted evidence and six final checks.",
            )}
          </li>
          <li>
            {text(
              "AI 提取事实，确定性校验决定是否阻塞。未完成的必要结果会阻塞；普通行动项缺负责人或日期通常列为会后跟进。例外结束必须填写理由，结束后下载 Markdown 总结。",
              "AI extracts facts; deterministic validation decides readiness. Missing required outcomes block; incomplete incidental actions are follow-ups. Exceptions require a reason. Ending downloads a Markdown summary.",
            )}
          </li>
          <li>
            {text(
              "Mock 仅指示例内容。真实分析需要服务器配置 DeepSeek；调用失败会显示错误（如果失败请再次尝试），不生成虚假结果。请先脱敏敏感记录，提交的目标、发言者和记录会发送给分析服务。",
              "Mock refers only to sample content. Real analysis requires server-side DeepSeek configuration. Failures show an error (if failed, please try again) without fabricated results. Remove sensitive information before submitting goals, participants and transcripts to the analysis service.",
            )}
          </li>
          <li>
            {text(
              "数据保存在当前浏览器 localStorage，不支持账号、跨设备同步或数据库。清除浏览器数据会删除记录。中文/English 仅切换界面，不翻译输入内容。",
              "Data stays in this browser's localStorage; there are no accounts, database or cross-device sync. Clearing browser data removes records. Language switching does not translate entered content.",
            )}
          </li>
          <li>
            {text(
              "尚未实现：实时录音转写、音视频上传、Teams/飞书/Zoom/Google Meet 接入，以及不经点击的主动实时提醒。可在会中更新文本后手动分析；相对日期暂不自动推算，请写明日期。AI 提取可能遗漏或误判，请核对证据。",
              "Not implemented: live transcription, audio/video upload, Teams/Feishu/Zoom/Google Meet integration, or automatic live prompts. During a meeting, update the text and analyze manually. Relative dates are not inferred; use explicit dates. AI extraction can miss or misclassify facts; review the evidence.",
            )}
          </li>
        </ul>
      </details>
      <details onToggle={(e) => setReview(e.currentTarget.open)}>
        <summary className="cursor-pointer text-sm font-medium">
          {text("产品调研与设计复盘", "Product research and design review")}
        </summary>
        {review && (
          <iframe
            title={text("MeetDone 设计复盘", "MeetDone design review")}
            src={`/design-review-${locale}.html`}
            sandbox="allow-popups"
            className="mt-4 h-[680px] w-full rounded-xl border bg-card"
          />
        )}
      </details>
    </section>
  );
}
