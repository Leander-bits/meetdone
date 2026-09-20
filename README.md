# MeetDone

Know if your meeting is actually done. / 确认你的会议是否真正完成。

MeetDone checks meeting goals, required input, decisions and accountable actions before the host ends a meeting. Text transcripts are the input: paste, edit, import UTF-8 `.txt`, or use the prebuilt examples. No authentication or database is required.

## Run locally

Node.js 20.9+ and npm (verified on Node 24):

```sh
npm ci
npm run dev
```

Open http://localhost:3000. All three sample meetings can be opened and edited without a key. Analysis requires DeepSeek configuration and an explicit click on AI Analyze Meeting.

## DeepSeek and Vercel

Create `.env.local` **beside `package.json` in the project root**. For this workspace:

```text
C:\Users\32609\Documents\Documents\meetdone\.env.local
```

```dotenv
DEEPSEEK_API_KEY=your_real_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

`.env.example` contains the same variable names without a key. Never commit `.env.local` or use a `NEXT_PUBLIC_` key. Restart `npm run dev` after changing environment variables.

For Vercel, import as a Next.js project, use `npm run build`, and add the three variables above in **Project → Settings → Environment Variables**, selecting Production/Preview as needed. Deploy again after changing them. The server route declares a 60-second duration; upstream timeout is 45 seconds. No storage service or database configuration is needed.

## Architecture

```text
Meeting goals + configured structure
                 ↓ compileRequirements
MeetingRequirements + Transcript
                 ↓ AnalysisProvider
Validated MeetingAnalysis + verbatim evidence
                 ↓ deterministic TypeScript rule engine
CompletionCheck → UI → explicit end action → summary.md
```

- Analysis is AI-only. Mock extraction and fixed analysis fixtures live under `tests/fixtures/`; they are never loaded by the application.
- `DeepSeekAnalysisProvider` lives in `lib/server/` and imports `server-only`. The browser calls `POST /api/analyze-meeting`. The API key is read only via `process.env.DEEPSEEK_API_KEY`.
- Zod validates requests, model output and normalized analysis. Quotes and speaker attribution are verified against numbered transcript lines. Unsupported findings remain missing; unsupported owners/deadlines are null.
- The model extracts facts, never readiness. Presence is not an opinion; discussion is not a decision. Required matrix participation is evaluated per stage. Order is guidance only.
- Transcript/requirement changes clear analysis and completion. Action edits invalidate completion. Stale asynchronous responses are rejected.
- Blocking gaps are limited to missing required outcomes and evidenced critical issues. Recommended requirements and incidental commitments are follow-ups; record-only requirements do not gate completion.
- Action outputs support `requireOwner` and `requireDeadline`. Omitted flags default to `true` for existing meetings/templates. Only enabled fields are validated; incidental actions with missing fields remain follow-ups. The action-field check can say No while overall readiness is READY.
- Unresolved issues carry extraction facts (`preventsOutcome`, `criticalEvidenceId`). The engine checks requirement priority and current evidence; a legacy `blocking` flag alone is insufficient. Explicit critical statements can block without a requirement link. The provider never determines readiness.
- Exceptions require a reason and remain `ended_with_exceptions` with blocked readiness. Conversion to an owned, dated action only defers requirements that explicitly allow it.

The provider contract and rule engine remain separate; another extraction provider can use the same boundary.

## Data model and creation flow

Templates contain reusable names, structure types, default goals/stages, abstract roles and rules. They contain no actual attendees, email lists, meeting schedule or transcript. Meetings own those fields, their configured goals/structure, compiled requirements, extracted analysis, actions, exceptions and summary.

The full-screen creation flow has three pages:

1. Name, date, start/end time, IANA timezone and participants. Email suggests an editable display name. Discarding entered data requires confirmation.
2. Select a built-in/custom template or start a blank custom template. Only custom templates can be deleted, after confirmation.
3. Edit goals and select a structure. The first goal is protected. Meeting Rules are always visible in Topics, Required Conclusions, Decisions, Action Outputs order; Save as Template is available here, outside the selection page.

Four structures:

| Structure         | Configuration and validation                                                                                                                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Time Sequence     | 5-minute segments cover the entire meeting. Resizing borrows time from adjacent segments. Adding borrows five minutes; deleting transfers time to an adjacent segment. Reordering never changes total duration. |
| Speaker Sequence  | Circular speaker flow with independent role/required controls, responsive wrapping, drag ordering and reset. Out-of-order input still counts.                                                                   |
| Stage Progression | Named stages, optional goals, custom stages, reorder and reset. Stage coverage is required; recommended goals generate follow-ups.                                                                              |
| Stage × Speaker   | Participants assigned to one or more stages; requirement level and order are independent in each stage. Every stage needs an assignment.                                                                        |

Shared dnd-kit handles support mouse, touch and keyboard reordering (Space to pick up/drop, arrows to move, Escape to cancel), without visible arrow buttons. Matrix assignment also supports a select control and click-to-select chips. Stages, segments, speakers and rule inputs are numbered in their current order. Structure goals use letters, example placeholders and plus-icon add controls; empty values remain allowed and the first input cannot be deleted. Structure editors appear only after selection, and switching retains entered configuration. Creation and editing share these controls. Deferral uses an icon toggle with a tooltip. Invalid start/end times are highlighted immediately without changing input.

Schedules currently cover same-day meetings from 5 minutes to 12 hours, in five-minute increments. Timezone is stored with the meeting; there is no calendar invitation or scheduling integration.

## Workspace and demos

The home page has a compact bilingual product header, Create Meeting and Existing Meetings modules, and four short help steps. Home, creation/editing overlays, workspace, analysis and summary use the available viewport width with responsive padding; long prose retains a readable line length. Participant rows reserve identical delete-control space, including the protected first row. First use loads three fully configured fictional meetings with Chinese dialogue and no analysis:

- Mobile feature launch review: time sequence. The sample intentionally leaves Sales input, a final decision, an action owner and a deadline unresolved. Add discussion in the editor and re-analyze to resolve them.
- Two-week sprint retrospective: stage progression, with a deferred tooling topic.
- Customer onboarding progress: stage/speaker matrix, with noncritical follow-ups.

The workspace shows transcript and numbered requirements side by side, followed by one full-width analysis section. Prepare to End Meeting runs the same AI request as AI Analyze Meeting, without requiring a separate analysis click. After a successful request, the top button becomes End Meeting or Not Ready to End. Ending remains an explicit second action; failures offer preparation again. Reopening a saved meeting keeps its analysis visible and offers a fresh preparation check. Point-by-point evidence, six final evaluation questions and blocking/follow-up issues come from structured state.

Continue Discussion focuses the transcript. Convert Gap to Action Item requires description, owner and date. Blocked meetings require End with Exception and a reason. Ready meetings have End Meeting. The end action runs the current deterministic check before committing a lifecycle change.

Ending automatically downloads a UTF-8 Markdown summary through the browser's normal download mechanism, named `MeetDone_<meeting name>_<date>.md`. The summary includes original goals, supported conclusions and decisions, actions/owners/deadlines, open issues, risks, exceptions and final status. Export summary allows another download; reloading does not trigger duplicates.

## Bilingual UI

Chinese is the default. 中文 / EN is persisted under `meetdone.language`. The central dictionary is `lib/i18n.ts`; no internationalization service is needed. Built-in text carries provenance so switching language changes its display. Editing built-in text removes that provenance. User-entered content and transcript evidence are never automatically translated.

## Persistence and migration

- `meetdone.workspace.v1` now stores envelope **version 3**; versions 1 and 2 are read per record.
- `meetdone.templates.v1` stores envelope **version 2**, with legacy custom-template migration.
- Older meetings retain their requirements, transcript and existing summary. Missing scheduling/participant metadata is marked for review, without fabricating actual people. Corrupt records do not prevent valid records loading. Duplicate IDs are rejected.
- Active cached completion results are recalculated with the current rules; historical ended summaries remain unchanged.
- Active legacy mock analyses are cleared on load, along with mock actions and completion checks; original content and host-created actions remain. Genuine AI analyses and historical ended summaries are preserved. Archived mock summaries display as saved summaries, never as AI results.
- Recovery copies use `meetdone.workspace.recovery` and `meetdone.templates.recovery` when browser storage permits. The first backup is preserved.
- Meeting/template deletion requires UI confirmation. Cancel does not write. Template deletion never deletes meetings. Deleting every meeting preserves an empty workspace.
- Storage errors leave current in-memory work usable and display a warning. Browser storage is local to the current origin/browser; there is no account synchronization.

## Transcript analysis and limitations

For a custom transcript, configure DeepSeek, create/open a meeting, paste speaker-labeled text or import `.txt`, then click AI Analyze Meeting. Inspect evidence and unresolved issues before ending.

- Transcript limit: 30–50,000 characters; request limit: 650,000 bytes; 80 compiled requirements; maximum label length 500 characters.
- Invalid extension, malformed UTF-8, binary content, read failures and oversized imports leave the current editor unchanged. Oversized pasted content stays editable and is never truncated.
- Missing key, timeout, provider failure or malformed evidence returns a short localized error. No fallback or fabricated findings are produced. The transcript remains editable for another AI attempt.
- Deadlines must be explicit ISO dates (`YYYY-MM-DD`); relative dates remain unknown. Semantic extraction can still be wrong even when a quote is valid, so evidence remains inspectable.
- No audio/video upload, recording, Teams, Feishu, Zoom or Google Meet APIs. `lib/live-transcription.ts` isolates a future Deepgram/STT contract: Microphone → STT/diarization → Transcript → existing pipeline. Real capture would require private server-side credentials, session authorization, transport and real-audio testing.
- No durable rate limiting or authentication. Limits bound each analysis request, not aggregate provider spend.

## Files

```text
app/                       Two product routes + server analysis route
components/
  home.tsx                 Two modules and confirmed meeting deletion
  create-meeting.tsx        Three-page creation overlay
  structure-editor.tsx     Four editors, goals, ordering and assignment
  meeting-rules-editor.tsx  Reusable rules and deferral settings
  meeting-workspace.tsx     Two-column input + single analysis section
  transcript-panel.tsx     Text import and explicit AI analysis
  gap-check.tsx             Conversion and explicit exceptions
  meeting-summary.tsx      Structured summary and re-download
  language-provider.tsx, workspace-store.tsx
lib/
  models.ts, meeting-structure.ts, templates.ts, custom-templates.ts
  demo-configuration.ts, demo-transcripts.ts, sample-meetings.ts, meeting-factory.ts
  analysis-contract.ts, analysis-provider.ts, analysis-client.ts
  server/deepseek-provider.ts, server/extraction.ts
  rule-engine.ts, meeting-state.ts, final-evaluation.ts
  storage.ts, summary-download.ts, i18n.ts
tests/, e2e/                Unit, API/provider and browser regression tests
```

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Playwright starts an isolated production server on port 3100 (`PLAYWRIGHT_PORT` overrides it). Build first. For installed Chrome on Windows:

```powershell
$env:PLAYWRIGHT_CHANNEL = 'chrome'
npm run test:e2e
```

Provider failure and structured extraction tests use mocked upstream responses. Browser AI success uses an intercepted API response; a real credentialed DeepSeek call must be verified separately when a key is available.
