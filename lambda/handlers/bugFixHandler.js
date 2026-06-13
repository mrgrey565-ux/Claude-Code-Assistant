"use strict";

const { generateBugFix } = require("../utils/claudeAPI");

const {
  parseClaudeResponse,
  generateReplacementGuide,
  createVoiceSummary,
  truncateForVoice,
} = require("../utils/codeFormatter");

const { createReplacementMap } = require("../utils/diffGenerator");

const {
  TASK_TYPES,
  setCurrentTask,
  setAwaitingPermission,
  saveGeneratedCode,
  addToConversationHistory,
  SESSION_KEYS,
  setSessionValues,
} = require("../utils/sessionManager");

/**
 * Handler for FixBugIntent
 */
const FixBugIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "FixBugIntent"
    );
  },

  async handle(handlerInput) {
    const { intent } = handlerInput.requestEnvelope.request;
    const slots = intent.slots;

    const bugDescription = slots.bugDescription?.value || "unknown bug";
    const componentName = slots.componentName?.value || "the component";

    console.log(`Fixing bug: ${bugDescription} in ${componentName}`);

    setCurrentTask(handlerInput, TASK_TYPES.FIX_BUG, {
      bugDescription,
      componentName,
    });

    addToConversationHistory(
      handlerInput,
      "user",
      `Fix bug: ${bugDescription} in ${componentName}`
    );

    const permissionContext = {
      action: "FIX_BUG",
      bugDescription,
      componentName,
    };

    setAwaitingPermission(handlerInput, permissionContext);

    const severityEstimate = estimateBugSeverity(bugDescription);

    const speakOutput =
      `I found a ${severityEstimate} issue in ${componentName}: ${bugDescription}. ` +
      `I will diagnose the root cause and generate a precise fix with the exact lines to change. ` +
      `May I proceed with the bug analysis and generate the fix? ` +
      `Say yes to generate the fix, or describe the issue differently if I misunderstood.`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(
        "Should I proceed with fixing the bug? Say yes to continue or no to cancel."
      )
      .getResponse();
  },
};

/**
 * Estimates bug severity based on description keywords
 */
function estimateBugSeverity(description) {
  const criticalKeywords = [
    "crash",
    "broken",
    "not working",
    "error",
    "fail",
    "down",
  ];
  const highKeywords = ["wrong", "incorrect", "missing", "lost", "deleted"];
  const mediumKeywords = [
    "slow",
    "laggy",
    "display",
    "visual",
    "style",
    "layout",
  ];

  const lower = description.toLowerCase();

  if (criticalKeywords.some((k) => lower.includes(k))) return "critical";
  if (highKeywords.some((k) => lower.includes(k))) return "high priority";
  if (mediumKeywords.some((k) => lower.includes(k))) return "visual";
  return "general";
}

/**
 * Executes bug fix generation after permission granted
 */
async function executeBugFix(handlerInput, permissionContext) {
  const { bugDescription, componentName } = permissionContext;

  try {
    const claudeResponse = await generateBugFix(
      bugDescription,
      componentName,
      null
    );

    if (!claudeResponse.success) {
      return {
        success: false,
        speech:
          `I had trouble analyzing the bug in ${componentName}. ` +
          `Error: ${claudeResponse.error}. Please try again.`,
      };
    }

    const parsedResponse = parseClaudeResponse(claudeResponse.content);

    if (!parsedResponse.success) {
      return {
        success: false,
        speech:
          "The bug analysis completed but the response format was unexpected. Please try again.",
      };
    }

    const fixData = parsedResponse.data;
    const replacementGuide = generateReplacementGuide(fixData.fixes || []);
    const replacementMap = createReplacementMap(fixData.fixes || []);

    saveGeneratedCode(handlerInput, fixData, replacementGuide);

    setSessionValues(handlerInput, {
      [SESSION_KEYS.REPLACEMENT_GUIDE]: replacementGuide,
    });

    addToConversationHistory(
      handlerInput,
      "assistant",
      `Generated bug fix for ${componentName}`
    );

    const voiceSummary = createVoiceSummary(fixData);
    const fixCount = fixData.fixes ? fixData.fixes.length : 0;
    const severity = fixData.severity || "medium";

    const speech =
      `Bug diagnosis complete. Severity: ${severity}. Root cause: ${fixData.rootCause || "identified"}. ` +
      `${voiceSummary} ` +
      `I have ${fixCount} fix${fixCount !== 1 ? "es" : ""} ready. ` +
      `Say 'show me the code' to see the exact before and after changes, ` +
      `or 'give me instructions' for step-by-step guidance.`;

    return {
      success: true,
      speech: truncateForVoice(speech),
      fixData,
      replacementGuide,
      replacementMap,
    };
  } catch (error) {
    console.error("executeBugFix error:", error);
    return {
      success: false,
      speech:
        "An unexpected error occurred during bug analysis. Please try again.",
    };
  }
}

module.exports = {
  FixBugIntentHandler,
  executeBugFix,
};
