"use strict";

const { generateImprovement } = require("../utils/claudeAPI");

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
 * Handler for ImproveCodeIntent
 */
const ImproveCodeIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "ImproveCodeIntent"
    );
  },

  async handle(handlerInput) {
    const { intent } = handlerInput.requestEnvelope.request;
    const slots = intent.slots;

    const improvementType = slots.improvementType?.value || "professional";
    const targetArea = slots.targetArea?.value || "the codebase";

    console.log(`Improving ${improvementType} for ${targetArea}`);

    setCurrentTask(handlerInput, TASK_TYPES.IMPROVE_CODE, {
      improvementType,
      targetArea,
    });

    addToConversationHistory(
      handlerInput,
      "user",
      `Improve ${improvementType} of ${targetArea}`
    );

    const permissionContext = {
      action: "IMPROVE_CODE",
      improvementType,
      targetArea,
    };

    setAwaitingPermission(handlerInput, permissionContext);

    const improvements = getImprovementDescription(improvementType);

    const speakOutput =
      `I will analyze ${targetArea} and make it more ${improvementType}. ` +
      `This includes: ${improvements}. ` +
      `I will provide complete before and after code comparisons with exact line numbers. ` +
      `Shall I proceed with the improvement analysis? Say yes to continue.`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Say yes to proceed with improvements or no to cancel.")
      .getResponse();
  },
};

/**
 * Gets description of improvements based on type
 */
function getImprovementDescription(type) {
  const descriptions = {
    professional:
      "consistent naming, clean structure, proper comments, and best practices",
    performant:
      "lazy loading, code splitting, memoization, and reduced bundle size",
    accessible:
      "ARIA labels, keyboard navigation, color contrast, and screen reader support",
    responsive:
      "mobile-first CSS, flexible layouts, breakpoints, and touch support",
    secure:
      "input sanitization, CSRF protection, secure headers, and validation",
    readable:
      "clear variable names, function documentation, and logical code structure",
  };

  return descriptions[type.toLowerCase()] || "overall code quality improvements";
}

/**
 * Executes code improvement after permission granted
 */
async function executeImprovement(handlerInput, permissionContext) {
  const { improvementType, targetArea } = permissionContext;

  try {
    const claudeResponse = await generateImprovement(
      improvementType,
      targetArea,
      null
    );

    if (!claudeResponse.success) {
      return {
        success: false,
        speech:
          `I had trouble analyzing ${targetArea} for improvements. ` +
          `Error: ${claudeResponse.error}. Please try again.`,
      };
    }

    const parsedResponse = parseClaudeResponse(claudeResponse.content);

    if (!parsedResponse.success) {
      return {
        success: false,
        speech:
          "I completed the analysis but could not format the response. Please try again.",
      };
    }

    const improvementData = parsedResponse.data;
    const replacementGuide = generateReplacementGuide(
      improvementData.improvements || []
    );
    const replacementMap = createReplacementMap(
      improvementData.improvements || []
    );

    saveGeneratedCode(handlerInput, improvementData, replacementGuide);

    setSessionValues(handlerInput, {
      [SESSION_KEYS.REPLACEMENT_GUIDE]: replacementGuide,
    });

    addToConversationHistory(
      handlerInput,
      "assistant",
      `Generated ${improvementType} improvements for ${targetArea}`
    );

    const voiceSummary = createVoiceSummary(improvementData);
    const improvCount = improvementData.improvements
      ? improvementData.improvements.length
      : 0;
    const impactScore = improvementData.impactScore || "8";

    const speech =
      `Improvement analysis complete! Impact score: ${impactScore} out of 10. ` +
      `${voiceSummary} ` +
      `I found ${improvCount} improvement${improvCount !== 1 ? "s" : ""} to make. ` +
      `Metrics that will improve: ${(improvementData.metricsImproved || ["overall quality"]).slice(0, 2).join(", ")}. ` +
      `Say 'show me the code' to see the changes, or 'give me instructions' for the steps.`;

    return {
      success: true,
      speech: truncateForVoice(speech),
      improvementData,
      replacementGuide,
      replacementMap,
    };
  } catch (error) {
    console.error("executeImprovement error:", error);
    return {
      success: false,
      speech:
        "An error occurred during the improvement analysis. Please try again.",
    };
  }
}

module.exports = {
  ImproveCodeIntentHandler,
  executeImprovement,
};
