import { createMeeting } from "./meeting-factory";
import { launchDiscussion, retroDiscussion, customerDiscussion } from "./demo-transcripts";
import { compileGoalRequirements, documentGoals } from "./goal-configuration";

const documents: Record<string, string> = {
  launch:
    "评估收藏提醒功能能否在下周一上线。\n议题：功能范围、技术准备和回滚风险\n结论：产品与技术对发布准备情况达成共识\n决策：明确下周一上线或暂缓上线\n发言人：Sun（销售）\n行动项：发送发布通知\n行动项：发布上线监控清单",
  retro:
    "回顾两周迭代，确定下一轮可以验证的改进。\n议题：交付结果和协作阻力\n结论：确认需求、设计和验收标准不同步的主要问题\n决策：选择下一轮要尝试的一项改进\n行动项：试行五个固定场景的共同验收清单",
  customer:
    "确认十人客户试点的进展、验收条件和下一里程碑。\n议题：项目进度和客户使用反馈\n结论：明确试点范围与非关键改进的边界\n决策：确认十人培训验收的日期和标准\n行动项：更新里程碑计划",
};
const stageGoals: Record<string, string[]> = {
  launch: [
    "确认收藏提醒的发布范围",
    "说明产品和技术准备情况",
    "确认重复提醒、灰度和回滚风险",
    "决策：明确是否按计划上线",
    "确认发布通知与监控清单的负责人、日期",
  ],
  retro: [
    "回顾本轮交付结果",
    "讨论共同验收清单的改进建议",
    "明确标准不同步带来的返工风险",
    "确认下一轮采用的改进",
    "明确改进负责人和截止日期",
  ],
  customer: ["确认十人试点进度", "确认筛选体验反馈与验收范围", "确认培训验收日期和计划负责人"],
};

// Samples contain meeting content only. Analysis always requires an explicit AI request.
export function sampleMeetings() {
  return [
    { id: "launch", lines: launchDiscussion },
    { id: "retro", lines: retroDiscussion },
    { id: "customer", lines: customerDiscussion },
  ].map(({ id, lines }) => {
    const meeting = createMeeting(id, `demo-${id}`, true);
    const goals = documentGoals(documents[id]);
    const structure = structuredClone(meeting.structure);
    const stages = structure.type === "time" ? structure.segments : structure.stages;
    stages.forEach((stage, i) => {
      stage.goals = [{ id: `${id}-goal-${i}`, text: stageGoals[id][i] ?? "" }];
    });
    return {
      ...meeting,
      configurationVersion: 2 as const,
      goals,
      structure,
      requirements: compileGoalRequirements(goals, structure, meeting.participants),
      transcript: {
        text: lines.map((line) => `${line.speaker}：${line.text}`).join("\n\n"),
        revision: 1,
        scenarioId: null,
      },
    };
  });
}
