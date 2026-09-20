import { MeetingAnalysis } from "./models";
import { AnalysisInput } from "./analysis-contract";

export interface AnalysisProvider<Result = MeetingAnalysis | Promise<MeetingAnalysis>> {
  analyze(meeting: AnalysisInput): Result;
}
