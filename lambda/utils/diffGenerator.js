"use strict";

/**
 * Generates visual diff representations for code changes
 */

/**
 * Generates a line-by-line diff between two code strings
 * @param {string} beforeCode - Original code
 * @param {string} afterCode - Modified code
 * @param {number} startLine - Starting line number for reference
 * @returns {Object} - Diff object with added/removed/unchanged lines
 */
function generateLineDiff(beforeCode, afterCode, startLine = 1) {
  const beforeLines = (beforeCode || "").split("\n");
  const afterLines = (afterCode || "").split("\n");

  const diff = {
    totalAdded: 0,
    totalRemoved: 0,
    totalUnchanged: 0,
    hunks: [],
    summary: "",
  };

  const maxLines = Math.max(beforeLines.length, afterLines.length);
  let currentHunk = null;

  for (let i = 0; i < maxLines; i++) {
    const beforeLine = beforeLines[i];
    const afterLine = afterLines[i];
    const lineNum = startLine + i;

    if (beforeLine === undefined && afterLine !== undefined) {
      diff.totalAdded++;
      if (!currentHunk) {
        currentHunk = { startLine: lineNum, changes: [] };
      }
      currentHunk.changes.push({
        type: "added",
        lineNumber: lineNum,
        content: afterLine,
        symbol: "+",
      });
    } else if (beforeLine !== undefined && afterLine === undefined) {
      diff.totalRemoved++;
      if (!currentHunk) {
        currentHunk = { startLine: lineNum, changes: [] };
      }
      currentHunk.changes.push({
        type: "removed",
        lineNumber: lineNum,
        content: beforeLine,
        symbol: "-",
      });
    } else if (beforeLine !== afterLine) {
      diff.totalRemoved++;
      diff.totalAdded++;
      if (!currentHunk) {
        currentHunk = { startLine: lineNum, changes: [] };
      }
      currentHunk.changes.push(
        { type: "removed", lineNumber: lineNum, content: beforeLine, symbol: "-" },
        { type: "added", lineNumber: lineNum, content: afterLine, symbol: "+" }
      );
    } else {
      diff.totalUnchanged++;
      if (currentHunk) {
        diff.hunks.push(currentHunk);
        currentHunk = null;
      }
    }
  }

  if (currentHunk) {
    diff.hunks.push(currentHunk);
  }

  diff.summary =
    `+${diff.totalAdded} lines added, ` +
    `-${diff.totalRemoved} lines removed, ` +
    `${diff.totalUnchanged} lines unchanged`;

  return diff;
}

/**
 * Formats diff as readable text output
 * @param {Object} diff - Diff object from generateLineDiff
 * @param {string} filename - Filename for display
 * @returns {string} - Formatted diff text
 */
function formatDiffAsText(diff, filename) {
  const lines = [`📄 File: ${filename}`, `📊 ${diff.summary}`, ""];

  diff.hunks.forEach((hunk, hunkIndex) => {
    lines.push(`@@ Section ${hunkIndex + 1} (Starting at line ${hunk.startLine}) @@`);
    hunk.changes.forEach((change) => {
      const lineNumStr = String(change.lineNumber).padStart(4, " ");
      lines.push(`${change.symbol} Line ${lineNumStr}: ${change.content}`);
    });
    lines.push("");
  });

  return lines.join("\n");
}

/**
 * Creates a structured replacement map for easy code substitution
 * @param {Array} files - Array of file objects with before/after code
 * @returns {Array} - Replacement map with exact positions
 */
function createReplacementMap(files) {
  return files.map((file) => {
    const beforeLines = (file.beforeCode || "").split("\n");
    const afterLines = (file.afterCode || "").split("\n");

    return {
      filename: file.filename,
      language: file.language,
      replacement: {
        findExact: file.beforeCode,
        replaceWith: file.afterCode,
        startLine: file.startLine || 1,
        endLine: file.endLine || beforeLines.length,
        newEndLine: (file.startLine || 1) + afterLines.length - 1,
      },
      humanReadable: {
        instruction: `In ${file.filename}, find lines ${file.startLine || 1} to ${file.endLine || beforeLines.length}`,
        action: `Replace ${beforeLines.length} lines with ${afterLines.length} lines`,
        netChange:
          afterLines.length - beforeLines.length > 0
            ? `+${afterLines.length - beforeLines.length} lines added`
            : `${afterLines.length - beforeLines.length} lines removed`,
      },
      diff: generateLineDiff(file.beforeCode, file.afterCode, file.startLine || 1),
    };
  });
}

/**
 * Generates editor-specific navigation instructions
 * @param {string} editor - Editor name (vscode, sublime, vim, etc.)
 * @param {Object} fileInfo - File and line information
 * @returns {Object} - Editor-specific instructions
 */
function getEditorInstructions(editor, fileInfo) {
  const instructions = {
    vscode: {
      jumpToLine: `Press Ctrl+G (Windows/Linux) or Cmd+G (Mac), type ${fileInfo.startLine}, press Enter`,
      selectLines: `Click line ${fileInfo.startLine}, hold Shift and click line ${fileInfo.endLine}`,
      replace: "Press Ctrl+H (Windows/Linux) or Cmd+H (Mac) to open Find & Replace",
      copyPaste:
        "After selecting, press Delete/Backspace, then paste the new code",
    },
    sublime: {
      jumpToLine: `Press Ctrl+G, type ${fileInfo.startLine}:0`,
      selectLines: `Click line ${fileInfo.startLine}, Shift+click line ${fileInfo.endLine}`,
      replace: "Press Ctrl+H to open Find & Replace",
      copyPaste: "Select the block, then paste replacement code",
    },
    vim: {
      jumpToLine: `Type :${fileInfo.startLine} and press Enter`,
      selectLines: `Press ${fileInfo.startLine}G then V${fileInfo.endLine}G to visual select`,
      replace: `Type :${fileInfo.startLine},${fileInfo.endLine}d to delete lines`,
      copyPaste: "Then press p to paste after, or P to paste before",
    },
    webstorm: {
      jumpToLine: `Press Ctrl+G, enter ${fileInfo.startLine}`,
      selectLines: `Click line ${fileInfo.startLine}, Shift+End, then Shift+Down to line ${fileInfo.endLine}`,
      replace: "Press Ctrl+R to open Replace",
      copyPaste: "Select and replace with copied code",
    },
  };

  return instructions[editor.toLowerCase()] || instructions["vscode"];
}

module.exports = {
  generateLineDiff,
  formatDiffAsText,
  createReplacementMap,
  getEditorInstructions,
};
