"use strict";

const axios = require("axios");

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const MAX_TOKENS = 8192;

/**
 * Sends a prompt to Claude API and returns the response
 * @param {string} systemPrompt - The system instruction for Claude
 * @param {string} userPrompt - The user's request
 * @param {Array} conversationHistory - Previous messages in the session
 * @returns {Promise<Object>} - Claude's response object
 */
async function askClaude(systemPrompt, userPrompt, conversationHistory = []) {
  const apiKey = process.env.CLAUDE_API_KEY;

  if (!apiKey) {
    throw new Error(
      "CLAUDE_API_KEY environment variable is not set. Please configure it in your Lambda environment."
    );
  }

  const messages = [
    ...conversationHistory,
    {
      role: "user",
      content: userPrompt,
    },
  ];

  const requestBody = {
    model: CLAUDE_MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: messages,
  };

  try {
    const response = await axios.post(CLAUDE_API_URL, requestBody, {
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      timeout: 25000,
    });

    return {
      success: true,
      content: response.data.content[0].text,
      usage: response.data.usage,
      stopReason: response.data.stop_reason,
    };
  } catch (error) {
    console.error("Claude API Error:", error.response?.data || error.message);

    return {
      success: false,
      error: error.response?.data?.error?.message || error.message,
      statusCode: error.response?.status || 500,
    };
  }
}

/**
 * Generates a complete feature with code and instructions
 */
async function generateFeatureCode(featureName, techStack, additionalContext) {
  const systemPrompt = `You are Claude Code Assistant, an expert software developer. 
You generate complete, professional, production-ready code for web features.

ALWAYS respond in this EXACT JSON format:
{
  "feature": "feature name",
  "techStack": "technology used",
  "summary": "brief 1-2 sentence summary of what was built",
  "voiceResponse": "friendly conversational response for Alexa to speak (max 150 words, no code)",
  "files": [
    {
      "filename": "exact filename with extension",
      "language": "programming language",
      "beforeCode": "the original placeholder or empty state code (if replacing existing)",
      "afterCode": "the complete new code to add",
      "startLine": 1,
      "endLine": 50,
      "description": "what this file does"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "action": "clear action verb",
      "target": "file or location",
      "detail": "specific instruction",
      "lineNumbers": "lines X to Y"
    }
  ],
  "warnings": ["any important warnings or dependencies needed"],
  "professionalTips": ["tips to make this more professional"]
}

Rules:
- Always provide COMPLETE working code, never truncate
- Include before/after code comparisons when replacing existing code
- Provide exact line numbers
- Make code production-ready with error handling
- Follow best practices for the specified tech stack
- Include comments in code`;

  const userPrompt = `Build a complete, professional ${featureName} feature using ${techStack}.
${additionalContext ? `Additional context: ${additionalContext}` : ""}

Generate complete code with:
1. All necessary files
2. Before/after code comparison
3. Exact line numbers for replacement
4. Step-by-step instructions
5. Professional best practices`;

  return await askClaude(systemPrompt, userPrompt);
}

/**
 * Generates bug fix with diagnosis and solution
 */
async function generateBugFix(bugDescription, componentName, codeSnippet) {
  const systemPrompt = `You are Claude Code Assistant, an expert debugger and software engineer.
You diagnose and fix bugs with precision, providing clear before/after comparisons.

ALWAYS respond in this EXACT JSON format:
{
  "bugSummary": "short description of the bug found",
  "rootCause": "technical explanation of why this bug occurs",
  "severity": "critical|high|medium|low",
  "voiceResponse": "friendly Alexa-readable explanation of the bug and fix (max 150 words, no code)",
  "fixes": [
    {
      "filename": "file to modify",
      "language": "programming language",
      "lineNumbers": "lines X to Y",
      "beforeCode": "the buggy code exactly as it appears",
      "afterCode": "the fixed replacement code",
      "explanation": "why this change fixes the bug"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "action": "action verb",
      "target": "file:line number",
      "detail": "exact instruction",
      "codeChange": "what to change"
    }
  ],
  "preventionTips": ["how to prevent this bug in future"],
  "relatedIssues": ["other potential issues to check"]
}`;

  const userPrompt = `Debug and fix: ${bugDescription}
Component/File: ${componentName}
${codeSnippet ? `Code snippet:\n\`\`\`\n${codeSnippet}\n\`\`\`` : ""}

Provide:
1. Root cause analysis
2. Exact before/after code
3. Line-by-line fix instructions
4. Prevention tips`;

  return await askClaude(systemPrompt, userPrompt);
}

/**
 * Generates code improvement suggestions
 */
async function generateImprovement(improvementType, targetArea, currentCode) {
  const systemPrompt = `You are Claude Code Assistant, a senior software architect.
You improve code to make it professional, performant, and maintainable.

ALWAYS respond in this EXACT JSON format:
{
  "improvementSummary": "what improvements were made",
  "impactScore": "1-10 rating of improvement impact",
  "voiceResponse": "Alexa-readable summary of improvements (max 150 words)",
  "improvements": [
    {
      "category": "performance|readability|security|accessibility|responsiveness",
      "filename": "file to modify",
      "language": "programming language",
      "lineNumbers": "lines X to Y",
      "beforeCode": "original code",
      "afterCode": "improved code",
      "benefit": "specific benefit of this change"
    }
  ],
  "instructions": [
    {
      "step": 1,
      "priority": "high|medium|low",
      "action": "action",
      "target": "file:line",
      "detail": "instruction"
    }
  ],
  "metricsImproved": ["list of metrics that will improve"],
  "additionalRecommendations": ["further improvements to consider"]
}`;

  const userPrompt = `Improve ${improvementType} for: ${targetArea}
${currentCode ? `Current code:\n\`\`\`\n${currentCode}\n\`\`\`` : ""}

Make this code more professional and production-ready.
Focus on: ${improvementType}`;

  return await askClaude(systemPrompt, userPrompt);
}

/**
 * Generates step-by-step implementation instructions
 */
async function generateInstructions(taskName, techContext) {
  const systemPrompt = `You are Claude Code Assistant, a technical documentation expert.
You create clear, actionable step-by-step instructions.

ALWAYS respond in this EXACT JSON format:
{
  "taskName": "task being explained",
  "estimatedTime": "estimated implementation time",
  "difficulty": "beginner|intermediate|advanced",
  "voiceResponse": "Alexa-readable introduction (max 100 words)",
  "prerequisites": ["list of prerequisites"],
  "steps": [
    {
      "stepNumber": 1,
      "title": "step title",
      "instruction": "detailed instruction",
      "codeExample": "code snippet if needed",
      "filename": "file to edit",
      "lineNumbers": "relevant lines",
      "tip": "pro tip for this step"
    }
  ],
  "completionChecklist": ["items to verify on completion"],
  "troubleshooting": [
    {
      "problem": "common problem",
      "solution": "how to solve it"
    }
  ]
}`;

  const userPrompt = `Create complete step-by-step instructions for: ${taskName}
${techContext ? `Tech context: ${techContext}` : ""}

Include:
1. All prerequisites
2. Detailed steps with code
3. File names and line numbers
4. Completion checklist
5. Troubleshooting guide`;

  return await askClaude(systemPrompt, userPrompt);
}

/**
 * Requests permission from user before proceeding with changes
 */
async function generatePermissionRequest(action, scope, impact) {
  const systemPrompt = `You are Claude Code Assistant seeking user permission before making changes.
Generate a clear, friendly permission request.

Respond in JSON format:
{
  "permissionRequest": "friendly request explaining what you want to do (max 100 words)",
  "changesSummary": ["bullet list of changes to be made"],
  "filesAffected": ["list of files that will be changed"],
  "linesAffected": "total lines being modified",
  "reversible": true,
  "alternativeApproach": "offer an alternative if user wants different approach"
}`;

  const userPrompt = `Generate permission request for:
Action: ${action}
Scope: ${scope}
Impact: ${impact}`;

  return await askClaude(systemPrompt, userPrompt);
}

module.exports = {
  askClaude,
  generateFeatureCode,
  generateBugFix,
  generateImprovement,
  generateInstructions,
  generatePermissionRequest,
};
