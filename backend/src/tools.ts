import { Type, Behavior, type FunctionDeclaration } from '@google/genai';

/**
 * All canvas tool declarations sent to Gemini at session setup.
 * All tools are NON_BLOCKING — model does not pause speech while waiting for responses.
 */
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  // ------------------------------------------------------------------
  // Code Viewer
  // ------------------------------------------------------------------
  {
    name: 'code_viewer_show',
    description:
      'Display a code snippet on the visual canvas. ' +
      'You MUST call this every time you reference or show a specific piece of code — no exceptions. ' +
      'Call it mid-sentence without announcing it. Keep talking. The canvas updates silently.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: {
          type: Type.STRING,
          description: 'Programming language for syntax highlighting, e.g. "python", "javascript".',
        },
        code: {
          type: Type.STRING,
          description: 'The full code snippet to display.',
        },
      },
      required: ['language', 'code'],
    },
  },

  {
    name: 'code_viewer_highlight',
    description:
      'Highlight a range of lines in the current code block. ' +
      'Call this mid-sentence at the exact moment you reference those lines — e.g. as you say "notice line 4 here". ' +
      'Lines are 1-indexed. To clear the highlight, call with start_line and end_line both set to 0.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        start_line: {
          type: Type.NUMBER,
          description: 'First line to highlight (1-indexed).',
        },
        end_line: {
          type: Type.NUMBER,
          description: 'Last line to highlight (1-indexed, inclusive).',
        },
      },
      required: ['start_line', 'end_line'],
    },
  },

  // ------------------------------------------------------------------
  // Call Stack — BOXED (disabled, component preserved)
  // ------------------------------------------------------------------
];
