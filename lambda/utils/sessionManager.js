"use strict";

/**
 * Manages session state for multi-turn conversations
 */

const SESSION_KEYS = {
  CURRENT_TASK: "currentTask",
  GENERATED_CODE: "generatedCode",
  PENDING_PERMISSION: "pendingPermission",
  CONVERSATION_HISTORY: "conversationHistory",
  CURRENT_FEATURE: "currentFeature",
  CURRENT_TECH_STACK: "currentTechStack",
  REPLACEMENT_GUIDE: "replacementGuide",
  INSTRUCTION_STEP: "instructionStep",
  TASK_TYPE: "taskType",
  AWAITING_PERMISSION: "awaitingPermission",
  DIVERTED_INSTRUCTION: "divertedInstruction",
  SESSION_START_TIME: "sessionStartTime",
};

const TASK_TYPES = {
  BUILD_FEATURE: "BUILD_FEATURE",
  FIX_BUG: "FIX_BUG",
  IMPROVE_CODE: "IMPROVE_CODE",
  GET_INSTRUCTIONS: "GET_INSTRUCTIONS",
};

/**
 * Gets a value from session attributes
 */
function getSessionValue(handlerInput, key) {
  const attributes =
    handlerInput.attributesManager.getSessionAttributes() || {};
  return attributes[key] || null;
}

/**
 * Sets a value in session attributes
 */
function setSessionValue(handlerInput, key, value) {
  const attributes =
    handlerInput.attributesManager.getSessionAttributes() || {};
  attributes[key] = value;
  handlerInput.attributesManager.setSessionAttributes(attributes);
}

/**
 * Sets multiple session values at once
 */
function setSessionValues(handlerInput, valuesObject) {
  const attributes =
    handlerInput.attributesManager.getSessionAttributes() || {};
  Object.assign(attributes, valuesObject);
  handlerInput.attributesManager.setSessionAttributes(attributes);
}

/**
 * Gets all session attributes
 */
function getAllSessionAttributes(handlerInput) {
  return handlerInput.attributesManager.getSessionAttributes() || {};
}

/**
 * Clears specific session keys
 */
function clearSessionKeys(handlerInput, keys) {
  const attributes =
    handlerInput.attributesManager.getSessionAttributes() || {};
  keys.forEach((key) => {
    delete attributes[key];
  });
  handlerInput.attributesManager.setSessionAttributes(attributes);
}

/**
 * Clears all session data
 */
function clearAllSession(handlerInput) {
  handlerInput.attributesManager.setSessionAttributes({});
}

/**
 * Sets the skill as awaiting user permission
 */
function setAwaitingPermission(handlerInput, permissionContext) {
  setSessionValues(handlerInput, {
    [SESSION_KEYS.AWAITING_PERMISSION]: true,
    [SESSION_KEYS.PENDING_PERMISSION]: permissionContext,
  });
}

/**
 * Checks if skill is awaiting permission
 */
function isAwaitingPermission(handlerInput) {
  return (
    getSessionValue(handlerInput, SESSION_KEYS.AWAITING_PERMISSION) === true
  );
}

/**
 * Clears permission state
 */
function clearPermissionState(handlerInput) {
  clearSessionKeys(handlerInput, [
    SESSION_KEYS.AWAITING_PERMISSION,
    SESSION_KEYS.PENDING_PERMISSION,
  ]);
}

/**
 * Adds a message to conversation history
 */
function addToConversationHistory(handlerInput, role, content) {
  const history =
    getSessionValue(handlerInput, SESSION_KEYS.CONVERSATION_HISTORY) || [];
  history.push({ role, content });

  const trimmedHistory = history.slice(-10);
  setSessionValue(
    handlerInput,
    SESSION_KEYS.CONVERSATION_HISTORY,
    trimmedHistory
  );
}

/**
 * Gets conversation history
 */
function getConversationHistory(handlerInput) {
  return (
    getSessionValue(handlerInput, SESSION_KEYS.CONVERSATION_HISTORY) || []
  );
}

/**
 * Saves generated code and guide to session
 */
function saveGeneratedCode(handlerInput, codeData, replacementGuide) {
  setSessionValues(handlerInput, {
    [SESSION_KEYS.GENERATED_CODE]: codeData,
    [SESSION_KEYS.REPLACEMENT_GUIDE]: replacementGuide,
  });
}

/**
 * Gets the saved replacement guide
 */
function getReplacementGuide(handlerInput) {
  return getSessionValue(handlerInput, SESSION_KEYS.REPLACEMENT_GUIDE);
}

/**
 * Sets the current task context
 */
function setCurrentTask(handlerInput, taskType, taskDetails) {
  setSessionValues(handlerInput, {
    [SESSION_KEYS.TASK_TYPE]: taskType,
    [SESSION_KEYS.CURRENT_TASK]: taskDetails,
  });
}

/**
 * Gets the current task context
 */
function getCurrentTask(handlerInput) {
  return {
    type: getSessionValue(handlerInput, SESSION_KEYS.TASK_TYPE),
    details: getSessionValue(handlerInput, SESSION_KEYS.CURRENT_TASK),
  };
}

/**
 * Initializes a new session
 */
function initializeSession(handlerInput) {
  setSessionValues(handlerInput, {
    [SESSION_KEYS.SESSION_START_TIME]: new Date().toISOString(),
    [SESSION_KEYS.CONVERSATION_HISTORY]: [],
    [SESSION_KEYS.INSTRUCTION_STEP]: 0,
  });
}

module.exports = {
  SESSION_KEYS,
  TASK_TYPES,
  getSessionValue,
  setSessionValue,
  setSessionValues,
  getAllSessionAttributes,
  clearSessionKeys,
  clearAllSession,
  setAwaitingPermission,
  isAwaitingPermission,
  clearPermissionState,
  addToConversationHistory,
  getConversationHistory,
  saveGeneratedCode,
  getReplacementGuide,
  setCurrentTask,
  getCurrentTask,
  initializeSession,
};
