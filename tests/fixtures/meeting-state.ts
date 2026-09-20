export * from "../../lib/meeting-state";
import { applyAnalysis, updateTranscript } from "../../lib/meeting-state";
import { Meeting } from "../../lib/models";
import { createMeeting, scenarios } from "./demo";
import { demoAnalysisProvider } from "./analysis-provider";
export function analyzeMeeting(m: Meeting): Meeting {
  const analysis = demoAnalysisProvider.analyze(m);
  return applyAnalysis(m, analysis);
}
export function loadScenario(m: Meeting, id: string): Meeting {
  const scenario = scenarios.find((s) => s.id === id && s.templateId === m.templateId);
  if (!scenario) throw new Error("Scenario does not match this meeting template.");
  const updated = updateTranscript(m, scenario.transcript);
  return { ...updated, transcript: { ...updated.transcript, scenarioId: id } };
}
export function freshDemo(): Meeting {
  return analyzeMeeting(
    loadScenario(createMeeting("launch", "demo-launch", true), "launch-incomplete"),
  );
}

export function freshDemos(): Meeting[] {
  return [
    freshDemo(),
    ...["retro", "customer"].map((id) =>
      analyzeMeeting(loadScenario(createMeeting(id, `demo-${id}`, true), `${id}-complete`)),
    ),
  ];
}
