export const REVIEWER_TREE_ICONS = {
  folder: "folder",
  file: "file",
};

export const REVIEWER_TOOLS = [
  {
    id: "structure",
    label: "Analyze Structure",
    icon: "structure",
    scope: "project",
    thinking: [
      "Tracing the spine of the manuscript",
      "Measuring chapter pacing",
      "Looking for breaks in the arc",
      "Weighing structure against momentum",
    ],
  },
  {
    id: "prose",
    label: "Evaluate Prose",
    icon: "prose",
    scope: "node",
    thinking: [
      "Listening for sentence rhythm",
      "Checking clarity against atmosphere",
      "Looking for drag in the line work",
      "Testing the prose under pressure",
    ],
  },
  {
    id: "inconsistencies",
    label: "Find Inconsistencies",
    icon: "inconsistencies",
    scope: "project",
    thinking: [
      "Cross-checking facts and threads",
      "Comparing continuity across chapters",
      "Looking for drift in motive and detail",
      "Pressure-testing the manuscript logic",
    ],
  },
  {
    id: "summaries",
    label: "Chapter Summaries",
    icon: "summaries",
    scope: "project",
    thinking: [
      "Compressing each movement",
      "Capturing what each chapter carries",
      "Separating plot from texture",
      "Writing a clean map of the draft",
    ],
  },
  {
    id: "characters",
    label: "Character Map",
    icon: "characters",
    scope: "project",
    thinking: [
      "Charting character pressure points",
      "Following alliances and friction",
      "Mapping entrances, exits, and weight",
      "Checking who drives each movement",
    ],
  },
  {
    id: "genre",
    label: "Compare to Genre",
    icon: "genre",
    scope: "project",
    thinking: [
      "Mapping genre signals",
      "Checking market expectations",
      "Comparing tone against convention",
      "Checking conventions against the manuscript",
    ],
  },
];

const CHAT_THINKING_MESSAGES = [
  "Reading the current passage",
  "Tracing the tension under the scene",
  "Pulling patterns across the draft",
  "Shaping a reviewer-grade response",
];

export function getToolThinkingMessage(toolId, tick = 0) {
  const tool = REVIEWER_TOOLS.find((item) => item.id === toolId);
  const messages = tool?.thinking || CHAT_THINKING_MESSAGES;
  return messages[tick % messages.length];
}

export function getChatThinkingMessage(tick = 0) {
  return CHAT_THINKING_MESSAGES[tick % CHAT_THINKING_MESSAGES.length];
}

export function getReviewerTool(toolId) {
  return REVIEWER_TOOLS.find((tool) => tool.id === toolId) || null;
}
