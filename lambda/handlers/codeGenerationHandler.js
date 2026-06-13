"use strict";

const {
  generateFeatureCode,
  generatePermissionRequest,
} = require("../utils/claudeAPI");

const {
  parseClaudeResponse,
  generateReplacementGuide,
  createVoiceSummary,
  formatInstructions,
  truncateForVoice,
  formatWarnings,
  formatProfessionalTips,
} = require("../utils/codeFormatter");

const { createReplacementMap } = require("../utils/diffGenerator");

const {
  SESSION_KEYS,
  TASK_TYPES,
  setSessionValues,
  setCurrentTask,
  setAwaitingPermission,
  saveGeneratedCode,
  addToConversationHistory,
  initializeSession,
} = require("../utils/sessionManager");

/**
 * Handler for BuildFeatureIntent
 * Generates complete feature code with before/after comparison
 */
const BuildFeatureIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "BuildFeatureIntent"
    );
  },

  async handle(handlerInput) {
    const { intent } = handlerInput.requestEnvelope.request;
    const slots = intent.slots;

    const featureName = slots.featureName?.value || "feature";
    const techStack = slots.techStack?.value || "HTML, CSS, and JavaScript";

    console.log(`Building feature: ${featureName} with ${techStack}`);

    setCurrentTask(handlerInput, TASK_TYPES.BUILD_FEATURE, {
      featureName,
      techStack,
    });

    addToConversationHistory(
      handlerInput,
      "user",
      `Build a ${featureName} feature using ${techStack}`
    );

    try {
      const permissionResponse = await generatePermissionRequest(
        `Build ${featureName} feature`,
        `Generate complete ${techStack} code with ${featureName} functionality`,
        `Creates new files and code blocks for ${featureName}`
      );

      const permissionParsed = parseClaudeResponse(
        permissionResponse.content || ""
      );

      const permissionContext = {
        action: "BUILD_FEATURE",
        featureName,
        techStack,
        permissionData: permissionParsed.success
          ? permissionParsed.data
          : null,
      };

      setAwaitingPermission(handlerInput, permissionContext);

      const changesSummary =
        permissionParsed.success && permissionParsed.data?.changesSummary
          ? permissionParsed.data.changesSummary
              .slice(0, 3)
              .map((c, i) => `${i + 1}. ${c}`)
              .join(", ")
          : `generate complete ${featureName} code`;

      const speakOutput =
        `I am ready to build the ${featureName} feature using ${techStack}. ` +
        `Here is what I plan to do: ${changesSummary}. ` +
        `Do you want me to proceed and generate the complete code? ` +
        `Say yes to continue, or tell me if you want a different approach.`;

      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt(
          "Should I go ahead and generate the code? Say yes to proceed or no to cancel."
        )
        .getResponse();
    } catch (error) {
      console.error("BuildFeatureIntent Error:", error);

      const errorSpeech =
        `I encountered an issue preparing the ${featureName} feature. ` +
        `Please check that the Claude API key is configured correctly and try again.`;

      return handlerInput.responseBuilder
        .speak(errorSpeech)
        .withShouldEndSession(false)
        .getResponse();
    }
  },
};

/**
 * Executes feature generation after permission is granted
 */
async function executeFeatureGeneration(handlerInput, permissionContext) {
  const { featureName, techStack } = permissionContext;

  try {
    const claudeResponse = await generateFeatureCode(
      featureName,
      techStack,
      null
    );

    if (!claudeResponse.success) {
      return {
        success: false,
        speech:
          `I had trouble generating the ${featureName} code. ` +
          `Error: ${claudeResponse.error}. Please try again.`,
      };
    }

    const parsedResponse = parseClaudeResponse(claudeResponse.content);

    if (!parsedResponse.success) {
      return {
        success: false,
        speech:
          "I generated the code but had trouble formatting the response. " +
          "Please try your request again.",
      };
    }

    const codeData = parsedResponse.data;
    const replacementGuide = generateReplacementGuide(codeData.files || []);
    const replacementMap = createReplacementMap(codeData.files || []);

    saveGeneratedCode(handlerInput, codeData, replacementGuide);

    setSessionValues(handlerInput, {
      [SESSION_KEYS.REPLACEMENT_GUIDE]: replacementGuide,
      [SESSION_KEYS.CURRENT_FEATURE]: featureName,
      [SESSION_KEYS.CURRENT_TECH_STACK]: techStack,
    });

    addToConversationHistory(
      handlerInput,
      "assistant",
      `Generated ${featureName} feature code for ${techStack}`
    );

    const voiceSummary = createVoiceSummary(codeData);
    const fileCount = codeData.files ? codeData.files.length : 0;
    const stepCount = codeData.instructions ? codeData.instructions.length : 0;

    const speech =
      `${voiceSummary} ` +
      `I have created ${fileCount} file${fileCount !== 1 ? "s" : ""} for you. ` +
      `There are ${stepCount} steps to follow for implementation. ` +
      `Say 'show me the code' to see the before and after comparison, ` +
      `or 'give me instructions' to hear the step-by-step guide.`;

    return {
      success: true,
      speech: truncateForVoice(speech),
      codeData,
      replacementGuide,
      replacementMap,
    };
  } catch (error) {
    console.error("executeFeatureGeneration error:", error);
    return {
      success: false,
      speech:
        "An unexpected error occurred while generating the code. Please try again.",
    };
  }
}

module.exports = {
  BuildFeatureIntentHandler,
  executeFeatureGeneration,
};
