import { createMeeting } from "./meeting-factory";
import { launchDiscussion, retroDiscussion, customerDiscussion } from "./demo-transcripts";

// Samples contain meeting content only. Analysis always requires an explicit AI request.
export function sampleMeetings() {
  return [
    { id: "launch", lines: launchDiscussion },
    { id: "retro", lines: retroDiscussion },
    { id: "customer", lines: customerDiscussion },
  ].map(({ id, lines }) => ({
    ...createMeeting(id, `demo-${id}`, true),
    transcript: {
      text: lines.map((line) => `${line.speaker}：${line.text}`).join("\n\n"),
      revision: 1,
      scenarioId: null,
    },
  }));
}
