import { Type, type FunctionDeclaration } from '@google/genai';

/**
 * All canvas tool declarations sent to Gemini at session setup.
 * Only code_viewer_show is registered for Step 2 — more will be added per step.
 */
export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'code_viewer_show',
    description:
      'Display a code snippet on the visual canvas alongside your voice explanation. ' +
      'Call this mid-sentence as soon as you want the code to appear — do not announce that you are showing code, just call it and keep talking. ' +
      'The canvas updates silently while you speak.',
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
