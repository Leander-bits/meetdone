import { describe, expect, it } from "vitest";
import { readinessAction } from "@/lib/readiness-action";
import { sampleMeetings } from "@/lib/sample-meetings";
import {
  analyzeMeeting,
  freshDemo,
  loadScenario,
  updateRequirements,
  updateTranscript,
} from "./fixtures/meeting-state";
import { translate } from "@/lib/i18n";

describe("readiness action", () => {
  it("offers preparation before analysis and shows the shared pending state", () => {
    const m = sampleMeetings()[0];
    expect(readinessAction(m)).toBe("Prepare to End Meeting");
    expect(readinessAction(m, true)).toBe("Analyzing");
    expect(m.analysis).toBeNull();
  });
  it("offers ending only for current, ready analysis", () => {
    const m = analyzeMeeting(loadScenario(freshDemo(), "launch-complete"));
    expect(readinessAction(m)).toBe("End Meeting");
    expect(readinessAction(freshDemo())).toBe("Not Ready to End");
    expect(readinessAction(m, false, true)).toBe("Prepare to End Meeting");
    m.analysis!.transcriptRevision -= 1;
    expect(readinessAction(m)).toBe("Prepare to End Meeting");
  });
  it("returns to preparation after transcript or requirement changes", () => {
    const m = analyzeMeeting(loadScenario(freshDemo(), "launch-complete"));
    expect(readinessAction(updateTranscript(m, "Additional discussion"))).toBe(
      "Prepare to End Meeting",
    );
    expect(readinessAction(updateRequirements(m, m.requirements))).toBe("Prepare to End Meeting");
  });
  it("localizes every readiness state consistently", () => {
    const states = ["Prepare to End Meeting", "Analyzing", "End Meeting", "Not Ready to End"];
    expect(states.map((s) => translate("zh", s))).toEqual([
      "准备结束会议",
      "分析中",
      "结束会议",
      "暂不能结束",
    ]);
    expect(states.map((s) => translate("en", s))).toEqual(states);
  });
});
