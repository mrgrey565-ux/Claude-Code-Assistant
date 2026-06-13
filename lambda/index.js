"use strict";

const Alexa = require("ask-sdk-core");

// Import handlers
const {
  BuildFeatureIntentHandler,
} = require("./handlers/codeGenerationHandler");
const { FixBugIntentHandler } = require("./handlers/bugFixHandler");
const { ImproveCodeIntentHandler } = require("./handlers/featureHandler");
const {
  GetInstructionsIntentHandler,
  ShowCodeIntentHandler,
} = require("./handlers/instructionHandler");
const {
  GrantPermissionIntentHandler,
  DenyPermissionIntentHandler,
  ModifyInstructionIntentHandler,
  ConfirmReplacementIntentHandler,
  StartOverIntentHandler,
} = require("./handlers/permissionHandler");

const { initializeSession } = require("./utils/sessionManager");
const { truncateForVoice } = require("./utils/codeFormatter");

// ─────────────────────────────────────────────
// LAUNCH REQUEST HANDLER
// ─────────────────────────────────────────────
const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "LaunchRequest"
    );
  },

  handle(handlerInput) {
    initializeSession(handlerInput);

    const speakOutput =
      "Welcome to Claude Code Assistant! " +
      "I am your AI-powered coding partner, built on Claude. " +
      "I can help you build new features, fix bugs, improve your code quality, " +
      "and provide step-by-step implementation guides with before and after code comparisons. " +
      "Before making any changes, I will always ask your permission first. " +
      "You can also redirect me at any time by saying things like 'instead do this differently'. " +
      "So, what would you like to build or fix today?";

    const repromptOutput =
      "What would you like me to help you with? " +
      "Say something like: build a login feature using React, " +
      "or fix the bug in my navbar.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(repromptOutput)
      .getResponse();
  },
};

// ─────────────────────────────────────────────
// HELP INTENT HANDLER
// ─────────────────────────────────────────────
const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.HelpIntent"
    );
  },

  handle(handlerInput) {
    const speakOutput =
      "Here is what I can do for you. " +
      "One: Build new features. Say something like: build a dark mode feature using React. " +
      "Two: Fix bugs. Say: fix the bug in my login form. " +
      "Three: Improve code. Say: make my website more professional. " +
      "Four: Step-by-step instructions. Say: give me instructions for setting up authentication. " +
      "I always ask permission before making changes. " +
      "You can also divert my approach by saying 'instead do this' at any time. " +
      "After generating code, I show you before and after comparisons with exact line numbers. " +
      "What would you like to start with?";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("What feature would you like to build or what bug should I fix?")
      .getResponse();
  },
};

// ─────────────────────────────────────────────
// CANCEL AND STOP HANDLER
// ─────────────────────────────────────────────
const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      (handlerInput.requestEnvelope.request.intent.name ===
        "AMAZON.CancelIntent" ||
        handlerInput.requestEnvelope.request.intent.name ===
          "AMAZON.StopIntent")
    );
  },

  handle(handlerInput) {
    const speakOutput =
      "Goodbye! Your code assistant is always here when you need help building features or fixing bugs. Happy coding!";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .withShouldEndSession(true)
      .getResponse();
  },
};

// ─────────────────────────────────────────────
// SESSION ENDED REQUEST HANDLER
// ─────────────────────────────────────────────
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "SessionEndedRequest"
    );
  },

  handle(handlerInput) {
    console.log(
      "Session ended:",
      JSON.stringify(handlerInput.requestEnvelope.request.reason)
    );
    return handlerInput.responseBuilder.getResponse();
  },
};

// ─────────────────────────────────────────────
// NAVIGATE HOME INTENT HANDLER
// ─────────────────────────────────────────────
const NavigateHomeIntentHandler = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name ===
        "AMAZON.NavigateHomeIntent"
    );
  },

  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        "Returning to the main menu. What would you like to build or fix?"
      )
      .reprompt("What can I help you with?")
      .getResponse();
  },
};

// ─────────────────────────────────────────────
// GLOBAL ERROR HANDLER
// ─────────────────────────────────────────────
const ErrorHandler = {
  canHandle() {
    return true;
  },

  handle(handlerInput, error) {
    console.error("Skill Error:", {
      message: error.message,
      stack: error.stack,
      request: JSON.stringify(handlerInput.requestEnvelope.request),
    });

    const speakOutput =
      "I encountered an unexpected error. " +
      "Please check that all environment variables are configured correctly, " +
      "especially the Claude API key. " +
      "You can say 'start over' to reset, or try your request again.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt("Say 'start over' to reset or try your request again.")
      .getResponse();
  },
};

// ─────────────────────────────────────────────
// REQUEST INTERCEPTOR — Logs every request
// ─────────────────────────────────────────────
const RequestLogInterceptor = {
  process(handlerInput) {
    const { request } = handlerInput.requestEnvelope;
    console.log("Incoming Request:", {
      type: request.type,
      intentName:
        request.type === "IntentRequest" ? request.intent.name : "N/A",
      slots:
        request.type === "IntentRequest"
          ? JSON.stringify(request.intent.slots)
          : "N/A",
      sessionId: handlerInput.requestEnvelope.session?.sessionId,
    });
  },
};

// ─────────────────────────────────────────────
// RESPONSE INTERCEPTOR — Logs every response
// ─────────────────────────────────────────────
const ResponseLogInterceptor = {
  process(handlerInput, response) {
    console.log("Outgoing Response:", {
      speech: response?.outputSpeech?.ssml || response?.outputSpeech?.text,
      shouldEndSession: response?.shouldEndSession,
    });
  },
};

// ─────────────────────────────────────────────
// SKILL BUILDER — Register all handlers
// ─────────────────────────────────────────────
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    HelpIntentHandler,
    // Permission handlers must come before intent handlers
    GrantPermissionIntentHandler,
    DenyPermissionIntentHandler,
    ModifyInstructionIntentHandler,
    ConfirmReplacementIntentHandler,
    StartOverIntentHandler,
    // Feature handlers
    BuildFeatureIntentHandler,
    FixBugIntentHandler,
    ImproveCodeIntentHandler,
    GetInstructionsIntentHandler,
    ShowCodeIntentHandler,
    // Amazon built-ins
    CancelAndStopIntentHandler,
    NavigateHomeIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .addRequestInterceptors(RequestLogInterceptor)
  .addResponseInterceptors(ResponseLogInterceptor)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
