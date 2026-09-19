import { MAX_TRANSCRIPT_LENGTH } from "./analysis-contract";

// Browser-side contract only. A future Deepgram transport must obtain short-lived
// session authorization from our server; never accept a permanent provider key here.
export type LiveUtterance = {
  id: string;
  speakerId: string;
  text: string;
  isFinal: boolean;
  startMs: number;
  endMs: number;
};
export type SpeakerNames = Record<string, string>;
export type LiveSession = {
  sendAudio: (chunk: Blob) => void;
  stop: () => Promise<void>;
};
export interface LiveTranscriptionProvider {
  readonly provider: "deepgram";
  readonly available: boolean;
  start(options: {
    language: "zh" | "en";
    mimeType: string;
    signal: AbortSignal;
    onUtterance: (utterance: LiveUtterance) => void;
    onError: (code: "UNAVAILABLE" | "CONNECTION_LOST") => void;
  }): Promise<LiveSession>;
}
export const preparedDeepgramProvider: LiveTranscriptionProvider = {
  provider: "deepgram",
  available: false,
  async start() {
    throw new Error("LIVE_TRANSCRIPTION_UNAVAILABLE");
  },
};
// A transport passes finalized, diarized utterances here before using updateTranscript.
// Keep transport and speaker mapping independent of extraction and readiness.
export function appendLiveUtterance(
  transcript: string,
  seenIds: readonly string[],
  utterance: LiveUtterance,
  names: SpeakerNames,
): { text: string; seenIds: string[] } {
  if (!utterance.isFinal || !utterance.text.trim() || seenIds.includes(utterance.id))
    return { text: transcript, seenIds: [...seenIds] };
  const speaker = names[utterance.speakerId]?.trim() || utterance.speakerId;
  const text = [transcript, `${speaker}: ${utterance.text.trim()}`].filter(Boolean).join("\n");
  if (text.length > MAX_TRANSCRIPT_LENGTH) throw new Error("TRANSCRIPT_TOO_LONG");
  return { text, seenIds: [...seenIds, utterance.id] };
}
