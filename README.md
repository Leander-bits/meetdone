# MeetDone

**Know if your meeting is actually done. / 确认你的会议是否真正完成。**

MeetDone checks predefined goals, conclusions, topics, relevant speaker input, explicit decisions, and accountable actions **before a meeting ends**. The central interaction is **准备结束会议 / Prepare to End Meeting**.

## Primary input: text transcript

Type or paste meeting discussion, import a UTF-8 `.txt` file, or load a built-in demo transcript. Text is the sole input in this phase. There is no audio/video/recording upload or live microphone input.

```mermaid
flowchart LR
  R[Meeting requirements] --> P[Analysis provider]
  T[Text transcript] --> P
  P --> A[Validated MeetingAnalysis with evidence]
  A --> E[Deterministic rule engine]
  R --> E
  E --> C[CompletionCheck]
  C --> U[Coverage and readiness UI]
```

The LLM extracts and classifies facts. It never decides readiness, grants exceptions, or authorizes ending. The existing deterministic rule engine remains the only source of readiness decisions. No authentication or database has been added.

## Run locally

Requires Node.js 20.9+ and npm; verified with Node 24.

```sh
npm ci
npm run dev
```

Open [localhost:3000](http://localhost:3000). The preloaded demo works without environment variables or API credentials.

## Exact DeepSeek configuration

Create **`.env.local` in the project root, alongside `package.json`**. In this workspace the exact path is:

```text
C:\Users\32609\Documents\Documents\meetdone\.env.local
```

Copy `.env.example` to `.env.local`, then fill in your own key:

```dotenv
DEEPSEEK_API_KEY=your_real_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

`DEEPSEEK_API_KEY` is required for AI analysis. The URL and model shown above are also the runtime defaults if those two variables are omitted. Use plain URLs, without Markdown brackets. **Restart the local development server after adding or changing `.env.local`**: stop it with Ctrl+C, then run `npm run dev` again.

The key is read only by `lib/server/deepseek-provider.ts` using `process.env.DEEPSEEK_API_KEY`. This module imports `server-only`. The browser calls `/api/analyze-meeting`, never DeepSeek directly. Do not create `NEXT_PUBLIC_DEEPSEEK_API_KEY`. `.env.local` is ignored by Git; `.env.example` contains no real key and is explicitly allowed in `.gitignore`.

## Vercel configuration

1. Import the repository as a **Next.js** project. Use the project root and build command `npm run build`.
2. Open **Project → Settings → Environment Variables**.
3. Add the following three variables. Select **Production** and **Preview**, plus **Development** if you use Vercel's local environment tooling.

   | Name                | Value                      |
   | ------------------- | -------------------------- |
   | `DEEPSEEK_API_KEY`  | Your real DeepSeek API key |
   | `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` |
   | `DEEPSEEK_MODEL`    | `deepseek-chat`            |

4. Keep the API key private; mark it sensitive where the dashboard supports this. Do not use any `NEXT_PUBLIC_` prefix.
5. **Deploy or redeploy** after saving/changing the variables. Existing deployments do not pick up new values automatically. See [Vercel environment variable management](https://vercel.com/docs/environment-variables/managing-environment-variables).

The API route uses the Node.js runtime, declares a 60-second function duration, and times out upstream requests after 45 seconds. Your Vercel plan must support that duration. No database or additional service deployment is required.

## Provider architecture

- **`AnalysisProvider`** retains the `analyze(input)` boundary and accepts synchronous or asynchronous providers. Its input contains only requirements, transcript/version, and template ID. Required speakers and action outputs are already included in the requirement array.
- **`MockAnalysisProvider`** returns fixed fixtures for exact, unchanged demo transcripts. It does not infer analysis for arbitrary custom text or changed requirement meanings.
- **`DeepSeekAnalysisProvider`** is a server-side OpenAI-compatible chat-completions adapter. It accepts a configurable HTTPS base URL/model and uses JSON output. See [DeepSeek JSON output documentation](https://api-docs.deepseek.com/guides/json_mode/).
- **`POST /api/analyze-meeting`** validates input, calls the provider, and returns `MeetingAnalysis` or a safe error code. It does not return a model-generated `CompletionCheck`.
- **Client state** stores validated analysis and runs the existing rule engine. Responses from an older transcript, requirement revision, or changed meeting state are rejected. Edits never silently reuse a stale readiness result.

The UI uses the generic analysis endpoint and distinguishes AI from demo mode. It does not import the DeepSeek implementation. Another compatible provider can use the same contract without changing the readiness rules.

### Structured extraction and evidence

Zod validates both the provider output and the normalized application model. The extraction schema rejects extra readiness fields.

- Required decisions are classified as `not_discussed`, `discussed_not_decided`, or `decided`. The adapter preserves this classification and maps it to the existing rule engine's `missing`, `discussed`, or `decided` status. Decided outcomes require evidence and a nonempty outcome.
- Speaker classifications distinguish `not_mentioned`, `present_no_opinion`, and `expressed_opinion`, mapped to the existing coverage statuses. Another person's quote cannot satisfy the required speaker's opinion.
- Positive coverage, actions, and unresolved issues require evidence. Quotes must exist verbatim on the cited transcript line, and speaker attribution is checked against that line.
- Owners and deadlines are `null` when absent or unsupported. Each populated value requires its own supporting evidence reference. Deadlines must be explicitly stated ISO dates (`YYYY-MM-DD`); relative deadlines are left unknown rather than guessed. Unstated action status is displayed as unknown.
- Missing findings are normalized to missing, never complete. Summary decisions and conclusions come from validated analysis; actions and exceptions may also contain explicit host input.

Evidence checks establish that text exists in the transcript. They cannot prove that every semantic interpretation is correct; the host can inspect excerpts before ending.

### Limits and failures

- Transcript: **30–50,000 characters**; request body: **650,000 bytes** maximum.
- Requirements: **80 total**, with labels up to **500 characters**.
- One request per button click, no automatic retries; output capped at 8,000 tokens.
- Upstream timeout: **45 seconds**; client timeout: **55 seconds**.
- Empty/short/long transcripts, missing credentials, timeout, provider errors, malformed output, and unsupported evidence all produce localized messages.
- Errors do not discard saved transcript text or replace it with invented analysis. The user can retry or select a demo scenario and choose **使用演示分析 / Use Demo Analysis**.

No durable rate limiter or authentication is included in this take-home MVP. A public deployment's AI endpoint can be invoked by visitors; transcript/output limits bound individual requests, not total account spend.

## Bilingual UI

**Simplified Chinese is the default.** Use **中文 / EN** in the header. The preference is stored under `meetdone.language`, survives reloads, and synchronizes between tabs.

`lib/i18n.ts` is the central UI dictionary; `components/language-provider.tsx` is a small subscription-based language layer. UI messages, validation/errors, template names/descriptions, and built-in requirement/default text have both languages. The document language and title update as well.

Built-in defaults carry provenance (`builtinKey` / `builtinTitle`), so they can display in either language without rewriting the underlying meeting. Editing a default removes that provenance. User-entered titles, requirements, transcripts, opinions, decisions, action descriptions, and exception reasons are **never automatically translated**. Transcript quotes and extracted details stay in their source language. The supplied Bosch-style demo transcripts and their evidence remain in natural Chinese. These are fictional examples, not actual Bosch meeting records.

## Dynamic requirements

The existing `MeetingRequirements.items: Requirement[]` discriminated array is preserved. Goals, conclusions, topics, speaker inputs, and action outputs are dynamic views over it, with stable unique IDs. There are no numbered fields or duplicated collections.

Every section has **Add item** and **Remove** controls. The five required list types must each contain at least one item. The final remove button is disabled, and state/server validation enforces the same minimum. Decisions and agenda also support dynamic entries. Required, recommended, record-only, and explicit deferral policies are retained.

Saving added/deleted/edited requirements increments the revision and clears analysis and completion results. Requirements are edited in a focused form; save or cancel before returning to the meeting. Transcript edits immediately invalidate analysis and completion; action edits invalidate the completion check. New requirement IDs persist in localStorage.

The workspace envelope is version 2 under the existing `meetdone.workspace.v1` key so Phase 1 data can be read and migrated. Legacy active lists missing a required type receive a default entry and their analysis is invalidated. Malformed storage falls back safely to a fresh demo; storage failures keep in-memory work and show a warning.

## Focused workspace and demo fallback

The home page contains the value proposition, demo/create actions, and saved meetings. Creation is a single form with a template selector and dynamic requirement lists. The workspace has three areas: requirements, transcript, and meeting status. Evidence, detailed coverage, action editing, and advanced requirement options expand on demand.

Only six meeting states appear: Not analyzed, Analyzing, Blocked, Ready to End, Ended with Exceptions, and Ended. Editing action items requires another end check. Ended meetings open directly to a compact summary; their original requirements and transcript remain available under Meeting record.

1. Click **体验 Demo / Try Demo Meeting**. Product Launch Scenario A is preloaded and analyzed.
2. Click **准备结束会议 / Prepare to End Meeting**. Inspect the four blockers: no input from Sun, no final Go / No-Go, a missing release-notice owner, and a missing monitoring-checklist deadline.
3. Edit action ownership/dates and recheck. A follow-up cannot erase a non-deferrable decision blocker.
4. Expand **加载演示场景 / Load Demo Scenario** below the transcript, load **场景 B / Scenario B**, then click **使用演示分析 / Use Demo Analysis**.
5. Prepare to end again, then generate the summary.
6. Reset Demo and try **带例外结束 / End with Exception**. A reason is mandatory; readiness remains blocked.

Retrospective and Customer Progress templates also have complete demo examples with recommended follow-ups. Demo mode never requires an API key. Loading a scenario explicitly replaces transcript text; merely pressing the fallback button on a custom transcript does not overwrite it. Changed custom requirements may remain uncovered by a demo fixture, as they should.

## Test a custom transcript

1. Configure `.env.local` and restart the dev server.
2. Open the launch demo (or create a meeting and define its requirements).
3. Paste a speaker-labeled transcript in **会议记录 / Transcript** and click **分析会议 / Analyze Meeting**.
4. The status area shows **AI 分析 / AI Analysis** and any blockers. Expand evidence, analysis details, or action items as needed. Readiness updates through the deterministic rules.
5. Click **准备结束会议 / Prepare to End Meeting** before ending. Editing the text requires a fresh analysis.

Example for the default Product Launch requirements:

```text
Devi · Product: CE T4 Station Data Editor 的产品验收通过，我支持本次生产上线。
Max · Engineering: 工程测试通过，回滚方案和值班安排已确认，我支持上线。
Sun · Operations: 现场培训和发布窗口已确认，业务这边支持上线。
Devi · Product: 我们一致确认当前版本具备生产上线条件。最终决定 Go，于 2026-09-25 上线。
Sun · Operations: 上线通知由 Sun 负责，截止日期为 2026-09-24。
Max · Engineering: 上线监控清单由 Max 负责，截止日期为 2026-09-24。
```

## File structure

```text
app/
  page.tsx, meetings/[id]/page.tsx      Two main product routes
  api/analyze-meeting/route.ts         Server-only analysis endpoint
components/
  language-provider.tsx              Persistent Chinese/English UI
  transcript-panel.tsx               AI analysis, loading, errors, demo fallback
  requirements-editor.tsx            Dynamic lists and minimum counts
  meeting-workspace.tsx              Workflow orchestration
  meeting-presentation.ts            Localized system gaps; untouched user content
  home.tsx, create-meeting.tsx        Bilingual entry and setup
  coverage.tsx, action-items.tsx      Evidence and commitments
  gap-check.tsx, meeting-summary.tsx  End checks, exceptions, summaries
  workspace-store.tsx, shared.tsx     Local workspace and shared UI
  ui/                               shadcn/ui components
lib/
  models.ts, templates.ts, demo.ts   Typed models and built-in fixtures
  demo-transcripts.ts                Four natural Chinese Bosch-style scenarios
  custom-templates.ts                Separate versioned template persistence
  transcript-import.ts               Strict UTF-8 decoding and import limits
  live-transcription.ts              Isolated future streaming STT contract
  i18n.ts, requirements.ts           Dictionaries and dynamic-list constraints
  analysis-contract.ts               Input limits, schema, safe error codes
  analysis-provider.ts               Provider interface and MockAnalysisProvider
  analysis-client.ts                 Generic browser API client
  server/deepseek-provider.ts        Private DeepSeek adapter and environment config
  server/extraction.ts               Prompt, output schema, evidence validation
  rule-engine.ts                     Deterministic readiness, preserved
  meeting-state.ts, storage.ts        Invalidation, persistence, migration
tests/, e2e/                         Unit, route, provider, and browser tests
.env.example                         Public variable names and defaults only
```

## Meeting and template management

Each meeting has a delete action on the home page. The confirmation names the meeting; cancel does not change localStorage. Deleting the last meeting leaves an empty workspace, rather than automatically recreating the demo. Try Demo Meeting can explicitly restore the launch demo.

Create Meeting keeps the three built-ins. Create New Template clears the title and starts with exactly one empty goal, conclusion, topic, speaker input, and action output. Save as Template makes a separate custom copy; Template options lets you edit its name and requirements, save it, or confirm deletion. Built-ins are protected in both UI and persistence helpers.

Custom templates use a separate versioned localStorage key, `meetdone.templates.v1`. Meetings store their own requirement snapshot, so editing or deleting a template cannot rewrite or delete an existing meeting. Custom template content is saved in the displayed language as user-owned text and never translated by switching the UI. The existing meeting storage version/key remains compatible.

## TXT import

Import .txt accepts UTF-8 text with an optional BOM, preserving line endings and displaying the filename after import and reload. Invalid extensions, nontext MIME types, binary control bytes, invalid UTF-8, unreadable files, and imports above 50,000 characters are rejected without replacing the current transcript. Imported text can be edited before analysis. Importing always clears the previous analysis/check.

Oversized pasted/typed content is retained for editing with an explicit error and disabled analysis; it is never silently truncated. Shorten it to 50,000 characters or fewer before analysis. Filenames stay in browser storage and are not sent to the AI provider. The request body allowance covers Chinese UTF-8 and requirement labels as well as the transcript.

## Live transcription preparation

`lib/live-transcription.ts` defines a provider/session contract for streaming audio, final utterances, diarized speaker IDs, stop/abort, and connection errors. Its pure append helper accepts only finalized utterances, deduplicates IDs, applies explicit speaker-name mappings, and enforces the transcript limit. The prepared Deepgram provider is deliberately unavailable: the optional Live Transcription entry says coming soon and never asks for microphone permission or implies that recording works.

Target flow: **Microphone → Streaming STT → Speaker Diarization → Live Transcript → existing analysis pipeline**. No transcription endpoint, capture, streaming transport, or recording UI is enabled in this phase. No new environment variable is needed for the delivered app; DeepSeek configuration is unchanged.

To activate Deepgram later, provide a private server-side `DEEPGRAM_API_KEY`, implement a server endpoint for short-lived session authorization, connect the microphone transport, and test Chinese/English diarization, interim/final boundaries, reconnection, start/stop, speaker mapping, and browser permissions on real audio. The permanent API key must never reach browser code. Deepgram documents [temporary tokens](https://developers.deepgram.com/guides/fundamentals/token-based-authentication) and the [streaming speech API](https://developers.deepgram.com/reference/speech-to-text/listen-streaming). No Teams, Feishu, Zoom, or Google Meet API integration is included.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

If the browser download is unavailable, use installed Chrome. PowerShell:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Browser tests start an isolated production server on port 3100; build first. Override the port with `PLAYWRIGHT_PORT` if needed. Provider/route tests mock upstream HTTP; browser AI-success/failure tests mock the application endpoint. They validate contracts and UX without spending API credits. A live DeepSeek call requires your real API key and is not part of the automated suite.

## Known limitations and future integrations

- AI may misinterpret discussion even when its quoted evidence is real. Inspect important decisions and speaker input.
- Speaker-labeled text and explicit ISO dates give the most reliable results. Unattributed speech and relative dates remain conservative/unknown.
- localStorage is browser/origin-specific; there is no shared workspace, cross-device sync, authentication, or database. Concurrent tabs use the latest stored workspace.
- Ended meetings preserve their state until the user confirms deletion. Demo reset affects only the preloaded launch meeting. Existing saved meetings are kept; use Reset Demo to replace an older sample with the new Bosch example.
- No audio upload, video upload, screen recording upload, live microphone streaming, Zoom, Microsoft Teams, or Google Meet integration.
- Future audio/live integrations would add **Audio / Live Meeting → Speech-to-Text → Transcript → Existing Analysis Pipeline**. They do not require moving readiness rules into the LLM.
