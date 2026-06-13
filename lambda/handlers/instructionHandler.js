"use strict";

const { generateInstructions } = require("../utils/claudeAPI");

const {
  parseClaudeResponse,
  formatInstructions,
  truncateForVoice,
  createVoiceSummary,
} = require("../utils/codeFormatter");

const {
  TASK_TYPES,
  setCurrentTask,
  setAwaitingPermission,
  addToConversationHistory,
  getReplacementGuide,
  SESSION_KEYS,
  setSessionValues,
  getSessionValue,
} = require("../utils/sessionManager");

/**
 * Handler for GetInstructionsIntent
 */
const GetInstructionsIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "GetInstructionsIntent"
    );
  },

  async handle(handlerInput) {
    const { intent } = handlerInput.requestEnvelope.request;
    const taskName = intent.slots.taskName?.value || "the requested task";

    console.log(`Getting instructions for: ${taskName}`);

    setCurrentTask(handlerInput, TASK_TYPES.GET_INSTRUCTIONS, { taskName });
    addToConversationHistory(
      handlerInput,
      "user",
      `Give me instructions for ${taskName}`
    );

    const permissionContext = {
      action: "GET_INSTRUCTIONS",
      taskName,
    };

    setAwaitingPermission(handlerInput, permissionContext);

    const speakOutput =
      `I will create detailed step-by-step instructions for ${taskName}. ` +
      `This will include prerequisites, implementation steps with code examples, ` +
      `exact file names and line numbers, and a troubleshooting guide. ` +
      `Shall I proceed? Say yes to get the full instructions.`;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Say yes to generate the instructions or no to cancel.")
      .getResponse();
  },
};

/**
 * Handler for ShowCodeIntent — shows before/after code
 */
const ShowCodeIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "ShowCodeIntent"
    );
  },

  handle(handlerInput) {
    const replacementGuide = getReplacementGuide(handlerInput);

    if (!replacementGuide || replacementGuide.totalFiles === 0) {
      const speech =
        "I do not have any generated code to show yet. " +
        "Please first ask me to build a feature, fix a bug, or improve your code.";

      return handlerInput.responseBuilder
        .speak(speech)
        .reprompt("What would you like me to build or fix?")
        .getResponse();
    }

    const guide = replacementGuide.guides[0];
    const beforePreview = truncateCodePreview(
      guide?.diff?.before?.code || "",
      3
    );
    const afterPreview = truncateCodePreview(guide?.diff?.after?.code || "", 3);

    const speech =
      `Here is the code change for ${guide.filename || "the file"}. ` +
      `${guide.lineRange || ""}. ` +
      `BEFORE: Remove the code starting with: ${beforePreview}. ` +
      `AFTER: Replace it with code starting with: ${afterPreview}. ` +
      `There are ${replacementGuide.totalFiles} file${replacementGuide.totalFiles !== 1 ? "s" : ""} ` +
      `to update in total. ` +
      `The full code with line numbers has been prepared. ` +
      `Say 'confirm replacement' to get the complete replacement guide, ` +
      `or 'give me instructions' for the step-by-step walkthrough.`;

    return handlerInput.responseBuilder
      .speak(truncateForVoice(speech))
      .reprompt("Would you like to confirm the replacement or hear the instructions?")
      .getResponse();
  },
};

/**
 * Truncates code to first N lines for voice preview
 */
function truncateCodePreview(code, lines = 2) {
  if (!code) return "empty";
  const codeLines = code.split("\n").filter((l) => l.trim());
  const preview = codeLines.slice(0, lines).join(" ").substring(0, 100);
  return preview || "empty";
}

/**
 * Executes instruction generation after permission
 */
async function executeInstructionGeneration(handlerInput, permissionContext) {
  const { taskName } = permissionContext;

  try {
    const claudeResponse = await generateInstructions(taskName, null);

    if (!claudeResponse.success) {
      return {
        success: false,
        speech:
          `I had trouble generating instructions for ${taskName}. ` +
          `Error: ${claudeResponse.error}. Please try again.`,
      };
    }

    const parsedResponse = parseClaudeResponse(claudeResponse.content);

    if (!parsedResponse.success) {
      return {
        success: false,
        speech: "The instructions were generated but could not be formatted. Please try again.",
      };
    }

    const instructionData = parsedResponse.data;

    setSessionValues(handlerInput, {
      [SESSION_KEYS.GENERATED_CODE]: instructionData,
      [SESSION_KEYS.INSTRUCTION_STEP]: 0,
    });

    addToConversationHistory(
      handlerInput,
      "assistant",
      `Generated instructions for ${taskName}`
    );

    const stepCount = instructionData.steps ? instructionData.steps.length : 0;
    const difficulty = instructionData.difficulty || "intermediate";
    const estimatedTime = instructionData.estimatedTime || "30 minutes";
    const prereqs = (instructionData.prerequisites || [])
      .slice(0, 2)
      .join(", ");

    const voiceIntro = instructionData.voiceResponse || "";

    const speech =
      `Instructions ready for ${taskName}. ` +
      `Difficulty: ${difficulty}. Estimated time: ${estimatedTime}. ` +
      `${voiceIntro} ` +
      `Prerequisites: ${prereqs || "none"}. ` +
      `There are ${stepCount} implementation steps. ` +
      `Say 'next step' to begin the walkthrough, ` +
      `or 'show me all steps' to get the complete overview.`;

    return {
      success: true,
      speech: truncateForVoice(speech),
      instructionData,
    };
  } catch (error) {
    console.error("executeInstructionGeneration error:", error);
    return {
      success: false,
      speech: "An error occurred generating instructions. Please try again.",
    };
  }
}

module.exports = {
  GetInstructionsIntentHandler,
  ShowCodeIntentHandler,
  executeInstructionGeneration,
};
