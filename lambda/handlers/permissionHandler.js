"use strict";

const {
  isAwaitingPermission,
  clearPermissionState,
  getSessionValue,
  setSessionValues,
  SESSION_KEYS,
  getCurrentTask,
  TASK_TYPES,
  addToConversationHistory,
  clearAllSession,
  initializeSession,
} = require("../utils/sessionManager");

const { executeFeatureGeneration } = require("./codeGenerationHandler");
const { executeBugFix } = require("./bugFixHandler");
const { executeImprovement } = require("./featureHandler");
const { executeInstructionGeneration } = require("./instructionHandler");
const { truncateForVoice } = require("../utils/codeFormatter");
const { askClaude } = require("../utils/claudeAPI");
const { parseClaudeResponse } = require("../utils/codeFormatter");

/**
 * Handler for GrantPermissionIntent
 * Executes the pending task after user approval
 */
const GrantPermissionIntentHandler = {
  canHandle(handlerInput) {
    const isPermissionIntent =
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "GrantPermissionIntent";

    return isPermissionIntent && isAwaitingPermission(handlerInput);
  },

  async handle(handlerInput) {
    const pendingPermission = getSessionValue(
      handlerInput,
      SESSION_KEYS.PENDING_PERMISSION
    );

    if (!pendingPermission) {
      return handlerInput.responseBuilder
        .speak(
          "I am not sure what action you are approving. " +
          "Please start by telling me what feature to build or bug to fix."
        )
        .reprompt("What would you like me to help you with?")
        .getResponse();
    }

    clearPermissionState(handlerInput);

    addToConversationHistory(handlerInput, "user", "Permission granted, proceed");

    const processingMessage = getProcessingMessage(pendingPermission.action);

    let result;

    switch (pendingPermission.action) {
      case "BUILD_FEATURE":
        result = await executeFeatureGeneration(handlerInput, pendingPermission);
        break;

      case "FIX_BUG":
        result = await executeBugFix(handlerInput, pendingPermission);
        break;

      case "IMPROVE_CODE":
        result = await executeImprovement(handlerInput, pendingPermission);
        break;

      case "GET_INSTRUCTIONS":
        result = await executeInstructionGeneration(handlerInput, pendingPermission);
        break;

      default:
        result = {
          success: false,
          speech: "I could not determine which action to execute. Please start your request again.",
        };
    }

    const finalSpeech = result.success
      ? result.speech
      : result.speech || "An error occurred. Please try again.";

    const repromptMessage = result.success
      ? "Say 'show me the code' to see the before and after, or 'give me instructions' for the guide."
      : "Would you like to try again? Tell me what you need help with.";

    return handlerInput.responseBuilder
      .speak(truncateForVoice(finalSpeech))
      .reprompt(repromptMessage)
      .getResponse();
  },
};

/**
 * Handler for DenyPermissionIntent
 * Cancels the pending action and offers alternatives
 */
const DenyPermissionIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "DenyPermissionIntent" &&
      isAwaitingPermission(handlerInput)
    );
  },

  handle(handlerInput) {
    const pendingPermission = getSessionValue(
      handlerInput,
      SESSION_KEYS.PENDING_PERMISSION
    );

    clearPermissionState(handlerInput);

    addToConversationHistory(handlerInput, "user", "Permission denied, cancelled");

    const actionCancelled =
      pendingPermission?.featureName ||
      pendingPermission?.componentName ||
      pendingPermission?.taskName ||
      "the action";

    const speech =
      `No problem. I have cancelled ${actionCancelled}. ` +
      `You can modify your request by saying things like: ` +
      `'build a login feature using React', ` +
      `'fix the navbar bug', or ` +
      `'improve the performance of my homepage'. ` +
      `What would you like to do instead?`;

    return handlerInput.responseBuilder
      .speak(speech)
      .reprompt("What would you like me to help you with?")
      .getResponse();
  },
};

/**
 * Handler for ModifyInstructionIntent
 * Allows user to divert or change the planned approach
 */
const ModifyInstructionIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "ModifyInstructionIntent"
    );
  },

  async handle(handlerInput) {
    const { intent } = handlerInput.requestEnvelope.request;
    const modification = intent.slots.modification?.value || "a different approach";
    const pendingPermission = getSessionValue(
      handlerInput,
      SESSION_KEYS.PENDING_PERMISSION
    );
    const currentTask = getCurrentTask(handlerInput);

    clearPermissionState(handlerInput);

    addToConversationHistory(
      handlerInput,
      "user",
      `Modify approach to: ${modification}`
    );

    console.log(`Modifying instruction: ${modification}`);

    try {
      const systemPrompt = `You are Claude Code Assistant. The user wants to modify or redirect a code task.
Acknowledge the change and propose a new approach.
Respond in JSON format:
{
  "acknowledgment": "confirm you understood the change (1 sentence)",
  "newApproach": "describe the new modified approach (2-3 sentences)",
  "voiceResponse": "Alexa-friendly response confirming the change and asking for permission (max 100 words)",
  "newAction": "BUILD_FEATURE|FIX_BUG|IMPROVE_CODE|GET_INSTRUCTIONS",
  "modifiedContext": {
    "featureName": "updated feature name if applicable",
    "componentName": "updated component name if applicable",
    "techStack": "updated tech stack if applicable",
    "improvementType": "updated improvement type if applicable"
  }
}`;

      const userPrompt =
        `Current task: ${JSON.stringify(currentTask)}\n` +
        `User wants to modify to: ${modification}`;

      const claudeResponse = await askClaude(systemPrompt, userPrompt);

      if (claudeResponse.success) {
        const parsed = parseClaudeResponse(claudeResponse.content);

        if (parsed.success && parsed.data) {
          const modData = parsed.data;

          const newPermissionContext = {
            action: modData.newAction || (pendingPermission?.action) || "BUILD_FEATURE",
            ...modData.modifiedContext,
            originalModification: modification,
          };

          setSessionValues(handlerInput, {
            [SESSION_KEYS.AWAITING_PERMISSION]: true,
            [SESSION_KEYS.PENDING_PERMISSION]: newPermissionContext,
            [SESSION_KEYS.DIVERTED_INSTRUCTION]: modification,
          });

          const speech =
            modData.voiceResponse ||
            `Understood. I will now ${modification} instead. ` +
            `${modData.newApproach} ` +
            `Shall I proceed with this modified approach?`;

          return handlerInput.responseBuilder
            .speak(truncateForVoice(speech))
            .reprompt("Say yes to proceed with the modified approach or no to cancel.")
            .getResponse();
        }
      }

      const fallbackSpeech =
        `Got it. Instead, I will focus on ${modification}. ` +
        `This is a different approach from what we discussed. ` +
        `May I proceed with this modified plan?`;

      setSessionValues(handlerInput, {
        [SESSION_KEYS.AWAITING_PERMISSION]: true,
        [SESSION_KEYS.PENDING_PERMISSION]: {
          action: pendingPermission?.action || "BUILD_FEATURE",
          modification: modification,
          originalContext: pendingPermission,
        },
        [SESSION_KEYS.DIVERTED_INSTRUCTION]: modification,
      });

      return handlerInput.responseBuilder
        .speak(fallbackSpeech)
        .reprompt("Say yes to proceed or tell me a different approach.")
        .getResponse();
    } catch (error) {
      console.error("ModifyInstructionIntent error:", error);
      return handlerInput.responseBuilder
        .speak(
          "I understood you want to change the approach. " +
          "Could you describe what you would like to do differently?"
        )
        .reprompt("What approach would you prefer?")
        .getResponse();
    }
  },
};

/**
 * Handler for ConfirmReplacementIntent
 * Delivers the complete replacement guide
 */
const ConfirmReplacementIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "ConfirmReplacementIntent"
    );
  },

  handle(handlerInput) {
    const replacementGuide = getSessionValue(
      handlerInput,
      SESSION_KEYS.REPLACEMENT_GUIDE
    );

    if (!replacementGuide) {
      return handlerInput.responseBuilder
        .speak(
          "I do not have a replacement guide ready. " +
          "Please first ask me to build a feature or fix a bug."
        )
        .reprompt("What would you like me to help you build or fix?")
        .getResponse();
    }

    const fileCount = replacementGuide.totalFiles || 0;
    const guide = replacementGuide.guides || [];

    const fileList = guide
      .slice(0, 3)
      .map((g, i) => `File ${i + 1}: ${g.filename}, ${g.lineRange}`)
      .join(". ");

    const speech =
      `Your complete replacement guide is ready. ` +
      `You need to update ${fileCount} file${fileCount !== 1 ? "s" : ""}. ` +
      `${fileList}. ` +
      `For each file: Open it in your editor, navigate to the line numbers shown, ` +
      `select the BEFORE code and replace it with the AFTER code. ` +
      `The complete code with line numbers has been logged to the session. ` +
      `Is there anything else you need help with?`;

    return handlerInput.responseBuilder
      .speak(truncateForVoice(speech))
      .reprompt("Do you need help with anything else?")
      .getResponse();
  },
};

/**
 * Handler for StartOverIntent
 */
const StartOverIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "StartOverIntent"
    );
  },

  handle(handlerInput) {
    clearAllSession(handlerInput);
    initializeSession(handlerInput);

    const speech =
      "No problem, let us start fresh. " +
      "I am Claude Code Assistant. I can help you build new features, fix bugs, " +
      "improve your code quality, or walk you through implementation steps. " +
      "What would you like to work on today?";

    return handlerInput.responseBuilder
      .speak(speech)
      .reprompt("What feature would you like to build or what bug should I fix?")
      .getResponse();
  },
};

/**
 * Gets a processing message based on action type
 */
function getProcessingMessage(action) {
  const messages = {
    BUILD_FEATURE: "Building your feature",
    FIX_BUG: "Analyzing and fixing the bug",
    IMPROVE_CODE: "Analyzing improvements",
    GET_INSTRUCTIONS: "Generating instructions",
  };
  return messages[action] || "Processing your request";
}

module.exports = {
  GrantPermissionIntentHandler,
  DenyPermissionIntentHandler,
  ModifyInstructionIntentHandler,
  ConfirmReplacementIntentHandler,
  StartOverIntentHandler,
};
