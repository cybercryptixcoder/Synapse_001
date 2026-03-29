import { Type, Behavior, type FunctionDeclaration } from '@google/genai';

/**
 * All canvas tool declarations sent to Gemini at session setup.
 * NON_BLOCKING — model does not pause speech while waiting for the tool response.
 */
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'code_viewer_show',
    description:
      'Display a code snippet on the visual canvas alongside your voice explanation. ' +
      'Call this mid-sentence as soon as you want the code to appear — do not announce that you are showing code, just call it and keep talking. ' +
      'The canvas updates silently while you speak.',
    behavior: Behavior.NON_BLOCKING,
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: {
          type: Type.STRING,
          description: 'Programming language for syntax highlighting, e.g. "python", "javascript", "typescript".',
        },
        code: {
          type: Type.STRING,
          description: 'The full code snippet to display.',
        },
      },
      required: ['language', 'code'],
    },
  },
];
