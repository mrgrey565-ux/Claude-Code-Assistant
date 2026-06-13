"use strict";

/**
 * Formats code output for display and voice response
 */

/**
 * Creates a before/after diff view for display
 * @param {string} beforeCode - Original code
 * @param {string} afterCode - New code
 * @param {string} filename - Name of the file
 * @param {Object} lineInfo - Line number information
 * @returns {Object} - Formatted diff object
 */
function createBeforeAfterView(beforeCode, afterCode, filename, lineInfo) {
  const beforeLines = beforeCode ? beforeCode.split("\n") : [];
  const afterLines = afterCode ? afterCode.split("\n") : [];

  return {
    filename: filename,
    lineRange: lineInfo,
    before: {
      label: "❌ BEFORE (Remove This)",
      lineCount: beforeLines.length,
      code: beforeCode || "// No existing code (new file/section)",
      lines: beforeLines.map((line, index) => ({
        lineNumber: (lineInfo.start || 1) + index,
        content: line,
        type: "removed",
      })),
    },
    after: {
      label: "✅ AFTER (Replace With This)",
      lineCount: afterLines.length,
      code: afterCode,
      lines: afterLines.map((line, index) => ({
        lineNumber: (lineInfo.start || 1) + index,
        content: line,
        type: "added",
      })),
    },
    changeStats: {
      linesRemoved: beforeLines.length,
      linesAdded: afterLines.length,
      netChange: afterLines.length - beforeLines.length,
    },
  };
}

/**
 * Formats instructions into readable numbered list
 * @param {Array} instructions - Array of instruction objects
 * @returns {string} - Formatted instruction text
 */
function formatInstructions(instructions) {
  if (!instructions || instructions.length === 0) {
    return "No specific instructions available.";
  }

  return instructions
    .map((inst) => {
      const stepNum = inst.step || inst.stepNumber;
      const priority = inst.priority ? ` [${inst.priority.toUpperCase()}]` : "";
      const lineInfo = inst.lineNumbers ? ` (Lines: ${inst.lineNumbers})` : "";
      const target = inst.target ? ` → ${inst.target}` : "";

      return (
        `STEP ${stepNum}${priority}: ${inst.action}${target}${lineInfo}\n` +
        `   ${inst.detail || inst.instruction}\n` +
        (inst.codeChange ? `   Change: ${inst.codeChange}\n` : "") +
        (inst.tip ? `   💡 TIP: ${inst.tip}\n` : "")
      );
    })
    .join("\n");
}

/**
 * Formats code section with line numbers for display
 * @param {string} code - Raw code string
 * @param {number} startLine - Starting line number
 * @param {string} language - Programming language
 * @returns {string} - Code with line numbers
 */
function formatCodeWithLineNumbers(code, startLine = 1, language = "") {
  if (!code) return "";

  const lines = code.split("\n");
  const maxLineNumWidth = String(startLine + lines.length).length;

  const numberedLines = lines.map((line, index) => {
    const lineNum = String(startLine + index).padStart(maxLineNumWidth, " ");
    return `${lineNum} | ${line}`;
  });

  return (
    `\`\`\`${language}\n` + numberedLines.join("\n") + "\n```"
  );
}

/**
 * Generates a complete replacement guide card
 * @param {Array} files - Array of file objects with before/after code
 * @returns {Object} - Complete replacement guide
 */
function generateReplacementGuide(files) {
  if (!files || files.length === 0) {
    return {
      totalFiles: 0,
      guides: [],
      summary: "No files to replace.",
    };
  }

  const guides = files.map((file, fileIndex) => {
    const lineInfo = {
      start: file.startLine || 1,
      end: file.endLine || (file.afterCode || "").split("\n").length,
    };

    const diffView = createBeforeAfterView(
      file.beforeCode,
      file.afterCode,
      file.filename,
      lineInfo
    );

    return {
      fileIndex: fileIndex + 1,
      filename: file.filename,
      language: file.language,
      description: file.description || file.explanation || file.benefit || "",
      lineRange: `Lines ${lineInfo.start}–${lineInfo.end}`,
      diff: diffView,
      quickGuide: generateQuickGuide(file),
    };
  });

  return {
    totalFiles: files.length,
    totalLinesChanged: guides.reduce(
      (sum, g) => sum + (g.diff.changeStats.linesAdded || 0),
      0
    ),
    guides: guides,
    summary: `${files.length} file(s) need to be modified.`,
  };
}

/**
 * Generates a quick 3-step guide for file replacement
 * @param {Object} file - File object
 * @returns {Array} - Quick guide steps
 */
function generateQuickGuide(file) {
  return [
    {
      step: 1,
      action: `Open ${file.filename} in your code editor`,
      detail: "Use VS Code, Sublime Text, or your preferred editor",
    },
    {
      step: 2,
      action: `Navigate to lines ${file.startLine || "shown below"}–${file.endLine || "end"}`,
      detail: "Use Ctrl+G (Windows) or Cmd+G (Mac) to jump to line number",
    },
    {
      step: 3,
      action: "Select and replace the code shown in BEFORE section",
      detail: "Copy the AFTER code and paste it, replacing the BEFORE code exactly",
    },
  ];
}

/**
 * Creates a concise voice-friendly summary of changes
 * @param {Object} responseData - Parsed Claude response
 * @returns {string} - Voice-friendly summary
 */
function createVoiceSummary(responseData) {
  if (!responseData) return "I could not generate a summary at this time.";

  const parts = [];

  if (responseData.voiceResponse) {
    parts.push(responseData.voiceResponse);
  }

  if (responseData.files && responseData.files.length > 0) {
    parts.push(
      `I have generated code for ${responseData.files.length} file${responseData.files.length > 1 ? "s" : ""}.`
    );
  }

  if (responseData.instructions && responseData.instructions.length > 0) {
    parts.push(
      `There are ${responseData.instructions.length} steps to follow.`
    );
  }

  if (responseData.warnings && responseData.warnings.length > 0) {
    parts.push(`Important: ${responseData.warnings[0]}`);
  }

  return parts.join(" ");
}

/**
 * Formats warning messages for voice output
 * @param {Array} warnings - Array of warning strings
 * @returns {string} - Formatted warnings
 */
function formatWarnings(warnings) {
  if (!warnings || warnings.length === 0) return "";

  return "⚠️ WARNINGS:\n" + warnings.map((w, i) => `${i + 1}. ${w}`).join("\n");
}

/**
 * Formats professional tips
 * @param {Array} tips - Array of tip strings
 * @returns {string} - Formatted tips
 */
function formatProfessionalTips(tips) {
  if (!tips || tips.length === 0) return "";

  return (
    "💡 PROFESSIONAL TIPS:\n" +
    tips.map((tip, i) => `${i + 1}. ${tip}`).join("\n")
  );
}

/**
 * Truncates text for Alexa voice output (max characters)
 * @param {string} text - Text to truncate
 * @param {number} maxLength - Maximum character length
 * @returns {string} - Truncated text
 */
function truncateForVoice(text, maxLength = 800) {
  if (!text) return "";
  if (text.length <= maxLength) return text;

  const truncated = text.substring(0, maxLength);
  const lastSentence = truncated.lastIndexOf(".");
  return lastSentence > 0
    ? truncated.substring(0, lastSentence + 1)
    : truncated + "...";
}

/**
 * Parses Claude's JSON response safely
 * @param {string} rawResponse - Raw text response from Claude
 * @returns {Object} - Parsed JSON or error object
 */
function parseClaudeResponse(rawResponse) {
  try {
    const jsonMatch = rawResponse.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        success: true,
        data: JSON.parse(jsonMatch[0]),
      };
    }
    return {
      success: false,
      error: "No JSON found in response",
      rawResponse: rawResponse,
    };
  } catch (parseError) {
    console.error("JSON Parse Error:", parseError.message);
    return {
      success: false,
      error: parseError.message,
      rawResponse: rawResponse,
    };
  }
}

module.exports = {
  createBeforeAfterView,
  formatInstructions,
  formatCodeWithLineNumbers,
  generateReplacementGuide,
  generateQuickGuide,
  createVoiceSummary,
  formatWarnings,
  formatProfessionalTips,
  truncateForVoice,
  parseClaudeResponse,
};
